import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { PostgresIssueRepository, type PgClient } from './postgres-repo.js';
import type { Issue, Comment } from './types.js';

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
 executed.push({ sql: sql.trim().toLowerCase().replace(/\\s+/g, ' '), params });
 if (sql.toLowerCase().includes('insert into issues') && insertShouldFail) {
 const err = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
 throw err;
 }
 if (sql.toLowerCase().includes('insert into issues')) {
 return { rows: [], rowCount: 1 } as FakeResult<R>;
 }
 if (sql.toLowerCase().includes('insert into comments')) {
 return { rows: [], rowCount: 1 } as FakeResult<R>;
 }
 return { rows: [], rowCount: 0 } as FakeResult<R>;
 },
 } as unknown as PgClient,
 };
}

let repo: PostgresIssueRepository;
let fake: ReturnType<typeof makeFakePg>;

beforeEach(() => {
 fake = makeFakePg();
 repo = new PostgresIssueRepository({ pg: fake.client });
});

const now = new Date('2026-08-14T00:00:00Z');

const SAMPLE_ISSUE: Issue = {
 id: 'iss_001',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: null,
 clientIssueId: null,
 title: 'Test issue',
 description: 'desc',
 severity: 'medium',
 status: 'open',
 assignedTo: null,
 coordinates: null,
 dueDate: null,
 createdBy: 'user_1',
 createdAt: now,
 updatedAt: now,
 resolvedAt: null,
 deletedAt: null,
};

describe('PostgresIssueRepository — insert issue', () => {
 it('issues INSERT into issues with parameterized org_id first', async () => {
 await repo.insertIssue(SAMPLE_ISSUE);
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /insert into issues/);
 assert.equal(exec.params[0], 'iss_001');
 assert.equal(exec.params[1], 'org_a');
 });

 it('throws UniqueViolationError on duplicate id (23505)', async () => {
 fake.setInsertShouldFail(true);
 await assert.rejects(
 repo.insertIssue(SAMPLE_ISSUE),
 /duplicate/i,
 );
 });
});

describe('PostgresIssueRepository — findIssue', () => {
 it('uses WHERE org_id = $1 AND id = $2 (tenant boundary)', async () => {
 await repo.findIssue('org_a', 'iss_001');
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /where org_id = \$1 and id = \$2/);
 });
});

describe('PostgresIssueRepository — listIssues filters', () => {
 it('listIssues WHERE clause starts with org_id + project_id', async () => {
 await repo.listIssues('org_a', 'prj_1');
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /where org_id = \$1 and project_id = \$2/);
 });

 it('listIssues excludes soft-deleted (deleted_at IS NULL)', async () => {
 await repo.listIssues('org_a', 'prj_1');
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /deleted_at is null/);
 });

 it('listIssues status filter is parameterized', async () => {
 await repo.listIssues('org_a', 'prj_1', { status: 'resolved' });
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /and status = \$3/);
 });
});

describe('PostgresIssueRepository — insertComment', () => {
 it('insertComment uses parameterized org_id first', async () => {
 const c: Comment = {
 id: 'cmt_001', orgId: 'org_a', issueId: 'iss_001', authorId: 'u',
 text: 'Looking into it', attachments: [], createdAt: now,
 };
 await repo.insertComment(c);
 const exec = fake.executed[0]!;
 assert.match(exec.sql, /insert into comments/);
 assert.equal(exec.params[0], 'cmt_001');
 assert.equal(exec.params[1], 'org_a');
 });
});
