import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { InMemoryEventBus } from './index.js';
import { captureEventStreamer } from './sse.js';
import { InMemoryCaptureRepository, InMemoryIdempotencyStore } from '../repo-memory.js';
import { CaptureService } from '../service.js';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

interface SSEEvent {
 data: string;
 event?: string;
 id?: string;
}

function parseSSE(body: string): SSEEvent[] {
 const events: SSEEvent[] = [];
 const blocks = body.split('\n\n').filter((b) => b.trim().length > 0);
 for (const block of blocks) {
 const dataMatch = block.match(/^data:\s*(.*)$/m);
 const eventMatch = block.match(/^event:\s*(.*)$/m);
 const idMatch = block.match(/^id:\s*(.*)$/m);
 if (dataMatch) {
 events.push({
 data: dataMatch[1] ?? '',
 event: eventMatch?.[1],
 id: idMatch?.[1],
 });
 }
 }
 return events;
}

describe('captureEventStreamer — SSE', () => {
 let app: FastifyInstance;
 let repo: InMemoryCaptureRepository;
 let bus: InMemoryEventBus;

 beforeEach(async () => {
 repo = new InMemoryCaptureRepository();
 bus = new InMemoryEventBus();
 const idempotency = new InMemoryIdempotencyStore();
 new CaptureService({ repo, idempotency, onEvent: (e) => { void bus.publish(e); } });
 app = Fastify({ logger: false });
 const streamer = captureEventStreamer({ bus, repo });
 await streamer(app);
 await app.ready();
 });

 async function createCapture(): Promise<string> {
 const idempotency = new InMemoryIdempotencyStore();
 const service = new CaptureService({ repo, idempotency, onEvent: (e) => { void bus.publish(e); } });
 const result = await service.create('org_a', 'prj_1', `idem-${Date.now()}`, {
 orgId: 'org_a',
 projectId: 'prj_1',
 clientCaptureId: `cli-${Date.now()}`,
 kind: 'walkthrough_360',
 });
 return result.capture.id;
 }

 it('returns 200 with text/event-stream content-type (?once mode)', async () => {
 const captureId = await createCapture();
 const res = await app.inject({
 method: 'GET',
 url: `/v1/projects/prj_1/captures/${captureId}/events?once=1`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 assert.match(res.headers['content-type'] ?? '', /text\/event-stream/);
 });

 it('returns the history replay event in the response body', async () => {
 const captureId = await createCapture();
 const res = await app.inject({
 method: 'GET',
 url: `/v1/projects/prj_1/captures/${captureId}/events?once=1`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 const events = parseSSE(res.body);
 assert.equal(events.length, 1);
 assert.equal(events[0]?.event, 'capture.initiated');
 const data = JSON.parse(events[0]?.data ?? '{}') as { captureId: string; orgId: string };
 assert.equal(data.captureId, captureId);
 assert.equal(data.orgId, 'org_a');
 });

 it('returns 401 when x-tenant-id is missing', async () => {
 const captureId = await createCapture();
 const res = await app.inject({
 method: 'GET',
 url: `/v1/projects/prj_1/captures/${captureId}/events?once=1`,
 });
 assert.equal(res.statusCode, 401);
 });

 it('returns 404 when the capture does not exist in this tenant', async () => {
 const res = await app.inject({
 method: 'GET',
 url: '/v1/projects/prj_1/captures/cap_nonexistent/events?once=1',
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 404);
 });

 it('CROSS-TENANT 404 (no existence leak)', async () => {
 const captureId = await createCapture();
 // org_b tries to subscribe to org_a's capture
 const res = await app.inject({
 method: 'GET',
 url: `/v1/projects/prj_1/captures/${captureId}/events?once=1`,
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(res.statusCode, 404);
 });
});

describe('parseSSE — sanity', () => {
 it('parses a multi-event SSE stream', () => {
 const body = `event: capture.initiated\ndata: {"type":"capture.initiated"}\nid: 1\n\nevent: capture.uploaded\ndata: {"type":"capture.uploaded"}\nid: 2\n\n`;
 const events = parseSSE(body);
 assert.equal(events.length, 2);
 assert.equal(events[0]?.event, 'capture.initiated');
 assert.equal(events[1]?.event, 'capture.uploaded');
 assert.equal(events[1]?.id, '2');
 });
});
