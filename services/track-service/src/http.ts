/**
 * Track HTTP layer — 8 routes + SSE.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { TrackService } from './service.js';
import { InMemoryTrackRepository } from './repo-memory.js';
import { computeProjectStatusReport } from './status.js';
import { computeVariance } from './variance.js';
import { buildGraph } from './graph.js';
import type { TrackRepository } from './repository.js';
import type { MilestoneStatus, ProgressSource } from './types.js';

export interface BuildServerDeps {
  readonly service?: TrackService;
  readonly repo?: TrackRepository;
}

function getTenant(req: { headers: Record<string, string | string[] | undefined> }): string {
  const t = req.headers['x-tenant-id'];
  return (Array.isArray(t) ? t[0] : t ?? '').toString().trim();
}

function getIdempotencyKey(req: { headers: Record<string, string | string[] | undefined> }): string {
  const k = req.headers['x-idempotency-key'];
  return (Array.isArray(k) ? k[0] : k ?? '').toString().trim();
}

interface ProblemJson {
  type: string; title: string; status: number;
  detail: string; trace_id: string; code: string;
}

function problem(
  reply: { code: (n: number) => unknown; header: (k: string, v: string) => unknown; send: (b: unknown) => unknown },
  status: number,
  type: string,
  title: string,
  detail: string,
  code: string,
  traceId: string,
): unknown {
  reply.header('content-type', 'application/problem+json');
  reply.code(status);
  return reply.send({ type, status, title, detail, trace_id: traceId, code } satisfies ProblemJson);
}

function rid(): string {
  return currentRequestId() ?? randomUUID();
}

export async function buildTrackServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  installRequestIdPlugin(app);

  const repo = deps.repo ?? new InMemoryTrackRepository();
  const service = deps.service ?? new TrackService({ repo });

  app.get('/v1/health', async () => ({ status: 'ok', service: 'track' }));

  // ─── FR-1: POST milestone ──────────────────────────
  app.post('/v1/projects/:projectId/milestones', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id required', 'unauthorized', traceId);
    const idem = getIdempotencyKey(req);
    if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', 'missing_idempotency_key', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId required', 'invalid_input', traceId);
    const body = req.body as { name?: string; description?: string; plannedDate?: string; dependsOn?: string[] } | undefined;
    if (!body || typeof body !== 'object' || !body.name || !body.plannedDate) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'name and plannedDate required', 'invalid_input', traceId);
    }
    const plannedDate = new Date(body.plannedDate);
    if (Number.isNaN(plannedDate.getTime())) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid plannedDate', 'plannedDate must be ISO-8601', 'invalid_input', traceId);
    }
    try {
      const m = await service.createMilestone({
        orgId, projectId,
        name: body.name,
        description: body.description ?? null,
        plannedDate,
        dependsOn: body.dependsOn ?? [],
      }, idem);
      return reply.code(201).send({
        milestoneId: m.id,
        name: m.name,
        plannedDate: m.plannedDate.toISOString(),
        status: m.status,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (/cycle detected/.test(message)) {
        reply.header('retry-after', '600');
        return problem(reply, 422, 'https://sthyra-crm.dev/errors/cycle-detected', 'Cycle detected', message, 'cycle_detected', traceId);
      }
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Create failed', message, 'invalid_input', traceId);
    }
  });

  // ─── FR-2: PATCH milestone ──────────────────────────
  app.patch('/v1/projects/:projectId/milestones/:id', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id required', 'unauthorized', traceId);
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id required', 'invalid_input', traceId);
    const body = req.body as { status?: MilestoneStatus; actualDate?: string; progressPct?: number; actorId?: string } | undefined;
    if (!body || typeof body !== 'object' || !body.actorId) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'actorId required', 'invalid_input', traceId);
    }
    try {
      const updated = await service.updateMilestone(orgId, id, {
        actorId: body.actorId,
        status: body.status,
        actualDate: body.actualDate ? new Date(body.actualDate) : undefined,
        progressPct: body.progressPct,
      });
      return reply.code(200).send(updated);
    } catch (err) {
      const message = (err as Error).message;
      if (/not found/i.test(message)) {
        return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Milestone not found', message, 'not_found', traceId);
      }
      if (/invalid transition/.test(message)) {
        return problem(reply, 409, 'https://sthyra-crm.dev/errors/invalid-transition', 'Invalid transition', message, 'invalid_transition', traceId);
      }
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Update failed', message, 'invalid_input', traceId);
    }
  });

  // ─── FR-3: POST progress ───────────────────────────
  app.post('/v1/projects/:projectId/progress', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id required', 'unauthorized', traceId);
    const idem = getIdempotencyKey(req);
    if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', 'missing_idempotency_key', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId required', 'invalid_input', traceId);
    const body = req.body as { progressPct?: number; note?: string; milestoneId?: string; source?: ProgressSource } | undefined;
    if (!body || typeof body !== 'object' || typeof body.progressPct !== 'number') {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'progressPct required', 'invalid_input', traceId);
    }
    try {
      const entry = await service.logProgress({
        orgId, projectId,
        milestoneId: body.milestoneId ?? null,
        progressPct: body.progressPct,
        note: body.note ?? null,
        source: (body.source ?? 'manual') as ProgressSource,
      }, idem);
      return reply.code(201).send({
        entryId: entry.id,
        progressPct: entry.progressPct,
        loggedAt: entry.loggedAt.toISOString(),
      });
    } catch (err) {
      return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Progress failed', (err as Error).message, 'invalid_input', traceId);
    }
  });

  // ─── FR-4: GET status ──────────────────────────────
  app.get('/v1/projects/:projectId/status', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id required', 'unauthorized', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId required', 'invalid_input', traceId);
    const milestones = await service.listMilestones(orgId, projectId);
    const progress = await repo.listProgress(orgId, projectId);
    const report = computeProjectStatusReport(milestones, progress, new Date());
    return reply.code(200).send(report);
  });

  // ─── FR-5: GET variance ────────────────────────────
  app.get('/v1/projects/:projectId/variance', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id required', 'unauthorized', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId required', 'invalid_input', traceId);
    const milestones = await service.listMilestones(orgId, projectId);
    const variance = computeVariance(milestones, new Date());
    return reply.code(200).send(variance);
  });

  // ─── FR-6: GET milestones/graph ─────────────────────
  app.get('/v1/projects/:projectId/milestones/graph', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id required', 'unauthorized', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId required', 'invalid_input', traceId);
    const milestones = await service.listMilestones(orgId, projectId);
    const graph = buildGraph(milestones);
    return reply.code(200).send(graph);
  });

  // ─── FR-7: GET milestones (filter by status) ───────
  app.get('/v1/projects/:projectId/milestones', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id required', 'unauthorized', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId required', 'invalid_input', traceId);
    const status = (req.query as { status?: string }).status;
    const filter = status ? { status: status as MilestoneStatus } : undefined;
    const milestones = await service.listMilestones(orgId, projectId, filter);
    return reply.code(200).send({ items: milestones });
  });

  return app;
}
