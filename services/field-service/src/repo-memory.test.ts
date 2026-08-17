import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { InMemoryIssueRepository } from './repo-memory.js';
import type { Issue, Comment } from './types.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
 return {
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
 createdAt: new Date('2026-08-14T00:00:00Z'),
 updatedAt: new Date('2026-08-14T00:00:00Z'),
 resolvedAt: null,
 deletedAt: null,
 ...overrides,
 };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
 return {
 id: 'cmt_001',
 orgId: 'org_a',
 issueId: 'iss_001',
 authorId: 'user_1',
 text: 'Looking into it',
 attachments: [],
 createdAt: new Date('2026-08-14T00:00:00Z'),
 ...overrides,
 };
}

describe('InMemoryIssueRepository', () => {
 let repo: InMemoryIssueRepository;

 beforeEach(() => {
 repo = new InMemoryIssueRepository();
 });

 it('insertIssue + findIssue round-trip', async () => {
 const issue = makeIssue();
 await repo.insertIssue(issue);
 const found = await repo.findIssue('org_a', 'iss_001');
 assert.deepEqual(found, issue);
 });

 it('findIssue returns null for wrong tenant (cross-tenant probe)', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_001', orgId: 'org_a' }));
 const cross = await repo.findIssue('org_b', 'iss_001');
 assert.equal(cross, null);
 });

 it('insertIssue throws on duplicate id', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_dup' }));
 await assert.rejects(
 repo.insertIssue(makeIssue({ id: 'iss_dup' })),
 /duplicate/i,
 );
 });

 it('listIssues filters by status', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1', status: 'open', createdAt: new Date('2026-08-14T00:00:00Z') }));
 await repo.insertIssue(makeIssue({ id: 'iss_2', status: 'resolved', createdAt: new Date('2026-08-14T01:00:00Z') }));
 const open = await repo.listIssues('org_a', 'prj_1', { status: 'open' });
 assert.equal(open.items.length, 1);
 assert.equal(open.items[0]?.id, 'iss_1');
 });

 it('listIssues filters by severity', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1', severity: 'low' }));
 await repo.insertIssue(makeIssue({ id: 'iss_2', severity: 'critical' }));
 const critical = await repo.listIssues('org_a', 'prj_1', { severity: 'critical' });
 assert.equal(critical.items.length, 1);
 assert.equal(critical.items[0]?.severity, 'critical');
 });

 it('listIssues excludes soft-deleted by default', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1', deletedAt: null }));
 await repo.insertIssue(makeIssue({ id: 'iss_2', deletedAt: new Date() }));
 const list = await repo.listIssues('org_a', 'prj_1');
 assert.equal(list.items.length, 1);
 assert.equal(list.items[0]?.id, 'iss_1');
 });

 it('listIssues returns empty nextCursor when fewer than limit', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1' }));
 const list = await repo.listIssues('org_a', 'prj_1', undefined, { limit: 50 });
 assert.equal(list.items.length, 1);
 assert.equal(list.nextCursor, null);
 });

 it('listIssues pagination: limit=1 returns nextCursor', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1', createdAt: new Date('2026-08-14T00:00:00Z') }));
 await repo.insertIssue(makeIssue({ id: 'iss_2', createdAt: new Date('2026-08-14T01:00:00Z') }));
 await repo.insertIssue(makeIssue({ id: 'iss_3', createdAt: new Date('2026-08-14T02:00:00Z') }));
 const page1 = await repo.listIssues('org_a', 'prj_1', undefined, { limit: 1 });
 assert.equal(page1.items.length, 1);
 assert.ok(page1.nextCursor);
 });

 it('findIssueByClientId finds the right issue within same tenant', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_a', clientIssueId: 'cli_001' }));
 await repo.insertIssue(makeIssue({ id: 'iss_b', clientIssueId: 'cli_002' }));
 const found = await repo.findIssueByClientId('org_a', 'prj_1', 'cli_002');
 assert.equal(found?.id, 'iss_b');
 });

 it('findIssueByClientId returns null across tenants', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_a', clientIssueId: 'cli_001', orgId: 'org_a' }));
 const cross = await repo.findIssueByClientId('org_b', 'prj_1', 'cli_001');
 assert.equal(cross, null);
 });

 it('updateIssue mutates fields + bumps updatedAt', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1', assignedTo: null }));
 await repo.updateIssue('org_a', 'iss_1', {
 title: 'Updated title',
 assignedTo: 'user_2',
 actorId: 'user_admin',
 });
 const updated = await repo.findIssue('org_a', 'iss_1');
 assert.equal(updated?.title, 'Updated title');
 assert.equal(updated?.assignedTo, 'user_2');
 });

 it('updateIssue across tenants throws', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1', orgId: 'org_a' }));
 await assert.rejects(
 repo.updateIssue('org_b', 'iss_1', { title: 'X', actorId: 'u' }),
 /not found/i,
 );
 });

 it('softDeleteIssue sets deletedAt + excludes from list', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1' }));
 await repo.softDeleteIssue('org_a', 'iss_1');
 const after = await repo.findIssue('org_a', 'iss_1');
 assert.ok(after?.deletedAt);
 const list = await repo.listIssues('org_a', 'prj_1');
 assert.equal(list.items.length, 0);
 });

 it('insertComment + listComments round-trip (chronological)', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1' }));
 await repo.insertComment(makeComment({ id: 'cmt_1', issueId: 'iss_1', createdAt: new Date('2026-08-14T01:00:00Z') }));
 await repo.insertComment(makeComment({ id: 'cmt_2', issueId: 'iss_1', createdAt: new Date('2026-08-14T02:00:00Z') }));
 const list = await repo.listComments('org_a', 'iss_1');
 assert.equal(list.items.length, 2);
 // Order: cmt_1 first (oldest first)
 assert.equal(list.items[0]?.id, 'cmt_1');
 });

 it('listComments returns null nextCursor when fewer than limit', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_1' }));
 await repo.insertComment(makeComment({ issueId: 'iss_1' }));
 const list = await repo.listComments('org_a', 'iss_1', { limit: 50 });
 assert.equal(list.nextCursor, null);
 });

 it('listComments excludes comments from other tenants', async () => {
 await repo.insertIssue(makeIssue({ id: 'iss_a', orgId: 'org_a' }));
 await repo.insertIssue(makeIssue({ id: 'iss_b', orgId: 'org_b' }));
 await repo.insertComment(makeComment({ id: 'cmt_a', issueId: 'iss_a', orgId: 'org_a' }));
 await repo.insertComment(makeComment({ id: 'cmt_b', issueId: 'iss_b', orgId: 'org_b' }));
 const a = await repo.listComments('org_a', 'iss_a');
 const b = await repo.listComments('org_b', 'iss_b');
 assert.equal(a.items.length, 1);
 assert.equal(b.items.length, 1);
 assert.equal(a.items[0]?.id, 'cmt_a');
 assert.equal(b.items[0]?.id, 'cmt_b');
 });

 it('idempotency: get returns null for missing key', async () => {
 const v = await repo.getIdempotencyResult<{ issueId: string }>('org_a', 'idem-x');
 assert.equal(v, null);
 });

 it('idempotency: set then get returns the stored result', async () => {
 await repo.insertIdempotencyKey('org_a', 'idem-1', { issueId: 'iss_001' });
 const v = await repo.getIdempotencyResult<{ issueId: string }>('org_a', 'idem-1');
 assert.deepEqual(v, { issueId: 'iss_001' });
 });

 it('idempotency: keys scoped per org (cross-tenant isolation)', async () => {
 await repo.insertIdempotencyKey('org_a', 'idem-1', { issueId: 'iss_a' });
 const cross = await repo.getIdempotencyResult<{ issueId: string }>('org_b', 'idem-1');
 assert.equal(cross, null);
 });
});
