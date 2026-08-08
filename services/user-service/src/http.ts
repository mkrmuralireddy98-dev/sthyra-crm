import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  UserService,
  type ProvisionInput,
  type Role,
} from './index.js';
import { emit, installRequestIdPlugin } from '@plumb/observability';

interface BuildServerOptions {
  service: UserService;
}

interface ProvisionBody {
  email?: unknown;
  displayName?: unknown;
  role?: unknown;
  orgId?: unknown;
}

const VALID_ROLES: ReadonlySet<Role> = new Set<Role>([
  'org_owner',
  'project_admin',
  'field_worker',
  'subcontractor',
  'owner_rep',
  'viewer',
  'auditor',
]);

export function buildServer(opts: BuildServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  installRequestIdPlugin(app);

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

  app.post('/v1/users', async (req, reply) => {
    const body = req.body as ProvisionBody;
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
      const role = String(body.role ?? '') as Role;
      const user = await opts.service.provision({
        email: String(body.email ?? ''),
        displayName: String(body.displayName ?? ''),
        role: VALID_ROLES.has(role) ? role : ('invalid' as Role),
        orgId: String(body.orgId ?? ''),
      });
      reply.status(201);
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        orgId: user.orgId,
        createdAt: user.createdAt.toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isDuplicate = /already exists/i.test(message);
      const status = isDuplicate ? 409 : 422;
      reply.type('application/problem+json').status(status);
      return {
        type: `https://plumb.dev/errors/${isDuplicate ? 'conflict' : 'validation_failed'}`,
        title: isDuplicate ? 'User already exists' : 'Validation failed',
        status,
        detail: message,
        trace_id: randomUUID(),
        code: isDuplicate ? 'already_exists' : 'validation_failed',
      };
    }
  });

  app.get('/v1/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await opts.service.findById(id);
    if (!user) {
      reply.type('application/problem+json').status(404);
      return {
        type: 'https://plumb.dev/errors/not_found',
        title: 'User not found',
        status: 404,
        detail: `No user with id "${id}".`,
        trace_id: randomUUID(),
        code: 'not_found',
      };
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      orgId: user.orgId,
      createdAt: user.createdAt.toISOString(),
    };
  });

  app.post('/v1/users/:id/tokens', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await opts.service.issueToken(id);
      reply.status(201);
      return {
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.type('application/problem+json').status(404);
      return {
        type: 'https://plumb.dev/errors/not_found',
        title: 'User not found',
        status: 404,
        detail: message,
        trace_id: randomUUID(),
        code: 'not_found',
      };
    }
  });

  app.get('/v1/tokens/verify', async (req, reply) => {
    const token = (req.headers as { authorization?: string }).authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      reply.type('application/problem+json').status(422);
      return {
        type: 'https://plumb.dev/errors/validation_failed',
        title: 'Missing token',
        status: 422,
        detail: 'Authorization header with Bearer token is required',
        trace_id: randomUUID(),
        code: 'validation_failed',
      };
    }
    const verified = await opts.service.verifyToken(token);
    if (!verified) {
      reply.type('application/problem+json').status(401);
      return {
        type: 'https://plumb.dev/errors/unauthorized',
        title: 'Invalid or expired token',
        status: 401,
        detail: 'Token is invalid, expired, or revoked',
        trace_id: randomUUID(),
        code: 'unauthorized',
      };
    }
    return verified;
  });

  return app;
}

// Re-export the helper for test reuse if needed
export type { ProvisionInput };
