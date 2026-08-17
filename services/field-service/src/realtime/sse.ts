/**
 * SSE endpoint for issue events (FR-8).
 *
 * GET /v1/projects/:projectId/issues/:id/events
 *   → text/event-stream
 *   → emits issue.* events for the subscribed (orgId, issueId)
 *
 * History replay: emits the current status as a single event.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { IssueEvent, IssueEventBus } from './index.js';
import type { IssueRepository } from '../repository.js';

export interface RealtimePluginDeps {
 readonly app: FastifyInstance;
 readonly bus: IssueEventBus;
 readonly repo: IssueRepository;
}

function formatSSE(event: IssueEvent, id: string): string {
 return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function installRealtimePlugin(deps: RealtimePluginDeps): Promise<void> {
 deps.app.get('/v1/projects/:projectId/issues/:id/events', async (req, reply) => {
 const rid = randomUUID();
 void reply.header('x-request-id', rid);
 const tenant = (req.headers['x-tenant-id'] as string | undefined)?.trim() ?? '';
 if (!tenant) {
 reply.code(401);
 return reply.header('content-type', 'application/problem+json')
 .send({ type: 'https://sthyra-crm.dev/errors/unauthorized', status: 401, title: 'Missing tenant', detail: 'x-tenant-id header is required', code: 'unauthorized', trace_id: rid });
 }
 const issueId = ((req.params as { id?: string }).id ?? '').trim();
 if (!issueId) {
 reply.code(400);
 return reply.send({ error: 'missing id' });
 }

 const issue = await deps.repo.findIssue(tenant, issueId);
 if (!issue) {
 reply.code(404);
 return reply.send({ error: 'issue not found' });
 }

 void reply.header('content-type', 'text/event-stream');
 void reply.header('cache-control', 'no-cache');
 void reply.header('connection', 'keep-alive');
 void reply.header('x-accel-buffering', 'no');

 reply.raw.writeHead(200);
 // History replay
 const initial: IssueEvent = {
 type:
 issue.status === 'resolved' ? 'issue.resolved'
 : issue.status === 'in_progress' ? 'issue.updated'
 : 'issue.created',
 issueId: issue.id,
 orgId: issue.orgId,
 projectId: issue.projectId,
 occurredAt: new Date(),
 };
 reply.raw.write(formatSSE(initial, rid));

 // Live stream
 const unsub = deps.bus.subscribe(tenant, issueId, (e: IssueEvent) => {
 reply.raw.write(formatSSE(e, randomUUID()));
 });

 const heartbeat = setInterval(() => {
 reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
 }, 30_000);

 reply.raw.on('close', () => {
 clearInterval(heartbeat);
 unsub();
 });
 });
}
