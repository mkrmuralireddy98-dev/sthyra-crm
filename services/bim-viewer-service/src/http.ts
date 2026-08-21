/**
 * BIM Viewer HTTP layer — 8 routes + SSE.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, installCorsPlugin, currentRequestId } from '@sthyra-crm/observability';
import { BimService, type BimEvent } from './service.js';
import { InMemoryEventBus } from './realtime/index.js';
import { installRealtimePlugin } from './realtime/sse.js';
import { parseIfc4x3 } from './ifc-parser.js';
import type { BimRepository } from './repository.js';
import type { BimServiceDeps } from './service.js';

export interface BuildServerDeps {
 readonly service?: BimService;
 readonly repo?: BimRepository;
 readonly bus?: InMemoryEventBus;
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

export async function buildBimServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
 const app = Fastify({ logger: false, disableRequestLogging: true });
 installRequestIdPlugin(app);
 installCorsPlugin(app);

 const bus = deps.bus ?? new InMemoryEventBus();
 const repo = deps.repo;
 if (!repo) throw new Error('BimServer requires a repo');
 const serviceDeps: BimServiceDeps = {
 repo,
 parser: parseIfc4x3,
 onEvent: (e: BimEvent) => { void bus.publish(e); },
 };
 const service = deps.service ?? new BimService(serviceDeps);

 app.get('/v1/health', async () => ({ status: 'ok' }));

 // T-015: POST /v1/projects/:projectId/bim-model (FR-1)
 app.post('/v1/projects/:projectId/bim-model', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const idem = getIdempotencyKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key header is required', 'missing_idempotency_key', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const body = req.body as { fileName?: string; schemaVersion?: string; modelHash?: string; sizeBytes?: number; createdBy?: string; ifcContent?: string } | undefined;
 if (!body || typeof body !== 'object') return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'body must be an object', 'invalid_input', traceId);
 if (!body.fileName || !body.modelHash || !body.schemaVersion || !body.ifcContent) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', 'fileName, modelHash, schemaVersion, ifcContent required', 'invalid_input', traceId);
 }
 if (body.schemaVersion !== 'IFC4X3') {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Unsupported schema', 'only IFC4X3 supported (Phase 3)', 'invalid_input', traceId);
 }
 try {
 const model = await service.upload({
 orgId, projectId,
 fileName: body.fileName,
 schemaVersion: 'IFC4X3',
 modelHash: body.modelHash,
 storageKey: `bim/${orgId}/${projectId}/${body.modelHash}.ifc`,
 sizeBytes: body.sizeBytes ?? body.ifcContent.length,
 createdBy: body.createdBy ?? 'unknown',
 }, body.ifcContent);
 return reply.code(201).send(model);
 } catch (err) {
 const message = (err as Error).message;
 if (/orgId required|projectId required|createdBy required/.test(message)) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', message, 'invalid_input', traceId);
 }
 if (/IfcParseError|unsupported schema|not an IFC file/.test(message)) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid IFC', message, 'invalid_input', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Upload failed', message, 'invalid_input', traceId);
 }
 });

 // T-016: GET /v1/projects/:projectId/bim-model (FR-2)
 app.get('/v1/projects/:projectId/bim-model', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const model = await repo.findCurrentModel(orgId, projectId);
 if (!model) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'No BIM model', 'no BIM model attached to this project', 'not_found', traceId);
 return reply.code(200).send(model);
 });

 // T-017: POST /v1/projects/:projectId/captures/:captureId/align (FR-3)
 app.post('/v1/projects/:projectId/captures/:captureId/align', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const captureId = ((req.params as { captureId?: string }).captureId ?? '').trim();
 if (!captureId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid captureId', 'captureId is required', 'invalid_input', traceId);
 const jobId = `align_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
 return reply.code(202).send({ jobId, captureId });
 });

 // T-018: POST /v1/projects/:projectId/bim-model/element-lookup (FR-4)
 app.post('/v1/projects/:projectId/bim-model/element-lookup', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const body = req.body as { x?: number; y?: number; z?: number } | undefined;
 if (!body || typeof body !== 'object' || typeof body.x !== 'number' || typeof body.y !== 'number' || typeof body.z !== 'number') {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid coordinates', 'x, y, z must be numbers', 'invalid_input', traceId);
 }
 try {
 const result = await service.elementLookup(orgId, projectId, { x: body.x, y: body.y, z: body.z });
 return reply.code(200).send(result);
 } catch (err) {
 const message = (err as Error).message;
 if (/no BIM model/i.test(message)) {
 return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'No model', message, 'not_found', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Lookup failed', message, 'invalid_input', traceId);
 }
 });

 // T-019: GET /v1/projects/:projectId/bim-model/aligned-captures (FR-5)
 app.get('/v1/projects/:projectId/bim-model/aligned-captures', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const captures = await service.listAlignedCaptures(orgId, projectId);
 return reply.code(200).send({ data: captures });
 });

 // T-020: GET /v1/projects/:projectId/bim-model/diff (FR-6)
 app.get('/v1/projects/:projectId/bim-model/diff', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const q = req.query as { captureId?: string; thresholdMeters?: string };
 if (!q.captureId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid captureId', 'captureId query param required', 'invalid_input', traceId);
 const threshold = q.thresholdMeters ? Number(q.thresholdMeters) : 0.05;
 try {
 const deviations = await service.diff(orgId, projectId, q.captureId, [], threshold);
 return reply.code(200).send({ data: deviations, deviationCount: deviations.length });
 } catch (err) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Diff failed', (err as Error).message, 'invalid_input', traceId);
 }
 });

 // T-021: DELETE /v1/projects/:projectId/bim-model (FR-8)
 app.delete('/v1/projects/:projectId/bim-model', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const query = req.query as { modelId?: string };
 if (!query.modelId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid modelId', 'modelId query param required', 'invalid_input', traceId);
 try {
 await service.delete(orgId, projectId, query.modelId);
 return reply.code(204).send();
 } catch (err) {
 const message = (err as Error).message;
 if (/not found/i.test(message)) {
 return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Not found', message, 'not_found', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Delete failed', message, 'invalid_input', traceId);
 }
 });

 // T-024: SSE (FR-7)
 await installRealtimePlugin({ app, bus });

 return app;
}
