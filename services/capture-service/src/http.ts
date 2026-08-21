/**
 * HTTP layer for the capture service.
 *
 * Constitution §IV: REST + RFC 7807 + Idempotency-Key at the edge.
 * Constitution §VI: Observability by default — request_id on every log
 * and every error response.
 *
 * Auth: in production, `@sthyra-crm/auth` middleware sets req.principal
 * from the JWT. For tests + the in-memory CLI, the tenant comes from
 * the `x-tenant-id` header. This matches the pattern in the other
 * services (org-service, project-service, user-service).
 *
 * Routes (Phase 1 MVP):
 *   POST   /v1/projects/:projectId/captures
 *   GET    /v1/projects/:projectId/captures?status=
 *   GET    /v1/captures/:id
 *   POST   /v1/captures/:id/archive
 *   GET    /v1/upload-sessions/:id
 *   POST   /v1/upload-sessions/:id/chunks/:n
 *   POST   /v1/upload-sessions/:id/complete
 *   GET    /v1/health
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { currentRequestId, installRequestIdPlugin, installCorsPlugin, emit } from '@sthyra-crm/observability';
import {
 CaptureService,
 DuplicateClientCaptureIdError,
 MissingTenantError,
 CaptureServiceError,
} from './service.js';
import {
 InMemoryCaptureRepository,
 InMemoryIdempotencyStore,
} from './repo-memory.js';
import { InMemoryEventBus } from './realtime/index.js';
import { captureEventStreamer } from './realtime/sse.js';
import { installMetricsPlugin, metrics } from './metrics.js';
import type { Capture } from './types.js';

export interface BuildServerDeps {
 readonly service?: CaptureService;
 readonly repo?: import('./repository.js').CaptureRepository;
 readonly idempotency?: import('./repository.js').IdempotencyStore;
 readonly bus?: import('./realtime/index.js').EventBus;
 readonly outboxWriter?: (event: import('./types.js').DomainEvent) => Promise<void>;
}

interface ProblemJson {
 type: string;
 title: string;
 status: number;
 detail: string;
 trace_id: string;
 code: string;
}

function problem(
 reply: { code: (n: number) => unknown; header: (k: string, v: string) => unknown; send: (b: unknown) => unknown },
 status: number,
 type: string,
 title: string,
 detail: string,
 code: string,
 requestId: string,
): unknown {
 reply.header('content-type', 'application/problem+json');
 reply.code(status);
 return reply.send({ type, title, status, detail, trace_id: requestId, code } satisfies ProblemJson);
}

function getTenant(req: { headers: Record<string, string | string[] | undefined> }): string {
 const t = req.headers['x-tenant-id'];
 return (Array.isArray(t) ? t[0] : t ?? '').toString().trim();
}

function getIdempotencyKey(req: { headers: Record<string, string | string[] | undefined> }): string {
 const k = req.headers['x-idempotency-key'];
 return (Array.isArray(k) ? k[0] : k ?? '').toString().trim();
}

export async function buildCaptureServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
 const app = Fastify({ logger: false });
 const bus = deps.bus ?? new InMemoryEventBus();
 const service =
 deps.service ??
 new CaptureService({
 repo: deps.repo ?? new InMemoryCaptureRepository(),
 idempotency: deps.idempotency ?? new InMemoryIdempotencyStore(),
 onEvent: (e) => { void bus.publish(e); },
 });

 // Wire SSE endpoint for realtime push (Slice 5)
 const streamer = captureEventStreamer({
 bus,
 repo: deps.repo ?? new InMemoryCaptureRepository(),
 });
 await streamer(app);

 // Install /v1/metrics endpoint (Constitution §VI — observability)
 installMetricsPlugin(app);

 // Track active uploads via the idempotency store size (best-effort)
 // Production: explicit counter from CaptureService.

 // Request-id propagation + structured logging (Constitution §VI)
 installRequestIdPlugin(app);
 installCorsPlugin(app);

 function requestIdOf(_req: unknown): string {
 return currentRequestId() ?? randomUUID();
 }

 // ── Health ─────────────────────────────────────────────────────
 app.get('/v1/health', async () => ({ status: 'ok' }));

 // ── T-006: POST /v1/projects/:projectId/captures ───────────────
 app.post('/v1/projects/:projectId/captures', async (req, reply) => {
 const rid = requestIdOf(req);
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required (Constitution §II)', 'unauthorized', rid);

 const idempotencyKey = getIdempotencyKey(req);
 if (!idempotencyKey) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key header is required (Constitution §IV)', 'missing_idempotency_key', rid);

 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId path parameter is required', 'invalid_input', rid);

 const body = req.body as { clientCaptureId?: unknown; kind?: unknown; deviceModel?: unknown; deviceOsVersion?: unknown } | undefined;
 if (!body || typeof body !== 'object') return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'body must be a JSON object', 'invalid_input', rid);
 if (typeof body.clientCaptureId !== 'string' || body.clientCaptureId.length === 0) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid clientCaptureId', 'clientCaptureId must be a non-empty string', 'invalid_input', rid);
 if (body.kind !== 'walkthrough_360' && body.kind !== 'drone' && body.kind !== 'laser_scan') {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid kind', "kind must be one of 'walkthrough_360', 'drone', 'laser_scan'", 'invalid_input', rid);
 }

 // Idempotency hit detection: peek the store before calling service.
 const cacheKey = `idem:${orgId}:${idempotencyKey}`;
 const isReplay = (await (deps.idempotency ?? new InMemoryIdempotencyStore()).get<unknown>(cacheKey)) !== null;

 // Bump active-uploads counter (Constitution §VI)
 metrics.incActiveUpload();

 // Structured log: capture creation requested (Constitution §VI)
 emit('capture_create_requested', {
 orgId,
 projectId,
 idempotencyKey,
 kind: body.kind,
 clientCaptureId: body.clientCaptureId,
 }, { service: 'capture-service', level: 'info' });

 try {
 const result = await service.create(orgId, projectId, idempotencyKey, {
 orgId,
 projectId,
 clientCaptureId: body.clientCaptureId,
 kind: body.kind,
 ...(body.deviceModel !== undefined ? { deviceModel: typeof body.deviceModel === 'string' ? body.deviceModel : null } : {}),
 ...(body.deviceOsVersion !== undefined ? { deviceOsVersion: typeof body.deviceOsVersion === 'string' ? body.deviceOsVersion : null } : {}),
 });
 return reply.code(isReplay ? 200 : 201).send(result);
 } catch (err) {
 if (err instanceof DuplicateClientCaptureIdError) {
 return problem(reply, 409, 'https://sthyra-crm.dev/errors/conflict', 'Duplicate client capture id', err.message, 'duplicate_client_capture_id', rid);
 }
 if (err instanceof MissingTenantError) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', err.message, 'invalid_input', rid);
 }
 if (err instanceof CaptureServiceError) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', err.name, err.message, err.code, rid);
 }
 return problem(reply, 500, 'https://sthyra-crm.dev/errors/internal', 'Internal error', (err as Error).message, 'internal_error', rid);
 }
 });

 // ── T-010: GET /v1/projects/:projectId/captures (list) ───────
 app.get('/v1/projects/:projectId/captures', async (req, reply) => {
 const rid = requestIdOf(req);
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', rid);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId required', 'invalid_input', rid);
 const statusRaw = (req.query as { status?: string }).status;
 if (statusRaw && !['draft', 'uploading', 'processing', 'ready', 'failed', 'archived'].includes(statusRaw)) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid status', 'unknown status value', 'invalid_input', rid);
 }
 const list = await service.list(orgId, projectId, statusRaw ? { status: statusRaw as Capture['status'] } : undefined);
 return reply.code(200).send({ data: list });
 });

 // ── T-010: GET /v1/captures/:id ──────────────────────────────
 app.get('/v1/captures/:id', async (req, reply) => {
 const rid = requestIdOf(req);
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', rid);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id required', 'invalid_input', rid);
 const capture = await service.find(orgId, id);
 if (!capture) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Capture not found', `no capture with id ${id} in this tenant`, 'not_found', rid);
 return reply.code(200).send(capture);
 });

 // ── T-009: POST /v1/captures/:id/archive ────────────────────
 app.post('/v1/captures/:id/archive', async (req, reply) => {
 const rid = requestIdOf(req);
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', rid);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id required', 'invalid_input', rid);
 try {
 await service.archive(orgId, id);
 return reply.code(204).send();
 } catch (err) {
 if (err instanceof CaptureServiceError && err.code === 'not_found') {
 return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Capture not found', err.message, 'not_found', rid);
 }
 throw err;
 }
 });

 // ── T-007: GET /v1/upload-sessions/:id ──────────────────────
 app.get('/v1/upload-sessions/:id', async (req, reply) => {
 const rid = requestIdOf(req);
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', rid);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id required', 'invalid_input', rid);
 const session = await service.getUploadSession(orgId, id);
 if (!session) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Upload session not found', `no upload session with id ${id} in this tenant`, 'not_found', rid);
 return reply.code(200).send(session);
 });

 // ── T-008 (extended): POST /v1/upload-sessions/:id/chunks/:n ──
 // Records a single chunk receipt. Idempotent on chunkIndex.
 app.post('/v1/upload-sessions/:id/chunks/:n', async (req, reply) => {
 const rid = requestIdOf(req);
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', rid);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 const n = Number((req.params as { n?: string }).n);
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id required', 'invalid_input', rid);
 if (!Number.isInteger(n) || n < 0) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid chunk index', 'chunk index must be a non-negative integer', 'invalid_input', rid);
 try {
 await service.recordChunkReceived(orgId, id, n);
 return reply.code(200).send({ received: n });
 } catch (err) {
 if (err instanceof CaptureServiceError && err.code === 'not_found') {
 return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Upload session not found', err.message, 'not_found', rid);
 }
 throw err;
 }
 });

 // ── T-008: POST /v1/upload-sessions/:id/complete ────────────
 app.post('/v1/upload-sessions/:id/complete', async (req, reply) => {
 const rid = requestIdOf(req);
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', rid);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id required', 'invalid_input', rid);
 const body = req.body as { sha256?: unknown } | undefined;
 if (!body || typeof body !== 'object' || typeof body.sha256 !== 'string' || body.sha256.length === 0) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'body must include sha256 (string)', 'invalid_input', rid);
 }
 try {
 const result = await service.finalize(orgId, id, body.sha256);
 return reply.code(200).send(result);
 } catch (err) {
 if (err instanceof CaptureServiceError) {
 const status = err.code === 'not_found' ? 404 : 400;
 return problem(reply, status, `https://sthyra-crm.dev/errors/${err.code}`, err.name, err.message, err.code, rid);
 }
 throw err;
 }
 });

 return app;
}
