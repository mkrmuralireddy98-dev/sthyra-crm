/**
 * Workflow HTTP layer — 8 routes + /v1/health.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { WorkflowService } from './service.js';
import { InMemoryWorkflowRepository } from './repo-memory.js';
import type { WorkflowRepository } from './repository.js';
import type { CreateWorkflowInput, UpdateWorkflowInput } from './types.js';

export interface BuildServerDeps {
  readonly service?: WorkflowService;
  readonly repo?: WorkflowRepository;
  readonly serviceToken?: string;
}

const DEFAULT_SERVICE_TOKEN = process.env.WORKFLOW_SERVICE_TOKEN ?? 'sthyra-crm-workflow-service-token';

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

export async function buildWorkflowServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  installRequestIdPlugin(app);

  const repo = deps.repo ?? new InMemoryWorkflowRepository();
  const service = deps.service ?? new WorkflowService({ repo });
  const serviceToken = deps.serviceToken ?? DEFAULT_SERVICE_TOKEN;

  app.get('/v1/health', async () => ({ status: 'ok', service: 'workflow' }));

  // FR-1: POST /v1/orgs/:orgId/workflows
  app.post('/v1/orgs/:orgId/workflows', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    if (orgId !== ((req.params as { orgId?: string }).orgId ?? '').trim()) {
      return problem(reply, 404, 'not_found', 'tenant mismatch', traceId);
    }
    const idem = getIdempotencyKey(req);
    if (!idem) return problem(reply, 400, 'missing_idempotency_key', 'x-idempotency-key required', traceId);
    const body = req.body as CreateWorkflowInput | undefined;
    if (!body || !body.name || !body.trigger || !body.action) {
      return problem(reply, 400, 'invalid_input', 'name, trigger, action required', traceId);
    }
    try {
      const w = await service.createWorkflow({
        orgId,
        name: body.name,
        trigger: body.trigger,
        condition: body.condition ?? null,
        action: body.action,
        enabled: body.enabled,
      }, idem);
      return reply.code(201).send({
        workflowId: w.id,
        name: w.name,
        enabled: w.enabled,
        lastRunAt: null,
      });
    } catch (err) {
      return problem(reply, 400, 'invalid_input', (err as Error).message, traceId);
    }
  });

  // FR-2: GET /v1/orgs/:orgId/workflows
  app.get('/v1/orgs/:orgId/workflows', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    if (orgId !== ((req.params as { orgId?: string }).orgId ?? '').trim()) {
      return problem(reply, 404, 'not_found', 'tenant mismatch', traceId);
    }
    const items = await service.listWorkflows(orgId);
    return reply.code(200).send({ items });
  });

  // FR-3: PATCH /v1/workflows/:id
  app.patch('/v1/workflows/:id', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    const body = req.body as UpdateWorkflowInput | undefined;
    if (!body) return problem(reply, 400, 'invalid_input', 'body required', traceId);
    try {
      const w = await service.updateWorkflow(orgId, id, body);
      return reply.code(200).send(w);
    } catch (err) {
      const message = (err as Error).message;
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'not_found', message, traceId);
      }
      return problem(reply, 400, 'invalid_input', message, traceId);
    }
  });

  // FR-4: DELETE /v1/workflows/:id
  app.delete('/v1/workflows/:id', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    await service.softDeleteWorkflow(orgId, id);
    return reply.code(204).send();
  });

  // FR-5: POST /v1/workflows/:id/run
  app.post('/v1/workflows/:id/run', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    const body = req.body as { context?: Record<string, unknown> } | undefined;
    try {
      const result = await service.runWorkflow(orgId, id, body?.context ?? {});
      return reply.code(200).send(result);
    } catch (err) {
      const message = (err as Error).message;
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'not_found', message, traceId);
      }
      return problem(reply, 400, 'invalid_input', message, traceId);
    }
  });

  // FR-6: GET /v1/workflows/:id/runs
  app.get('/v1/workflows/:id/runs', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'invalid_input', 'id required', traceId);
    const limit = Math.min(parseInt((req.query as { limit?: string }).limit ?? '20', 10) || 20, 100);
    const items = await service.listWorkflowRuns(orgId, id, limit);
    return reply.code(200).send({ items });
  });

  // FR-7: POST /v1/internal/events (service-to-service)
  app.post('/v1/internal/events', async (req, reply) => {
    const traceId = rid();
    const token = (req.headers['x-service-token'] as string | undefined) ?? '';
    if (token !== serviceToken) {
      return problem(reply, 401, 'unauthorized', 'invalid service token', traceId);
    }
    const body = req.body as { eventType?: string; orgId?: string; projectId?: string; payload?: Record<string, unknown> } | undefined;
    if (!body || !body.eventType || !body.orgId) {
      return problem(reply, 400, 'invalid_input', 'eventType, orgId required', traceId);
    }
    const result = await service.receiveEvent(body.orgId, body.eventType, body.payload ?? {});
    return reply.code(200).send({ delivered: result.delivered });
  });

  // FR-8: GET /v1/orgs/:orgId/workflows/templates
  app.get('/v1/orgs/:orgId/workflows/templates', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const templates = await service.listTemplates();
    return reply.code(200).send({ items: templates });
  });

  return app;
}
