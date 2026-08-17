import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { MultiInstanceOutboxDispatcher, type OutboxRow, type OutboxSink } from './outbox-multi.js';
import type { PgClient } from './postgres-repo.js';

/**
 * Multi-instance safe outbox dispatcher — uses SELECT ... FOR UPDATE
 * SKIP LOCKED inside a transaction so multiple dispatchers don\'t
 * process the same row.
 */

let fake: { rows: OutboxRow[]; locks: Map<number, boolean> };
let published: OutboxRow[];
let sink: OutboxSink;
let dispatcher: MultiInstanceOutboxDispatcher;

beforeEach(() => {
 fake = { rows: [], locks: new Map() };
 published = [];
 sink = async (row) => { published.push(row); };

 // Fake that simulates FOR UPDATE SKIP LOCKED: only returns rows not
 // currently locked by another transaction.
 const pg: PgClient = {
 async query<R = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
 const sqlLower = sql.toLowerCase();
 if (sqlLower.includes('begin')) {
 return { rows: [] as R[], rowCount: 0 };
 }
 if (sqlLower.includes('select') && sqlLower.includes('for update skip locked')) {
 // Return all unpublished rows (in real DB, SKIP LOCKED would skip rows
 // locked by other transactions — our fake just respects the published flag)
 const batchSize = Number(params[0]) ?? 100;
 const candidates = fake.rows
 .filter((r) => !fake.locks.has(r.id) && !r.published)
 .slice(0, batchSize);
 for (const c of candidates) fake.locks.set(c.id, true);
 return { rows: candidates as unknown as R[], rowCount: candidates.length };
 }
 if (sqlLower.includes('update event_outbox set published')) {
 const id = Number(params[0]);
 fake.locks.delete(id);
 const row = fake.rows.find((r) => r.id === id);
 if (row) row.published = true;
 return { rows: [] as R[], rowCount: 1 };
 }
 if (sqlLower.includes('commit')) {
 // Release all locks held by this transaction
 fake.locks.clear();
 return { rows: [] as R[], rowCount: 0 };
 }
 return { rows: [] as R[], rowCount: 0 };
 },
 } as unknown as PgClient;

 dispatcher = new MultiInstanceOutboxDispatcher({
 pg,
 sink,
 pollIntervalMs: 100,
 logger: () => {},
 });
});

describe('MultiInstanceOutboxDispatcher — FOR UPDATE SKIP LOCKED', () => {
 it('publishes a single event and marks it published', async () => {
 fake.rows.push({
 id: 1, event_type: 'capture.initiated', capture_id: 'cap_001',
 org_id: 'org_a', project_id: 'prj_1', payload: {}, published: false, created_at: new Date(),
 });
 await dispatcher.drainOnce();
 assert.equal(published.length, 1);
 assert.equal(fake.rows[0]?.published, true);
 });

 it('skips rows that are locked by another instance', async () => {
 fake.rows.push({
 id: 1, event_type: 'capture.initiated', capture_id: 'cap_001',
 org_id: 'org_a', project_id: 'prj_1', payload: {}, published: false, created_at: new Date(),
 });
 // Simulate another instance holding a lock
 fake.locks.set(1, true);
 await dispatcher.drainOnce();
 // Should NOT have published
 assert.equal(published.length, 0);
 // But the row remains unpublished
 assert.equal(fake.rows[0]?.published, false);
 });

 it('processes multiple events in sequence', async () => {
 fake.rows.push({ id: 1, event_type: 'a', capture_id: 'cap_1', org_id: 'o', project_id: 'p', payload: {}, published: false, created_at: new Date() });
 fake.rows.push({ id: 2, event_type: 'b', capture_id: 'cap_2', org_id: 'o', project_id: 'p', payload: {}, published: false, created_at: new Date() });
 fake.rows.push({ id: 3, event_type: 'c', capture_id: 'cap_3', org_id: 'o', project_id: 'p', payload: {}, published: false, created_at: new Date() });
 await dispatcher.drainOnce();
 assert.equal(published.length, 3);
 });

 it('sink failure does not mark row published', async () => {
 const failingSink: OutboxSink = async () => { throw new Error('sink down'); };
 // Build a separate pg client with the same fake logic but for this test
 const pg2: PgClient = {
 async query<R = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
 const sqlLower = sql.toLowerCase();
 if (sqlLower.includes('begin')) return { rows: [] as R[], rowCount: 0 };
 if (sqlLower.includes('select') && sqlLower.includes('for update skip locked')) {
 // Return all unpublished rows (in real DB, SKIP LOCKED would skip rows
 // locked by other transactions — our fake just respects the published flag)
 const batchSize = Number(params[0]) ?? 100;
 const candidates = fake.rows
 .filter((r) => !fake.locks.has(r.id) && !r.published)
 .slice(0, batchSize);
 for (const c of candidates) fake.locks.set(c.id, true);
 return { rows: candidates as unknown as R[], rowCount: candidates.length };
 }
 if (sqlLower.includes('update event_outbox set published')) {
 const id = Number(params[0]);
 fake.locks.delete(id);
 const row = fake.rows.find((r) => r.id === id);
 if (row) row.published = true;
 return { rows: [] as R[], rowCount: 1 };
 }
 if (sqlLower.includes('commit')) {
 fake.locks.clear();
 return { rows: [] as R[], rowCount: 0 };
 }
 return { rows: [] as R[], rowCount: 0 };
 },
 } as unknown as PgClient;
 const d = new MultiInstanceOutboxDispatcher({ pg: pg2, sink: failingSink, pollIntervalMs: 100, logger: () => {} });
 fake.rows.push({ id: 1, event_type: 'a', capture_id: 'c', org_id: 'o', project_id: 'p', payload: {}, published: false, created_at: new Date() });
 await d.drainOnce();
 assert.equal(fake.rows[0]?.published, false);
 });
});
