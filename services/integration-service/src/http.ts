/**
 * Integration HTTP layer — 8 routes + /v1/health.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, installCorsPlugin, currentRequestId } from '@sthyra-crm/observability';
import { IntegrationService } from './service.js';
import { InMemoryIntegrationRepository } from './repo-memory.js';
import type { IntegrationRepository } from './repository.js';
import type { ProviderType, SyncDirection } from './types.js';

export interface BuildServerDeps {
  readonly service?: IntegrationService;
  readonly repo?: IntegrationRepository;
}

function getTenant(req: { headers: Record<string, string | string[] | undefined> }): string {
  const t = req.headers['x-tenant-id'];
  return (Array.isArray(t) ? t[0] : t ?? '').toString().trim();
}

function getIdempotencyKey(req: { headers: Record<string, string | string[] | undefined> }): string {
  const k = req.headers['x-idempotency-key'];
  return (Array.isArray(k) ? k[0] : k ?? '').toString().trim();
}

function rid(): string { return currentRequestId() ?? randomUUID(); }

function problem(
  reply: { code: (n: number) => unknown; header: (k: string, v: string) => unknown; send: (b: unknown) => unknown },
  status: number,
  code: string,
  detail: string,
  traceId: string,
): unknown {
  reply.header('content-type', 'application/problem+json');
  reply.code(status);
  return reply.send({
    type: `https://sthyra-crm.dev/errors/${code}`,
    status,
    title: code,
    detail,
    trace_id: traceId,
    code,
  });
}

export async function buildIntegrationServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  installRequestIdPlugin(app);
 installCorsPlugin(app);

  const repo = deps.repo ?? new InMemoryIntegrationRepository();
  const service = deps.service ?? new IntegrationService({ repo });

  app.get('/v1/health', async () => ({ status: 'ok', service: 'integration' }));

  // FR-1: POST /v1/orgs/:orgId/integrations
  app.post('/v1/orgs/:orgId/integrations', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    if (orgId !== ((req.params as { orgId?: string }).orgId ?? '').trim()) {
      return problem(reply, 404, 'not_found', 'tenant mismatch', traceId);
    }
    const idem = getIdempotencyKey(req);
    if (!idem) return problem(reply, 400, 'missing_idempotency_key', 'x-idempotency-key required', traceId);
    const body = req.body as { provider?: ProviderType; config?: Record<string, unknown> } | undefined;
    if (!body || !body.provider || !body.config) {
      return problem(reply, 400, 'invalid_input', 'provider, config required', traceId);
    }
    if (!['procore', 'bim360', 'plangrid', 'webhook'].includes(body.provider)) {
      return problem(reply, 422, 'unsupported_provider', 'provider must be procore|bim360|plangrid|webhook', traceId);
    }
    try {
      const i = await service.createIntegration({
        orgId,
        provider: body.provider,
        config: body.config as Parameters<typeof service.createIntegration>[0]['config'],
      }, idem);
      return reply.code(201).send({
        integrationId: i.id,
        provider: i.provider,
        status: i.status,
        connectedAt: i.connectedAt.toISOString(),
      });
    } catch (err) {
      return problem(reply, 400, 'invalid_input', (err as Error).message, traceId);
    }
  });

  // FR-2: GET /v1/orgs/:orgId/integrations
  app.get('/v1/orgs/:orgId/integrations', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    if (orgId !== ((req.params as { orgId?: string }).orgId ?? '').trim()) {
      return problem(reply, 404, 'not_found', 'tenant mismatch', traceId);
    }
    const items = await service.listIntegrations(orgId);
    return reply.code(200).send({ items });
  });

  // FR-3: DELETE /v1/integrations/:id
  app.delete('/v1/integrations/:id', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    await service.disconnect(orgId, id);
    return reply.code(204).send();
  });

  // FR-4: POST /v1/integrations/:id/sync
  app.post('/v1/integrations/:id/sync', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    const body = req.body as { direction?: SyncDirection; entityTypes?: string[]; dryRun?: boolean } | undefined;
    if (!body || !body.direction || !Array.isArray(body.entityTypes)) {
      return problem(reply, 400, 'invalid_input', 'direction, entityTypes required', traceId);
    }
    if (!['pull', 'push', 'both'].includes(body.direction)) {
      return problem(reply, 422, 'invalid_direction', 'direction must be pull|push|both', traceId);
    }
    try {
      const result = await service.triggerSync(orgId, id, body.direction, body.entityTypes, body.dryRun);
      return reply.code(200).send(result);
    } catch (err) {
      const message = (err as Error).message;
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'not_found', message, traceId);
      }
      return problem(reply, 400, 'invalid_input', message, traceId);
    }
  });

  // FR-5: GET /v1/integrations/:id/syncs
  app.get('/v1/integrations/:id/syncs', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    const limit = Math.min(parseInt((req.query as { limit?: string }).limit ?? '20', 10) || 20, 100);
    const items = await service.listSyncs(orgId, id, limit);
    return reply.code(200).send({ items });
  });

  // FR-6: POST /v1/integrations/:id/webhook
  app.post('/v1/integrations/:id/webhook', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    const token = (req.headers['x-webhook-token'] as string | undefined) ?? '';
    const body = req.body as { eventType?: string; payload?: Record<string, unknown> } | undefined;
    if (!body) return problem(reply, 400, 'invalid_input', 'body required', traceId);
    try {
      const result = await service.receiveWebhook(orgId, id, token, body);
      return reply.code(200).send(result);
    } catch (err) {
      const message = (err as Error).message;
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'not_found', message, traceId);
      }
      return problem(reply, 400, 'invalid_input', message, traceId);
    }
  });

  // FR-7: GET /v1/integrations/providers
  app.get('/v1/integrations/providers', async (_req, reply) => {
    const items = await service.listProviders();
    return reply.code(200).send({ items });
  });

  // FR-8: POST /v1/integrations/:id/test
  app.post('/v1/integrations/:id/test', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    try {
      const result = await service.testConnection(orgId, id);
      return reply.code(200).send(result);
    } catch (err) {
      const message = (err as Error).message;
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'not_found', message, traceId);
      }
      return problem(reply, 400, 'invalid_input', message, traceId);
    }
  });

  return app;
}
