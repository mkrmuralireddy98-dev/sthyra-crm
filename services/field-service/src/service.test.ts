import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { IssueService, type IssueServiceDeps } from './service.js';
import { InMemoryIssueRepository } from './repo-memory.js';
import { InMemoryIdempotencyStore } from './in-memory-idempotency.js';
import type { CreateIssueInput } from './types.js';

function makeInput(overrides: Partial<CreateIssueInput> = {}): CreateIssueInput {
 return {
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: null,
 clientIssueId: null,
 title: 'Test issue',
 description: 'desc',
 severity: 'medium',
 assignedTo: null,
 coordinates: null,
 dueDate: null,
 createdBy: 'user_1',
 ...overrides,
 };
}

describe('IssueService — create (T-010)', () => {
 let repo: InMemoryIssueRepository;
 let idempotency: InMemoryIdempotencyStore;
 let events: Array<{ type: string; issueId: string }>;
 let service: IssueService;

 beforeEach(() => {
 repo = new InMemoryIssueRepository();
 idempotency = new InMemoryIdempotencyStore();
 events = [];
 const deps: IssueServiceDeps = {
 repo,
 idempotency,
 onEvent: (e) => {
 events.push({ type: e.type, issueId: e.issueId });
 },
 };
 service = new IssueService(deps);
 });

 it('create returns a new issue with server-assigned id', async () => {
 const result = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 assert.ok(result.id.startsWith('iss_'));
 assert.equal(result.status, 'open');
 });

 it('create emits issue.created event', async () => {
 await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 assert.equal(events.length, 1);
 assert.equal(events[0]?.type, 'issue.created');
 });

 it('create with same Idempotency-Key returns the same issue (replay)', async () => {
 const input = makeInput({ clientIssueId: 'cli-1' });
 const first = await service.create('org_a', 'prj_1', 'idem-replay', input);
 const second = await service.create('org_a', 'prj_1', 'idem-replay', input);
 assert.equal(first.id, second.id);
 // Only one event emitted (replay doesn't re-publish)
 assert.equal(events.length, 1);
 });

 it('create with different idempotency keys but same clientIssueId throws (duplicate)', async () => {
 const input = makeInput({ clientIssueId: 'cli-dup' });
 await service.create('org_a', 'prj_1', 'idem-A', input);
 await assert.rejects(
 service.create('org_a', 'prj_1', 'idem-B', input),
 /duplicate/i,
 );
 });

 it('create across tenants throws (orgId mismatch in input)', async () => {
 const input = makeInput({ orgId: 'org_b' });
 await assert.rejects(
 service.create('org_a', 'prj_1', 'idem-1', input),
 );
 });

 it('create without idempotency key throws', async () => {
 await assert.rejects(
 service.create('org_a', 'prj_1', '', makeInput()),
 );
 });
});

describe('IssueService — comment (T-012)', () => {
 let repo: InMemoryIssueRepository;
 let idempotency: InMemoryIdempotencyStore;
 let events: Array<{ type: string; issueId: string }>;
 let service: IssueService;

 beforeEach(() => {
 repo = new InMemoryIssueRepository();
 idempotency = new InMemoryIdempotencyStore();
 events = [];
 service = new IssueService({
 repo,
 idempotency,
 onEvent: (e) => { events.push({ type: e.type, issueId: e.issueId }); },
 });
 });

 it('comment returns a new comment with server-assigned id', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 const c = await service.comment('org_a', issue.id, 'idem-c1', {
 authorId: 'user_2',
 text: 'Looking into it',
 });
 assert.ok(c.id.startsWith('cmt_'));
 assert.equal(c.text, 'Looking into it');
 });

 it('comment emits issue.commented event', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 events.length = 0;
 await service.comment('org_a', issue.id, 'idem-c2', { authorId: 'user_2', text: 'x' });
 assert.equal(events.length, 1);
 assert.equal(events[0]?.type, 'issue.commented');
 });

 it('comment with same idempotency key returns same comment (replay)', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 const first = await service.comment('org_a', issue.id, 'idem-rep', { authorId: 'u', text: 'x' });
 const second = await service.comment('org_a', issue.id, 'idem-rep', { authorId: 'u', text: 'x' });
 assert.equal(first.id, second.id);
 });

 it('comment on non-existent issue throws', async () => {
 await assert.rejects(
 service.comment('org_a', 'iss_nonexistent', 'idem-c', { authorId: 'u', text: 'x' }),
 );
 });

 it('comment across tenants throws (cross-tenant)', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 await assert.rejects(
 service.comment('org_b', issue.id, 'idem-c', { authorId: 'u', text: 'x' }),
 );
 });
});

describe('IssueService — resolve + reopen (T-011)', () => {
 let repo: InMemoryIssueRepository;
 let idempotency: InMemoryIdempotencyStore;
 let events: Array<{ type: string; issueId: string }>;
 let service: IssueService;

 beforeEach(() => {
 repo = new InMemoryIssueRepository();
 idempotency = new InMemoryIdempotencyStore();
 events = [];
 service = new IssueService({
 repo,
 idempotency,
 onEvent: (e) => { events.push({ type: e.type, issueId: e.issueId }); },
 });
 });

 it('resolve transitions open → resolved + emits event', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 events.length = 0;
 const resolved = await service.resolve('org_a', issue.id, {
 actorId: 'user_1',
 resolutionNote: 'Verified fixed',
 });
 assert.equal(resolved.status, 'resolved');
 assert.equal(events.length, 1);
 assert.equal(events[0]?.type, 'issue.resolved');
 });

 it('resolve records status history', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 await service.resolve('org_a', issue.id, { actorId: 'user_1', resolutionNote: 'done' });
 const history = await repo.listStatusHistory('org_a', issue.id);
 assert.equal(history.length, 1);
 assert.equal(history[0]?.fromStatus, 'open');
 assert.equal(history[0]?.toStatus, 'resolved');
 });

 it('resolve requires resolutionNote (throws on empty)', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 await assert.rejects(
 service.resolve('org_a', issue.id, { actorId: 'u', resolutionNote: '' }),
 /resolution.*note/i,
 );
 });

 it('resolve across tenants throws', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 await assert.rejects(
 service.resolve('org_b', issue.id, { actorId: 'u', resolutionNote: 'x' }),
 );
 });

 it('reopen transitions resolved → open + clears resolvedAt + emits event', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 await service.resolve('org_a', issue.id, { actorId: 'u', resolutionNote: 'fixed' });
 events.length = 0;
 const reopened = await service.reopen('org_a', issue.id, {
 actorId: 'manager',
 reason: 'MEP still mismatched',
 });
 assert.equal(reopened.status, 'open');
 assert.equal(reopened.resolvedAt, null);
 assert.equal(events.length, 1);
 assert.equal(events[0]?.type, 'issue.reopened');
 });

 it('reopen requires reason (throws on empty)', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 await service.resolve('org_a', issue.id, { actorId: 'u', resolutionNote: 'fixed' });
 await assert.rejects(
 service.reopen('org_a', issue.id, { actorId: 'u', reason: '' }),
 /reason/i,
 );
 });
});

describe('IssueService — list with cursor pagination (T-013)', () => {
 let repo: InMemoryIssueRepository;
 let idempotency: InMemoryIdempotencyStore;
 let service: IssueService;

 beforeEach(() => {
 repo = new InMemoryIssueRepository();
 idempotency = new InMemoryIdempotencyStore();
 service = new IssueService({ repo, idempotency });
 });

 it('list returns empty nextCursor when fewer than limit', async () => {
 await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 const result = await service.list('org_a', 'prj_1', undefined, { limit: 50 });
 assert.equal(result.items.length, 1);
 assert.equal(result.nextCursor, null);
 });

 it('list with limit=1 returns nextCursor', async () => {
 for (let i = 1; i <= 3; i++) {
 await service.create(`org_a`, 'prj_1', `idem-${i}`, makeInput({ title: `Issue ${i}`, createdAt: new Date(`2026-08-14T0${i}:00:00Z`) }));
 }
 const page = await service.list('org_a', 'prj_1', undefined, { limit: 1 });
 assert.equal(page.items.length, 1);
 assert.ok(page.nextCursor);
 });

 it('list filters by status', async () => {
 await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 const issue2 = await service.create('org_a', 'prj_1', 'idem-2', makeInput());
 await service.resolve('org_a', issue2.id, { actorId: 'u', resolutionNote: 'fixed' });
 const resolved = await service.list('org_a', 'prj_1', { status: 'resolved' });
 assert.equal(resolved.items.length, 1);
 });

 it('list excludes soft-deleted issues', async () => {
 const issue = await service.create('org_a', 'prj_1', 'idem-1', makeInput());
 await repo.softDeleteIssue('org_a', issue.id);
 const result = await service.list('org_a', 'prj_1');
 assert.equal(result.items.length, 0);
 });
});
