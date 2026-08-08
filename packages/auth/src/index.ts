/**
 * Plumb auth — bearer-token middleware shared by every backend service.
 *
 * Design:
 *   - Each service installs `installAuthPlugin({ userServiceUrl })`.
 *   - On every request, the plugin reads `Authorization: Bearer <token>`.
 *   - If absent and the route is in the public list, request proceeds with
 *     `req.principal = null`.
 *   - If present, the plugin calls `<userServiceUrl>/v1/tokens/verify` and
 *     attaches the result to `req.principal`.
 *   - 401 if the token is invalid/expired.
 *
 * Phase 1 will swap the remote HTTP call for a local SPIFFE-verified SVID
 * check; the middleware shape stays the same.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { emit } from '@plumb/observability';

export interface Principal {
  readonly userId: string;
  readonly orgId: string;
  readonly role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal | null;
  }
}

export interface InstallAuthOptions {
  userServiceUrl: string;
  /** Routes that don't require auth. Match by prefix. Default: ['/v1/health']. */
  publicPrefixes?: string[];
  /** Optional override of the verification function — used in tests. */
  verify?: (token: string) => Promise<Principal | null>;
}

export async function installAuthPlugin(
  app: FastifyInstance,
  opts: InstallAuthOptions,
): Promise<void> {
  const publicPrefixes = opts.publicPrefixes ?? ['/v1/health'];

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url;
    if (publicPrefixes.some((p) => url.startsWith(p))) {
      req.principal = null;
      return;
    }

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      reply.type('application/problem+json').status(401).send({
        type: 'https://plumb.dev/errors/unauthorized',
        title: 'Missing bearer token',
        status: 401,
        detail: 'Authorization: Bearer <token> header is required',
        trace_id: randomUUID(),
        code: 'unauthorized',
      });
      return reply;
    }

    const token = auth.slice('Bearer '.length).trim();
    if (!token) {
      reply.type('application/problem+json').status(401).send({
        type: 'https://plumb.dev/errors/unauthorized',
        title: 'Empty bearer token',
        status: 401,
        detail: 'Bearer token is empty',
        trace_id: randomUUID(),
        code: 'unauthorized',
      });
      return reply;
    }

    try {
      const principal = opts.verify
        ? await opts.verify(token)
        : await verifyRemote(opts.userServiceUrl, token, req.headers['x-request-id']);
      if (!principal) {
        reply.type('application/problem+json').status(401).send({
          type: 'https://plumb.dev/errors/unauthorized',
          title: 'Invalid or expired token',
          status: 401,
          detail: 'Token is invalid, expired, or revoked',
          trace_id: randomUUID(),
          code: 'unauthorized',
        });
        return reply;
      }
      req.principal = principal;
    } catch (err) {
      emit('error', 'auth_verify_failed', { detail: err instanceof Error ? err.message : String(err) });
      reply.type('application/problem+json').status(503).send({
        type: 'https://plumb.dev/errors/auth_unavailable',
        title: 'Auth service unavailable',
        status: 503,
        detail: 'Could not reach the user-service for token verification',
        trace_id: randomUUID(),
        code: 'auth_unavailable',
      });
      return reply;
    }
  });
}

async function verifyRemote(
  userServiceUrl: string,
  token: string,
  requestId: string | string[] | undefined,
): Promise<Principal | null> {
  const res = await fetch(`${userServiceUrl}/v1/tokens/verify`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'x-request-id': Array.isArray(requestId) ? (requestId[0] ?? '') : (requestId ?? ''),
    },
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`user-service returned ${res.status}`);
  }
  return (await res.json()) as Principal;
}
