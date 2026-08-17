import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { InMemoryEventBus, type EventBus } from './index.js';
import type { DomainEvent } from '../types.js';

function makeEvent(type: DomainEvent['type'], orgId = 'org_a', captureId = 'cap_001'): DomainEvent {
 return {
 type,
 orgId,
 captureId,
 projectId: 'prj_1',
 occurredAt: new Date(),
 };
}

describe('InMemoryEventBus — pub/sub', () => {
 let bus: EventBus;

 beforeEach(() => {
 bus = new InMemoryEventBus();
 });

 it('publishes an event with no subscribers (no-op)', async () => {
 await bus.publish(makeEvent('capture.initiated'));
 assert.equal(bus.subscriberCount(), 0);
 });

 it('delivers events to a subscriber', async () => {
 const received: DomainEvent[] = [];
 bus.subscribe('org_a', 'cap_001', (e) => { received.push(e); });
 await bus.publish(makeEvent('capture.uploaded', 'org_a', 'cap_001'));
 assert.equal(received.length, 1);
 assert.equal(received[0]?.type, 'capture.uploaded');
 });

 it('routes events by captureId (per-capture subscription)', async () => {
 const received1: DomainEvent[] = [];
 const received2: DomainEvent[] = [];
 bus.subscribe('org_a', 'cap_001', (e) => { received1.push(e); });
 bus.subscribe('org_a', 'cap_002', (e) => { received2.push(e); });
 await bus.publish(makeEvent('capture.uploaded', 'org_a', 'cap_001'));
 await bus.publish(makeEvent('capture.uploaded', 'org_a', 'cap_002'));
 assert.equal(received1.length, 1);
 assert.equal(received2.length, 1);
 assert.equal(received1[0]?.captureId, 'cap_001');
 assert.equal(received2[0]?.captureId, 'cap_002');
 });

 it('does NOT leak events across orgs (tenant boundary)', async () => {
 const received: DomainEvent[] = [];
 bus.subscribe('org_a', 'cap_001', (e) => { received.push(e); });
 // Same captureId but different org — should NOT be delivered
 await bus.publish(makeEvent('capture.uploaded', 'org_b', 'cap_001'));
 assert.equal(received.length, 0);
 });

 it('returns an unsubscribe function that detaches', async () => {
 const received: DomainEvent[] = [];
 const unsub = bus.subscribe('org_a', 'cap_001', (e) => { received.push(e); });
 await bus.publish(makeEvent('capture.uploaded', 'org_a', 'cap_001'));
 assert.equal(received.length, 1);
 unsub();
 await bus.publish(makeEvent('capture.uploaded', 'org_a', 'cap_001'));
 assert.equal(received.length, 1);
 });

 it('supports multiple subscribers on the same capture', async () => {
 const r1: DomainEvent[] = [];
 const r2: DomainEvent[] = [];
 bus.subscribe('org_a', 'cap_001', (e) => { r1.push(e); });
 bus.subscribe('org_a', 'cap_001', (e) => { r2.push(e); });
 await bus.publish(makeEvent('capture.uploaded', 'org_a', 'cap_001'));
 assert.equal(r1.length, 1);
 assert.equal(r2.length, 1);
 });

 it('subscriberCount reports active subscriptions', () => {
 assert.equal(bus.subscriberCount(), 0);
 const u1 = bus.subscribe('org_a', 'cap_001', () => {});
 const u2 = bus.subscribe('org_a', 'cap_002', () => {});
 assert.equal(bus.subscriberCount(), 2);
 u1();
 assert.equal(bus.subscriberCount(), 1);
 u2();
 assert.equal(bus.subscriberCount(), 0);
 });

 it('handles subscriber errors without breaking other subscribers (Constitution §V)', async () => {
 const r1: DomainEvent[] = [];
 const r2: DomainEvent[] = [];
 bus.subscribe('org_a', 'cap_001', () => { throw new Error('subscriber 1 boom'); });
 bus.subscribe('org_a', 'cap_001', (e) => { r2.push(e); });
 // r2 should still receive the event even if r1 throws.
 await bus.publish(makeEvent('capture.uploaded', 'org_a', 'cap_001'));
 assert.equal(r2.length, 1);
 });

 it('delivers capture.failed events when present', async () => {
 const received: DomainEvent[] = [];
 bus.subscribe('org_a', 'cap_001', (e) => { received.push(e); });
 await bus.publish(makeEvent('capture.failed', 'org_a', 'cap_001'));
 assert.equal(received.length, 1);
 assert.equal(received[0]?.type, 'capture.failed');
 });
});
