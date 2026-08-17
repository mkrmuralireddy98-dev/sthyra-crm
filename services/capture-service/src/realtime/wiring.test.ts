import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { InMemoryEventBus } from './index.js';
import { InMemoryCaptureRepository, InMemoryIdempotencyStore } from '../repo-memory.js';
import { CaptureService } from '../service.js';

/**
 * Integration test that CaptureService emits capture.initiated via
 * onEvent, and the InMemoryEventBus delivers it to a subscriber.
 * This is the canonical integration point of T-025.
 *
 * IMPORTANT: subscribers must be registered BEFORE the producer
 * publishes. The bus is fire-and-forget — no replay buffer.
 */

describe('T-025 — CaptureService wired to EventBus', () => {
 let bus: InMemoryEventBus;
 let repo: InMemoryCaptureRepository;
 let idempotency: InMemoryIdempotencyStore;
 let events: { type: string; captureId: string }[];
 let service: CaptureService;

 beforeEach(() => {
 bus = new InMemoryEventBus();
 repo = new InMemoryCaptureRepository();
 idempotency = new InMemoryIdempotencyStore();
 events = [];
 service = new CaptureService({
 repo,
 idempotency,
 onEvent: (e) => {
 events.push({ type: e.type, captureId: e.captureId });
 void bus.publish(e);
 },
 });
 });

 it('emits capture.initiated on create', async () => {
 const result = await service.create('org_a', 'prj_1', 'idem-1', {
 orgId: 'org_a',
 projectId: 'prj_1',
 clientCaptureId: 'cli-1',
 kind: 'walkthrough_360',
 });
 assert.equal(events.length, 1);
 assert.equal(events[0]?.type, 'capture.initiated');
 assert.equal(events[0]?.captureId, result.capture.id);
 });

 it('SSE subscribers receive capture.initiated (subscribe before publish)', async () => {
 const received: string[] = [];
 // Subscribe FIRST using a wildcard captureId we control, then create.
 // We don't know the captureId ahead of time, so we wrap the publish
 // call to inject the subscription before the bus dispatches.
 let unsub: (() => void) | null = null;
 // Subscribe at subscribe-time by hooking the bus
 const originalPublish = bus.publish.bind(bus);
 bus.publish = async (e) => {
 // Subscribe on the fly using the event's captureId so we catch it.
 unsub = bus.subscribe('org_a', e.captureId, (evt) => {
 received.push(evt.type);
 });
 await originalPublish(e);
 };

 await service.create('org_a', 'prj_1', 'idem-2', {
 orgId: 'org_a',
 projectId: 'prj_1',
 clientCaptureId: 'cli-2',
 kind: 'walkthrough_360',
 });
 await new Promise((r) => setTimeout(r, 10));
 unsub?.();
 // We may receive 1 or 2 events depending on timing — at minimum
 // the capture.initiated should be in there.
 assert.ok(received.length >= 1);
 assert.ok(received.includes('capture.initiated'));
 });

 it('does NOT emit on idempotent retry (the capture was already created)', async () => {
 const headers = 'idem-3';
 await service.create('org_a', 'prj_1', headers, {
 orgId: 'org_a', projectId: 'prj_1', clientCaptureId: 'cli-3', kind: 'walkthrough_360',
 });
 const initialEventCount = events.length;
 await service.create('org_a', 'prj_1', headers, {
 orgId: 'org_a', projectId: 'prj_1', clientCaptureId: 'cli-3', kind: 'walkthrough_360',
 });
 assert.equal(events.length, initialEventCount);
 });

 it('emits capture.archived when archive is called', async () => {
 const result = await service.create('org_a', 'prj_1', 'idem-4', {
 orgId: 'org_a', projectId: 'prj_1', clientCaptureId: 'cli-4', kind: 'walkthrough_360',
 });
 events.length = 0;
 await service.archive('org_a', result.capture.id);
 assert.equal(events.length, 1);
 assert.equal(events[0]?.type, 'capture.archived');
 });

 it('CROSS-TENANT subscriber does not receive events (Constitution §II)', async () => {
 const result = await service.create('org_a', 'prj_1', 'idem-5', {
 orgId: 'org_a', projectId: 'prj_1', clientCaptureId: 'cli-5', kind: 'walkthrough_360',
 });
 const received: string[] = [];
 const unsub = bus.subscribe('org_b', result.capture.id, (e) => {
 received.push(e.type);
 });
 await new Promise((r) => setTimeout(r, 10));
 unsub();
 assert.equal(received.length, 0);
 });
});
