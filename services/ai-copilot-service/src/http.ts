/**
 * AI Copilot HTTP layer — 8 routes + SSE.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { CopilotService } from './service.js';
import type { CopilotServiceDeps } from './service.js';
import type { CopilotRepository } from './repository.js';
import type { ToolRouterDeps } from './tool-router.js';
import { InMemoryCopilotRepository } from './repo-memory.js';
import { InMemoryEventBus, type CopilotEvent } from './realtime/index.js';
import { installRealtimePlugin } from './realtime/sse.js';

export interface BuildServerDeps {
 readonly service?: CopilotService;
 readonly repo?: CopilotRepository;
 readonly routerDeps?: ToolRouterDeps;
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

export async function buildCopilotServer(deps: BuildServerDeps = {}): Promise<FastifyInstance> {
 const app = Fastify({ logger: false, disableRequestLogging: true });
 installRequestIdPlugin(app);

 const repo = deps.repo ?? new InMemoryCopilotRepository();
 const bus = deps.bus ?? new InMemoryEventBus();
 const routerDeps: ToolRouterDeps = deps.routerDeps ?? {
 fetchFn: (async () => ({
 ok: false,
 status: 503,
 statusText: 'downstream not configured',
 json: async () => ({}),
 } as unknown as Response)) as typeof fetch,
 captureServiceUrl: process.env.CAPTURE_SERVICE_URL ?? 'http://localhost:9090',
 fieldServiceUrl: process.env.FIELD_SERVICE_URL ?? 'http://localhost:9091',
 bimViewerServiceUrl: process.env.BIM_VIEWER_SERVICE_URL ?? 'http://localhost:9092',
 };
 const serviceDeps: CopilotServiceDeps = {
 repo,
 routerDeps,
 onEvent: (e: CopilotEvent) => { void bus.publish(e); },
 };
 const service = deps.service ?? new CopilotService(serviceDeps);

 app.get('/v1/health', async () => ({ status: 'ok' }));

 // FR-1: POST /v1/conversations/:conversationId/messages
 app.post('/v1/conversations/:conversationId/messages', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const idem = getIdempotencyKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key header is required', 'missing_idempotency_key', traceId);
 const conversationId = ((req.params as { conversationId?: string }).conversationId ?? '').trim();
 const body = req.body as { text?: string; projectId?: string; userId?: string } | undefined;
 if (!body || typeof body !== 'object' || !body.text || !body.projectId) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid body', 'text and projectId required', 'invalid_input', traceId);
 }
 try {
 const result = await service.submit({
 orgId,
 userId: body.userId ?? 'default',
 conversationId: conversationId || null,
 text: body.text,
 idempotencyKey: idem,
 }, body.projectId);
 return reply.code(201).send(result);
 } catch (err) {
 const message = (err as Error).message;
 if (/orgId required|userId required|text required|projectId required/.test(message)) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', message, 'invalid_input', traceId);
 }
 if (/message cap/.test(message)) {
 return problem(reply, 422, 'https://sthyra-crm.dev/errors/conversation-full', 'Conversation full', message, 'conversation_full', traceId);
 }
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Submit failed', message, 'invalid_input', traceId);
 }
 });

 // FR-2: GET /v1/conversations/:conversationId
 app.get('/v1/conversations/:conversationId', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const conversationId = ((req.params as { conversationId?: string }).conversationId ?? '').trim();
 const conv = await service.getConversation(orgId, conversationId);
 if (!conv) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Conversation not found', 'no conversation with this id in this tenant', 'not_found', traceId);
 const messages = await repo.listMessages(orgId, conversationId);
 return reply.code(200).send({ ...conv, messages });
 });

 // FR-3: GET /v1/conversations
 app.get('/v1/conversations', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const q = req.query as { userId?: string; limit?: string; cursor?: string };
 if (!q.userId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid userId', 'userId query param required', 'invalid_input', traceId);
 const list = await service.listConversations(orgId, q.userId, { limit: q.limit ? Number(q.limit) : undefined, cursor: q.cursor });
 return reply.code(200).send({ data: list.items, nextCursor: list.nextCursor });
 });

 // FR-8: POST .../messages/:messageId/pin
 app.post('/v1/conversations/:conversationId/messages/:messageId/pin', async (req, reply) => {
 const traceId = rid();
 const orgId = getTenant(req);
 if (!orgId) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required', 'unauthorized', traceId);
 const conversationId = ((req.params as { conversationId?: string }).conversationId ?? '').trim();
 const messageId = ((req.params as { messageId?: string }).messageId ?? '').trim();
 if (!conversationId || !messageId) return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', 'conversationId and messageId required', 'invalid_input', traceId);
 const body = req.body as { pinned?: boolean } | undefined;
 const pinned = body?.pinned ?? true;
 await service.pinMessage(orgId, conversationId, messageId, pinned);
 return reply.code(200).send({ pinned });
 });

 // FR-7: SSE (T-024)
 await installRealtimePlugin({ app, bus });

 return app;
}
