/**
 * Report HTTP layer — 8 routes + /v1/health.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { ReportService } from './service.js';
import { InMemoryReportRepository } from './repo-memory.js';
import { StubReportFetcher } from './fetcher.js';
import type { ReportRepository } from './repository.js';
import type { ReportFetcher } from './fetcher.js';
import type { CustomReportRequest } from './types.js';

export interface BuildServerDeps {
  readonly service?: ReportService;
  readonly repo?: ReportRepository;
  readonly fetcher?: ReportFetcher;
}

function getTenant(req: { headers: Record<string, string | string[] | undefined> }): string {
  const t = req.headers['x-tenant-id'];
  return (Array.isArray(t) ? t[0] : t ?? '').toString().trim();
}

function getIdempotencyKey(req: { headers: Record<string, string | string[] | undefined> }): string {
  const k = req.headers['x-idempotency-key'];
  return (Array.isArray(k) ? k[0] : k ?? '').toString().trim();
}

function rid(): string {
  return currentRequestId() ?? randomUUID();
}

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

export async function buildReportServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, disableRequestLogging: true });
  installRequestIdPlugin(app);

  const repo = deps.repo ?? new InMemoryReportRepository();
  const fetcher = deps.fetcher ?? new StubReportFetcher();
  const service = deps.service ?? new ReportService({ repo, fetcher });

  app.get('/v1/health', async () => ({ status: 'ok', service: 'report' }));

  // FR-1
  app.get('/v1/projects/:projectId/reports/daily', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'invalid_input', 'projectId required', traceId);
    const dateStr = (req.query as { date?: string }).date ?? new Date().toISOString().slice(0, 10);
    const date = new Date(dateStr + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) {
      return problem(reply, 400, 'invalid_input', 'date must be YYYY-MM-DD', traceId);
    }
    const report = await service.getDaily(orgId, projectId, date);
    return reply.code(200).send(report);
  });

  // FR-2
  app.get('/v1/orgs/:orgId/reports/weekly', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const weekStr = (req.query as { week?: string }).week ?? '';
    if (!/^\d{4}-W\d{2}$/.test(weekStr)) {
      return problem(reply, 400, 'invalid_input', 'week must be YYYY-Www', traceId);
    }
    // Compute Monday of the given ISO week
    const [yearStr, weekNumStr] = weekStr.split('-W');
    const year = parseInt(yearStr!, 10);
    const weekNum = parseInt(weekNumStr!, 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Dow = jan4.getUTCDay() || 7;
    const monday = new Date(jan4.getTime() + (weekNum - 1) * 7 * 86_400_000 - (jan4Dow - 1) * 86_400_000);
    const report = await service.getWeekly(orgId, monday);
    return reply.code(200).send(report);
  });

  // FR-3
  app.get('/v1/projects/:projectId/reports/deep-dive', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'invalid_input', 'projectId required', traceId);
    const dive = await service.getDeepDive(orgId, projectId);
    return reply.code(200).send(dive);
  });

  // FR-4
  app.get('/v1/orgs/:orgId/reports/portfolio', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const portfolio = await service.getPortfolio(orgId);
    return reply.code(200).send(portfolio);
  });

  // FR-5
  app.post('/v1/orgs/:orgId/reports/custom', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const body = req.body as CustomReportRequest | undefined;
    if (!body || !body.entity) {
      return problem(reply, 400, 'invalid_input', 'entity required', traceId);
    }
    if (!['issues', 'captures', 'milestones'].includes(body.entity)) {
      return problem(reply, 422, 'unsupported_entity', 'entity must be issues|captures|milestones', traceId);
    }
    const result = await service.runCustom(orgId, body);
    return reply.code(200).send(result);
  });

  // FR-6
  app.post('/v1/projects/:projectId/reports/schedule', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const idem = getIdempotencyKey(req);
    if (!idem) return problem(reply, 400, 'missing_idempotency_key', 'x-idempotency-key required', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'invalid_input', 'projectId required', traceId);
    const body = req.body as { kind?: 'daily' | 'weekly'; dayOfWeek?: number; hour?: number; recipients?: string[] } | undefined;
    if (!body || !body.kind || typeof body.hour !== 'number' || !Array.isArray(body.recipients)) {
      return problem(reply, 400, 'invalid_input', 'kind, hour, recipients required', traceId);
    }
    try {
      const schedule = await service.scheduleReport({
        orgId, projectId,
        kind: body.kind,
        dayOfWeek: body.dayOfWeek ?? null,
        hour: body.hour,
        recipients: body.recipients,
      }, idem);
      return reply.code(201).send({
        scheduleId: schedule.id,
        nextRunAt: schedule.nextRunAt.toISOString(),
      });
    } catch (err) {
      return problem(reply, 400, 'invalid_input', (err as Error).message, traceId);
    }
  });

  // FR-7
  app.get('/v1/projects/:projectId/reports/schedule', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    if (!projectId) return problem(reply, 400, 'invalid_input', 'projectId required', traceId);
    const items = await service.listSchedules(orgId, projectId);
    return reply.code(200).send({ items });
  });

  // FR-8
  app.delete('/v1/projects/:projectId/reports/schedule/:id', async (req, reply) => {
    const traceId = rid();
    const orgId = getTenant(req);
    if (!orgId) return problem(reply, 401, 'unauthorized', 'x-tenant-id required', traceId);
    const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
    const id = ((req.params as { id?: string }).id ?? '').trim();
    if (!projectId || !id) return problem(reply, 400, 'invalid_input', 'projectId + id required', traceId);
    try {
      await service.cancelSchedule(orgId, projectId, id);
      return reply.code(204).send();
    } catch (err) {
      return problem(reply, 404, 'not_found', (err as Error).message, traceId);
    }
  });

  return app;
}
