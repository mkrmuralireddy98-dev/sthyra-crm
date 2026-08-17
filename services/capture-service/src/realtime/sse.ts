/**
 * SSE endpoint — server-sent events for realtime capture updates.
 *
 * Per tasks.md T-024:
 *   GET /v1/projects/:projectId/captures/:id/events
 *     → text/event-stream
 *     → emits capture.initiated, capture.uploaded, capture.failed,
 *       capture.archived events for the subscribed (orgId, captureId)
 *
 * Tenant boundary: x-tenant-id header is required. The bus subscription
 * is orgId-scoped — cross-tenant events are NEVER delivered.
 *
 * Two modes:
 *   - Default: long-lived stream (clients keep connection open, receive
 *     future events as they happen).
 *   - ?once=1: emits the replay event and closes immediately. Useful for
 *     polling clients and tests.
 */

import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { EventBus } from './index.js';
import type { CaptureRepository } from '../repository.js';
import type { DomainEvent } from '../types.js';

export interface EventStreamerDeps {
 readonly bus: EventBus;
 readonly repo: CaptureRepository;
}

interface SSEWireEvent {
 type: 'capture.initiated' | 'capture.uploaded' | 'capture.failed' | 'capture.archived';
 captureId: string;
 orgId: string;
 projectId: string;
 occurredAt: string;
}

async function replayCapture(
 repo: CaptureRepository,
 orgId: string,
 captureId: string,
): Promise<SSEWireEvent | null> {
 const cap = await repo.findCapture(orgId, captureId);
 if (!cap) return null;
 const eventType =
 cap.status === 'ready' ? 'capture.uploaded'
 : cap.status === 'failed' ? 'capture.failed'
 : cap.status === 'archived' ? 'capture.archived'
 : 'capture.initiated';
 return {
 type: eventType,
 captureId: cap.id,
 orgId: cap.orgId,
 projectId: cap.projectId,
 occurredAt: new Date().toISOString(),
 };
}

function formatSSE(event: SSEWireEvent, id: string): string {
 return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function sendProblem(
 reply: { raw: { writeHead: (n: number, h: Record<string, string>) => void; end: (s: string) => void }; code: (n: number) => unknown },
 status: number,
 type: string,
 title: string,
 detail: string,
 code: string,
 traceId: string,
): void {
 const body = JSON.stringify({ type, status, title, detail, code, trace_id: traceId });
 reply.raw.writeHead(status, {
 'content-type': 'application/problem+json',
 'x-request-id': traceId,
 });
 reply.raw.end(body);
}

export function captureEventStreamer(deps: EventStreamerDeps) {
 return async (app: FastifyInstance): Promise<void> => {
 app.get('/v1/projects/:projectId/captures/:id/events', async (req, reply) => {
 const rid = randomUUID();
 const tenant = (req.headers['x-tenant-id'] as string | undefined)?.trim() ?? '';
 if (!tenant) {
 return sendProblem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Missing tenant', 'x-tenant-id header is required (Constitution §II)', 'unauthorized', rid);
 }
 const captureId = ((req.params as { id?: string }).id ?? '').trim();
 if (!captureId) {
 return sendProblem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid id', 'capture id required', 'invalid_input', rid);
 }

 // History replay: emit the current state immediately.
 const replay = await replayCapture(deps.repo, tenant, captureId);
 if (!replay) {
 return sendProblem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Capture not found', `no capture with id ${captureId} in this tenant`, 'not_found', rid);
 }

 // ?once=1 closes the stream after the replay event (one-shot / tests).
 const once = (req.query as { once?: string }).once === '1';

 reply.raw.writeHead(200, {
 'content-type': 'text/event-stream',
 'cache-control': 'no-cache',
 'connection': 'keep-alive',
 'x-accel-buffering': 'no',
 'x-request-id': rid,
 });
 reply.raw.write(formatSSE(replay, rid));

 if (once) {
 reply.raw.end();
 return;
 }

 // Subscribe to new events for this capture.
 const unsub = deps.bus.subscribe(tenant, captureId, (e: DomainEvent) => {
 const wire: SSEWireEvent = {
 type: e.type,
 captureId: e.captureId,
 orgId: e.orgId,
 projectId: e.projectId,
 occurredAt: e.occurredAt.toISOString(),
 };
 reply.raw.write(formatSSE(wire, randomUUID()));
 });

 // Heartbeat every 30s so proxies don't drop the connection.
 const heartbeat = setInterval(() => {
 reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
 }, 30_000);

 // Clean up on close.
 reply.raw.on('close', () => {
 clearInterval(heartbeat);
 unsub();
 });
 });
 };
}
