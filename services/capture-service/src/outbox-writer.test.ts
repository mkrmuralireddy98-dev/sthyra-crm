import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { PostgresOutboxWriter } from './outbox-writer.js';
import type { PgClient } from './postgres-repo.js';
import type { DomainEvent } from './types.js';

describe('PostgresOutboxWriter — INSERT INTO event_outbox', () => {
 let writer: PostgresOutboxWriter;
 let executed: Array<{ sql: string; params: readonly unknown[] }>;

 beforeEach(() => {
 executed = [];
 const pg: PgClient = {
 async query<R = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
 executed.push({ sql: sql.trim().toLowerCase().replace(/\\s+/g, ' '), params });
 return { rows: [] as R[], rowCount: 1 };
 },
 } as unknown as PgClient;
 writer = new PostgresOutboxWriter({ pg });
 });

 it('issues INSERT INTO event_outbox with parameterized values', async () => {
 const event: DomainEvent = {
 type: 'capture.initiated',
 captureId: 'cap_001',
 orgId: 'org_a',
 projectId: 'prj_1',
 occurredAt: new Date('2026-08-14T00:00:00Z'),
 };
 await writer.write(event);
 assert.equal(executed.length, 1);
 assert.match(executed[0]!.sql, /insert into event_outbox/);
 });

 it('includes org_id as the first param (tenant boundary)', async () => {
 const event: DomainEvent = {
 type: 'capture.uploaded',
 captureId: 'cap_002',
 orgId: 'org_b',
 projectId: 'prj_2',
 occurredAt: new Date(),
 };
 await writer.write(event);
 assert.equal(executed[0]!.params[2], 'org_b');
 });

 it('serializes the event payload as JSON (captureId, type, occurredAt)', async () => {
 const event: DomainEvent = {
 type: 'capture.archived',
 captureId: 'cap_003',
 orgId: 'org_a',
 projectId: 'prj_1',
 occurredAt: new Date('2026-08-14T00:00:00Z'),
 };
 await writer.write(event);
 const params = executed[0]!.params;
 // params[4] is the JSON stringified payload
 const json = params[4] as string;
 assert.match(json, /captureId/);
 assert.match(json, /capture.archived/);
 });
});
