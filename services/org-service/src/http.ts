/**
 * Org Service HTTP layer — Fastify, RFC 7807 problem+json, Idempotency-Key.
 *
 * Architectural choices (master plan §9):
 *  - REST at the edge (per backend agent ADR).
 *  - Errors follow RFC 7807 (application/problem+json).
 *  - POST /v1/orgs honors `Idempotency-Key` header.
 *  - Health endpoint at /v1/health for liveness probes.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { OrgService, type Org } from './index.js';
import { emit, installRequestIdPlugin } from '@plumb/observability';

interface BuildServerOptions {
  service: OrgService;
  /** Optional in-memory idempotency cache; replace with Redis in prod. */
  idempotency?: Map<string, string>;
}

interface CreateOrgBody {
  name?: unknown;
  region?: unknown;
  plan?: unknown;
}

interface Rfc7807 {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  trace_id: string;
  code?: string;
}

export function buildServer(opts: BuildServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  installRequestIdPlugin(app);
  const idem = opts.idempotency ?? new Map<string, string>();

  app.setErrorHandler((err: unknown, _req, reply) => {
    const trace_id = randomUUID();
    const detail = err instanceof Error ? err.message : String(err);
    emit('error', 'unhandled_error', { detail });
    reply.type('application/problem+json').status(500).send({
      type: 'https://plumb.dev/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail,
      trace_id,
      code: 'internal_error',
    });
  });

  app.get('/v1/health', async () => ({ status: 'ok' }));

  app.post('/v1/orgs', async (req, reply) => {
    const idemKey = req.headers['idempotency-key'];
    if (typeof idemKey === 'string' && idemKey.length > 0) {
      const existingId = idem.get(idemKey);
      if (existingId) {
        reply.type('application/problem+json').status(409);
        return {
          type: 'https://plumb.dev/errors/idempotency_conflict',
          title: 'Idempotency-Key already used',
          status: 409,
          detail: `An organization was already created with Idempotency-Key "${idemKey}".`,
          trace_id: randomUUID(),
          code: 'idempotency_conflict',
        };
      }
    }

    const body = req.body as CreateOrgBody;
    if (!body || typeof body !== 'object') {
      reply.type('application/problem+json').status(422);
      return {
        type: 'https://plumb.dev/errors/validation_failed',
        title: 'Validation failed',
        status: 422,
        detail: 'request body must be a JSON object',
        trace_id: randomUUID(),
        code: 'validation_failed',
      };
    }

    try {
      const org = await opts.service.create({
        name: String(body.name ?? ''),
        region: String(body.region ?? '') as never,
        plan: String(body.plan ?? '') as never,
      });

      if (typeof idemKey === 'string' && idemKey.length > 0) {
        idem.set(idemKey, org.id);
      }

      reply.status(201);
      return serializeOrg(org);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isDuplicate = /already exists/i.test(message);
      // For validation errors, derive a short title from the offending field.
      const fieldMatch = message.match(/^unknown (\w+):/);
      const field = !isDuplicate && fieldMatch ? fieldMatch[1]?.toLowerCase() : null;
      const title = isDuplicate
        ? 'Organization already exists'
        : field
          ? `Invalid ${field}`
          : 'Validation failed';
      const status = isDuplicate ? 409 : 422;
      reply.type('application/problem+json').status(status);
      return {
        type: `https://plumb.dev/errors/${isDuplicate ? 'conflict' : 'validation_failed'}`,
        title,
        status,
        detail: message,
        trace_id: randomUUID(),
        code: isDuplicate ? 'already_exists' : 'validation_failed',
      };
    }
  });

  app.get('/v1/orgs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const org = await opts.service.get(id);
    if (!org) {
      reply.type('application/problem+json').status(404);
      return {
        type: 'https://plumb.dev/errors/not_found',
        title: 'Organization not found',
        status: 404,
        detail: `No organization with id "${id}".`,
        trace_id: randomUUID(),
        code: 'not_found',
      };
    }
    return serializeOrg(org);
  });

  return app;
}

function serializeOrg(org: Org) {
  return {
    id: org.id,
    name: org.name,
    region: org.region,
    plan: org.plan,
    createdAt: org.createdAt.toISOString(),
  };
}
