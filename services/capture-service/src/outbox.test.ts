import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { OutboxDispatcher, type OutboxRow, type OutboxSink } from './outbox.js';
import type { PgClient } from '../postgres-repo.js';

/**
 * Outbox dispatcher — drains the event_outbox table and publishes events
 * to the EventBus (and Phase 1.b: Redis pub/sub for multi-instance).
 *
 * The dispatcher is a polling loop:
 *   1. SELECT unpublished events with FOR UPDATE SKIP LOCKED
 *   2. Publish each via the sink
 *   3. UPDATE published=true in a transaction
 *
 * SKIP LOCKED ensures multiple dispatchers don't process the same row.
 */

interface FakeEvent {
 rows: OutboxRow[];
 published: Set<number>;
}

let fake: FakeEvent;
let published: OutboxRow[];
let sink: OutboxSink;
let dispatcher: OutboxDispatcher;

beforeEach(() => {
 fake = { rows: [], published: new Set() };
 published = [];
 sink = async (row) => { published.push(row); };

 const pg: PgClient = {
 async query<R = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
 const sqlLower = sql.toLowerCase();
 if (sqlLower.includes('select') && sqlLower.includes('event_outbox')) {
 // Only return unpublished rows (simulating WHERE published = FALSE)
 const unpublished = fake.rows.filter((r) => !r.published) as R[];
 return { rows: unpublished, rowCount: unpublished.length };
 }
 if (sqlLower.includes('update event_outbox set published')) {
 const id = Number(params[0]);
 fake.published.add(id);
 const row = fake.rows.find((r) => r.id === id);
 if (row) row.published = true;
 return { rows: [] as R[], rowCount: 1 };
 }
 return { rows: [] as R[], rowCount: 0 };
 },
 } as unknown as PgClient;

 dispatcher = new OutboxDispatcher({
 pg,
 sink,
 pollIntervalMs: 100,
 logger: () => {},
 });
});

describe('OutboxDispatcher — drain unpublished events', () => {
 it('publishes a single unpublished event and marks it published', async () => {
 fake.rows.push({
 id: 1,
 event_type: 'capture.initiated',
 capture_id: 'cap_001',
 org_id: 'org_a',
 project_id: 'prj_1',
 payload: { type: 'capture.initiated', captureId: 'cap_001' },
 published: false,
 created_at: new Date(),
 });
 await dispatcher.drainOnce();
 assert.equal(published.length, 1);
 assert.equal(published[0]?.id, 1);
 assert.equal(fake.rows[0]?.published, true);
 });

 it('publishes multiple events in one drain cycle', async () => {
 for (let i = 1; i <= 3; i++) {
 fake.rows.push({
 id: i,
 event_type: 'capture.uploaded',
 capture_id: `cap_${i}`,
 org_id: 'org_a',
 project_id: 'prj_1',
 payload: {},
 published: false,
 created_at: new Date(),
 });
 }
 await dispatcher.drainOnce();
 assert.equal(published.length, 3);
 });

 it('does not re-publish already-published events', async () => {
 fake.rows.push({
 id: 1,
 event_type: 'capture.initiated',
 capture_id: 'cap_001',
 org_id: 'org_a',
 project_id: 'prj_1',
 payload: {},
 published: true,
 created_at: new Date(),
 });
 await dispatcher.drainOnce();
 assert.equal(published.length, 0);
 });

 it('sink errors do not mark the row published (retry on next drain)', async () => {
 const failingSink: OutboxSink = async () => { throw new Error('sink down'); };
 const pg2 = {
 async query<R = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
 const sqlLower = sql.toLowerCase();
 if (sqlLower.includes('select')) return { rows: fake.rows.filter((r) => !r.published) as R[], rowCount: fake.rows.length };
 if (sqlLower.includes('update')) return { rows: [] as R[], rowCount: 1 };
 return { rows: [] as R[], rowCount: 0 };
 },
 } as unknown as PgClient;
 const d = new OutboxDispatcher({ pg: pg2, sink: failingSink, pollIntervalMs: 100, logger: () => {} });
 fake.rows.push({
 id: 1, event_type: 'capture.initiated', capture_id: 'cap_001',
 org_id: 'org_a', project_id: 'prj_1', payload: {}, published: false, created_at: new Date(),
 });
 await d.drainOnce();
 // Sink failed → row NOT marked published
 assert.equal(fake.rows[0]?.published, false);
 });

 it('start() polls on the configured interval, stop() stops', async () => {
 fake.rows.push({
 id: 1, event_type: 'capture.initiated', capture_id: 'cap_001',
 org_id: 'org_a', project_id: 'prj_1', payload: {}, published: false, created_at: new Date(),
 });
 dispatcher.start();
 await new Promise((r) => setTimeout(r, 150));
 await dispatcher.stop();
 assert.ok(published.length >= 1);
 });
});
