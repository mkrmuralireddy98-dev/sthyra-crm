/**
 * Field Service HTTP layer — 8 routes + SSE.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { InMemoryIssueRepository } from './repo-memory.js';
import { InMemoryIdempotencyStore } from './in-memory-idempotency.js';
import { IssueService } from './service.js';
import { encodeCursor } from './pagination.js';
import type { IssueRepository } from './repository.js';
import { InMemoryEventBus } from './realtime/index.js';
import { installRealtimePlugin } from './realtime/sse.js';
import { computeCloseoutReport } from './closeout.js';

export interface BuildServerDeps {
 readonly service?: IssueService;
 readonly repo?: IssueRepository;
 readonly idempotency?: InMemoryIdempotencyStore;
 readonly bus?: InMemoryEventBus;
 readonly paginationSecret?: string;
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

export async function buildFieldServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
 const app = Fastify({ logger: false, disableRequestLogging: true });
 installRequestIdPlugin(app);

 const bus = deps.bus ?? new InMemoryEventBus();
 const repo = deps.repo ?? new InMemoryIssueRepository();
 const idempotency = deps.idempotency ?? new InMemoryIdempotencyStore();
 const service = deps.service ?? new IssueService({
 repo,
 idempotency,
 onEvent: (e) => { void bus.publish(e); },
 paginationSecret: deps.paginationSecret,
 });

 app.get('/v1/health', async () => ({ status: 'ok' }));

 // POST /v1/projects/:projectId/issues (T-014)
 app.post('/v1/projects/:projectId/issues', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required (Constitution §II)', 'unauthorized', traceId);
 const idem = getIdempotencyKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key header is required', 'missing_idempotency_key', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const body = req.body as Record<string, unknown> | undefined;
 if (!body || typeof body !== 'object') return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'body must be an object', 'invalid_input', traceId);
 const title = typeof body.title === 'string' ? body.title : '';
 const description = typeof body.description === 'string' ? body.description : '';
 const severity = body.severity;
 if (!title) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid title', 'title is required', 'invalid_input', traceId);
 if (!description) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid description', 'description is required', 'invalid_input', traceId);
 if (severity !== 'low' && severity !== 'medium' && severity !== 'high' && severity !== 'critical') {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid severity', 'severity must be low|medium|high|critical', 'invalid_input', traceId);
 }
 try {
 const issue = await service.create(orgId, projectId, idem, {
 orgId, projectId,
 captureId: typeof body.captureId === 'string' ? body.captureId : null,
 clientIssueId: typeof body.clientIssueId === 'string' ? body.clientIssueId : null,
 title, description,
 severity: severity as 'low' | 'medium' | 'high' | 'critical',
 coordinates: body.coordinates as { x: number; y: number; z: number } | null | undefined,
 assignedTo: typeof body.assignedTo === 'string' ? body.assignedTo : null,
 dueDate: null,
 createdBy: typeof body.createdBy === 'string' ? body.createdBy : 'unknown',
 });
 return reply.code(201).send(issue);
 } catch (err) {
 const message = (err as Error).message;
 if (/duplicate/i.test(message)) {
 return problem(reply, 409, 'https://sthyra-crm.dev/errors/conflict', 'Duplicate clientIssueId', message, 'duplicate_client_issue_id', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', message, 'invalid_input', traceId);
 }
 });

 // GET /v1/projects/:projectId/issues (T-015)
 app.get('/v1/projects/:projectId/issues', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const q = req.query as { status?: string; severity?: string; cursor?: string; limit?: string };
 const filter: Record<string, unknown> = {};
 if (q.status && ['open', 'in_progress', 'resolved', 'wont_fix'].includes(q.status)) filter['status'] = q.status;
 if (q.severity && ['low', 'medium', 'high', 'critical'].includes(q.severity)) filter['severity'] = q.severity;
 const limit = q.limit ? Math.min(200, Math.max(1, parseInt(q.limit, 10))) : 50;
 const result = await service.list(orgId, projectId, filter as never, { cursor: q.cursor, limit });
 const last = result.items[result.items.length - 1];
 const encodedCursor = result.nextCursor && last
 ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id, dir: 'next' },
 deps.paginationSecret ?? process.env.PAGINATION_SECRET ?? 'sthyra-crm-dev-pagination-secret-32b')
 : null;
 return reply.code(200).send({ data: result.items, nextCursor: encodedCursor });
 });

 // GET /v1/projects/:projectId/issues/:id (T-016)
 app.get('/v1/projects/:projectId/issues/:id', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id is required', 'invalid_input', traceId);
 const issue = await service.find(orgId, id);
 if (!issue) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Issue not found', `no issue with id ${id} in this tenant`, 'not_found', traceId);
 const history = await repo.listStatusHistory(orgId, id);
 const comments = await repo.listComments(orgId, id);
 return reply.code(200).send({ ...issue, timeline: history, comments: comments.items });
 });

 // PATCH /v1/projects/:projectId/issues/:id (T-017)
 app.patch('/v1/projects/:projectId/issues/:id', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id is required', 'invalid_input', traceId);
 const body = req.body as Record<string, unknown> | undefined;
 if (!body || typeof body !== 'object') return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'body must be an object', 'invalid_input', traceId);
 try {
 const updated = await service.update(orgId, id, {
 title: typeof body.title === 'string' ? body.title : undefined,
 description: typeof body.description === 'string' ? body.description : undefined,
 severity: typeof body.severity === 'string' && ['low', 'medium', 'high', 'critical'].includes(body.severity) ? body.severity as 'low' | 'medium' | 'high' | 'critical' : undefined,
 assignedTo: body.assignedTo === null ? null : typeof body.assignedTo === 'string' ? body.assignedTo : undefined,
 dueDate: undefined,
 actorId: typeof body.actorId === 'string' ? body.actorId : 'unknown',
 });
 return reply.code(200).send(updated);
 } catch (err) {
 const message = (err as Error).message;
 const code = /not found/i.test(message) ? 'not_found' : 'invalid_input';
 const status = /not found/i.test(message) ? 404 : 400;
 return problem(reply, status, 'https://sthyra-crm.dev/errors/not-found', 'Update failed', message, code, traceId);
 }
 });

 // POST comments (T-018)
 app.post('/v1/projects/:projectId/issues/:id/comments', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id is required', 'invalid_input', traceId);
 const idem = getIdempotencyKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key header is required', 'missing_idempotency_key', traceId);
 const body = req.body as Record<string, unknown> | undefined;
 if (!body || typeof body !== 'object') return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'body must be an object', 'invalid_input', traceId);
 const text = typeof body.text === 'string' ? body.text : '';
 const authorId = typeof body.authorId === 'string' ? body.authorId : '';
 if (!text) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid text', 'text is required', 'invalid_input', traceId);
 if (!authorId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid authorId', 'authorId is required', 'invalid_input', traceId);
 try {
 const c = await service.comment(orgId, id, idem, {
 authorId,
 text,
 attachments: Array.isArray(body.attachments) ? body.attachments as { key: string; contentType: string; sha256: string }[] : [],
 });
 return reply.code(201).send(c);
 } catch (err) {
 return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Comment failed', (err as Error).message, 'not_found', traceId);
 }
 });

 // POST resolve
 app.post('/v1/projects/:projectId/issues/:id/resolve', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id is required', 'invalid_input', traceId);
 const body = req.body as Record<string, unknown> | undefined;
 const actorId = (body && typeof body === 'object' && typeof body.actorId === 'string') ? body.actorId : 'unknown';
 const resolutionNote = (body && typeof body === 'object' && typeof body.resolutionNote === 'string') ? body.resolutionNote : '';
 try {
 const updated = await service.resolve(orgId, id, { actorId, resolutionNote });
 return reply.code(200).send(updated);
 } catch (err) {
 const message = (err as Error).message;
 if (/resolution.*note/i.test(message)) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Missing resolutionNote', message, 'missing_resolution_note', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Resolve failed', message, 'invalid_input', traceId);
 }
 });

 // POST reopen
 app.post('/v1/projects/:projectId/issues/:id/reopen', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const id = ((req.params as { id?: string }).id ?? '').trim();
 if (!id) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'id is required', 'invalid_input', traceId);
 const body = req.body as Record<string, unknown> | undefined;
 const actorId = (body && typeof body === 'object' && typeof body.actorId === 'string') ? body.actorId : 'unknown';
 const reason = (body && typeof body === 'object' && typeof body.reason === 'string') ? body.reason : '';
 try {
 const updated = await service.reopen(orgId, id, { actorId, reason });
 return reply.code(200).send(updated);
 } catch (err) {
 const message = (err as Error).message;
 if (/reason/i.test(message)) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Missing reason', message, 'missing_reason', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Reopen failed', message, 'invalid_input', traceId);
 }
 });


 // ─── Phase 7 FR-2: POST photos ─────────────────────────
 app.post('/v1/projects/:projectId/issues/:issueId/photos', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const issueId = ((req.params as { issueId?: string }).issueId ?? '').trim();
 if (!issueId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid issueId', 'issueId is required', 'invalid_input', traceId);
 const body = req.body as { sha256?: string; contentType?: string; caption?: string; sizeBytes?: number } | undefined;
 if (!body || !body.sha256 || !body.contentType || typeof body.sizeBytes !== 'number') {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'sha256, contentType, sizeBytes required', 'invalid_input', traceId);
 }
 if (body.sizeBytes > 10 * 1024 * 1024) {
 return problem(reply, 413, 'https://sthyra-crm.dev/errors/photo-too-large', 'Photo too large', `photo exceeds 10MB: ${body.sizeBytes}`, 'photo_too_large', traceId);
 }
 const issue = await repo.findIssue(orgId, issueId);
 if (!issue) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Issue not found', `no issue ${issueId} in this tenant`, 'not_found', traceId);
 if (issue.orgId !== orgId) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Issue not found', 'cross-tenant', 'not_found', traceId);
 try {
 const photo = await service.addPhoto(orgId, issueId, {
 sha256: body.sha256,
 contentType: body.contentType,
 caption: body.caption ?? null,
 sizeBytes: body.sizeBytes,
 data: Buffer.alloc(0), // MVP: data in body, not stored separately
 });
 return reply.code(201).send({
 photoId: photo.id,
 sha256: photo.sha256,
 sizeBytes: photo.sizeBytes,
 capturedAt: photo.capturedAt.toISOString(),
 });
 } catch (err) {
 const message = (err as Error).message;
 if (/too many photos/.test(message)) {
 return problem(reply, 422, 'https://sthyra-crm.dev/errors/too-many-photos', 'Too many photos', message, 'too_many_photos', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Photo upload failed', message, 'invalid_input', traceId);
 }
 });

 // ─── Phase 7 FR-4: POST inspect (pass/fail) ──────────
 app.post('/v1/projects/:projectId/issues/:issueId/inspect', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const issueId = ((req.params as { issueId?: string }).issueId ?? '').trim();
 if (!issueId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid issueId', 'issueId is required', 'invalid_input', traceId);
 const body = req.body as { inspectorId?: string; outcome?: string; note?: string } | undefined;
 if (!body || typeof body.inspectorId !== 'string' || (body.outcome !== 'pass' && body.outcome !== 'fail')) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'inspectorId, outcome (pass|fail) required', 'invalid_input', traceId);
 }
 try {
 const updated = await service.inspect(orgId, issueId, {
 inspectorId: body.inspectorId,
 outcome: body.outcome,
 note: body.note ?? null,
 });
 return reply.code(200).send(updated);
 } catch (err) {
 const message = (err as Error).message;
 if (/not found/i.test(message)) {
 return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Issue not found', message, 'not_found', traceId);
 }
 if (/cannot inspect/.test(message)) {
 return problem(reply, 409, 'https://sthyra-crm.dev/errors/wrong-state', 'Wrong state', message, 'wrong_state', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Inspect failed', message, 'invalid_input', traceId);
 }
 });

 // ─── Phase 7 FR-5: GET closeout ────────────────────────
 app.get('/v1/projects/:projectId/closeout', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const projectId = ((req.params as { projectId?: string }).projectId ?? '').trim();
 if (!projectId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid projectId', 'projectId is required', 'invalid_input', traceId);
 const all = await service.list(orgId, projectId);
 const report = computeCloseoutReport(all.items);
 return reply.code(200).send(report);
 });

 // SSE endpoint (T-023)
 await installRealtimePlugin({ app, bus, repo });

 return app;
}
