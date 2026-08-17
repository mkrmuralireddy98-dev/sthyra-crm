import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { PostgresCaptureRepository, type PgClient } from './postgres-repo.js';
import type { Capture, UploadSession } from './types.js';

/**
 * PostgresCaptureRepository — real Postgres implementation.
 *
 * Tests use FakePgClient (same pattern as org-service, project-service,
 * user-service). Production wires the real `pg.Pool` from the docker-compose
 * Postgres stack.
 *
 * Tenant boundary: every WHERE clause includes org_id. Same pattern as
 * the other services — defense in depth.
 */

interface FakeResult<R> { rows: R[]; rowCount: number; }

function makeFakePg() {
 const executed: Array<{ sql: string; params: readonly unknown[] }> = [];
 let insertShouldFail = false;
 return {
 executed,
 setInsertShouldFail(v: boolean) { insertShouldFail = v; },
 client: {
 async query<R extends Record<string, unknown> = Record<string, unknown>>(
 sql: string,
 params: readonly unknown[] = [],
 ): Promise<FakeResult<R>> {
 executed.push({ sql: sql.trim().toLowerCase().replace(/\s+/g, ' '), params });
 // Return shaped result based on the query type
 if (sql.toLowerCase().includes('insert into captures') && insertShouldFail) {
 const err = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
 throw err;
 }
 if (sql.toLowerCase().includes('insert into captures')) {
 return { rows: [], rowCount: 1 } as FakeResult<R>;
 }
 if (sql.toLowerCase().includes('insert into upload_sessions')) {
 return { rows: [], rowCount: 1 } as FakeResult<R>;
 }
 return { rows: [], rowCount: 0 } as FakeResult<R>;
 },
 } as unknown as PgClient,
 };
}

let repo: PostgresCaptureRepository;
let fake: ReturnType<typeof makeFakePg>;

beforeEach(() => {
 fake = makeFakePg();
 repo = new PostgresCaptureRepository({ pg: fake.client });
});

const now = new Date('2026-08-14T00:00:00Z');

const SAMPLE_CAPTURE: Capture = {
 id: 'cap_001',
 orgId: 'org_a',
 projectId: 'prj_1',
 clientCaptureId: 'cli_001',
 kind: 'walkthrough_360',
 status: 'uploading',
 deviceModel: null,
 deviceOsVersion: null,
 startedAt: now,
 finalizedAt: null,
 totalChunks: null,
 sha256: null,
 errorMessage: null,
 createdAt: now,
 updatedAt: now,
};

const SAMPLE_SESSION: UploadSession = {
 id: 'upl_001',
 captureId: 'cap_001',
 orgId: 'org_a',
 projectId: 'prj_1',
 chunkSizeBytes: 8 * 1024 * 1024,
 totalChunks: 0,
 receivedChunks: [],
 status: 'uploading',
 expiresAt: new Date('2026-08-14T15:00:00Z'),
 createdAt: now,
 updatedAt: now,
};

describe('PostgresCaptureRepository — insert capture', () => {
 it('issues INSERT with parameterized org_id, project_id, client_capture_id', async () => {
 await repo.insertCapture(SAMPLE_CAPTURE);
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /insert into captures/);
 assert.equal(exec.params[0], 'cap_001');
 assert.equal(exec.params[1], 'org_a');
 assert.equal(exec.params[2], 'prj_1');
 assert.equal(exec.params[3], 'cli_001');
 });

 it('throws UniqueViolationError on duplicate (projectId, clientCaptureId)', async () => {
 fake.setInsertShouldFail(true);
 await assert.rejects(
 repo.insertCapture(SAMPLE_CAPTURE),
 /duplicate/i,
 );
 });
});

describe('PostgresCaptureRepository — insert upload session', () => {
 it('issues INSERT into upload_sessions with org_id first', async () => {
 await repo.insertUploadSession(SAMPLE_SESSION);
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /insert into upload_sessions/);
 // First param must be orgId (tenant boundary)
 assert.equal(exec.params[0], 'org_a');
 assert.equal(exec.params[1], 'upl_001');
 });
});

describe('PostgresCaptureRepository — recordChunkReceived uses array_append', () => {
 it('uses SQL CASE WHEN for idempotent array append', async () => {
 await repo.recordChunkReceived('org_a', 'upl_001', 5);
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /update upload_sessions/);
 assert.match(exec.sql, /received_chunks/);
 assert.match(exec.sql, /when .* = any/);
 assert.equal(exec.params[2], 5); // chunkIndex is 3rd positional
 });

 it('tenant-scoped UPDATE (WHERE org_id = $1 AND id = $2)', async () => {
 await repo.recordChunkReceived('org_a', 'upl_001', 0);
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /where org_id = \$1 and id = \$2/);
 });
});
