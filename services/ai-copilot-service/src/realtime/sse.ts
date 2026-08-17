/**
 * SSE endpoint for copilot events (FR-7).
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { CopilotEvent, CopilotEventBus } from './index.js';

export interface RealtimePluginDeps {
 readonly app: FastifyInstance;
 readonly bus: CopilotEventBus;
}

function formatSSE(event: CopilotEvent, id: string): string {
 return 'id: ' + id + '\nevent: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n';
}

export async function installRealtimePlugin(deps: RealtimePluginDeps): Promise<void> {
 deps.app.get('/v1/conversations/:conversationId/events', async (req, reply) => {
 const rid = randomUUID();
 void reply.header('x-request-id', rid);
 const tenant = (req.headers['x-tenant-id'] as string | undefined)?.trim() ?? '';
 if (!tenant) {
 reply.code(401);
 return reply.header('content-type', 'application/problem+json')
 .send({ type: 'https://sthyra-crm.dev/errors/unauthorized', status: 401, title: 'Missing tenant', detail: 'x-tenant-id header is required', code: 'unauthorized', trace_id: rid });
 }
 const conversationId = ((req.params as { conversationId?: string }).conversationId ?? '').trim();
 if (!conversationId) {
 reply.code(400);
 return reply.send({ error: 'missing conversationId' });
 }

 reply.raw.writeHead(200, {
 'content-type': 'text/event-stream',
 'cache-control': 'no-cache',
 'connection': 'keep-alive',
 'x-accel-buffering': 'no',
 });

 const initial: CopilotEvent = {
 type: 'message.received',
 orgId: tenant,
 conversationId,
 messageId: 'placeholder',
 };
 reply.raw.write(formatSSE(initial, rid));

 const unsub = deps.bus.subscribe(tenant, conversationId, (e: CopilotEvent) => {
 reply.raw.write(formatSSE(e, randomUUID()));
 });

 const heartbeat = setInterval(() => {
 reply.raw.write(': heartbeat ' + new Date().toISOString() + '\n\n');
 }, 30_000);

 const q = (req.query as { once?: string });
 if (q.once === '1') {
 setTimeout(() => {
 clearInterval(heartbeat);
 unsub();
 reply.raw.end();
 }, 50);
 return;
 }

 reply.raw.on('close', () => {
 clearInterval(heartbeat);
 unsub();
 });
 });
}
