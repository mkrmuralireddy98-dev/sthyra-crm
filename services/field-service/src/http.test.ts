import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildFieldServer } from './http.js';

describe('HTTP layer — POST /v1/projects/:projectId/issues (T-014)', () => {
 let app: FastifyInstance;

 beforeEach(async () => {
 app = await buildFieldServer();
 });

 it('returns 201 on first create', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-1' },
 payload: { title: 'Test', description: 'd', severity: 'high', createdBy: 'u1' },
 });
 assert.equal(res.statusCode, 201);
 const body = res.json();
 assert.ok(body.id.startsWith('iss_'));
 assert.equal(body.status, 'open');
 });

 it('returns 201 (same shape) on idempotency-key replay', async () => {
 const headers = { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-replay' };
 const payload = { title: 'Test', description: 'd', severity: 'high', createdBy: 'u1' };
 const a = await app.inject({ method: 'POST', url: '/v1/projects/prj_1/issues', headers, payload });
 const b = await app.inject({ method: 'POST', url: '/v1/projects/prj_1/issues', headers, payload });
 assert.equal(a.statusCode, 201);
 assert.equal(b.statusCode, 201);
 assert.equal(a.json().id, b.json().id);
 });

 it('returns 409 on duplicate clientIssueId', async () => {
 const payload = { title: 't', description: 'd', severity: 'low', clientIssueId: 'cli_1', createdBy: 'u' };
 const a = await app.inject({ method: 'POST', url: '/v1/projects/prj_1/issues', headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-a' }, payload });
 const b = await app.inject({ method: 'POST', url: '/v1/projects/prj_1/issues', headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-b' }, payload });
 assert.equal(a.statusCode, 201);
 assert.equal(b.statusCode, 409);
 assert.equal(resToJson(b).code, 'duplicate_client_issue_id');
 });

 it('returns 401 when x-tenant-id header missing', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 assert.equal(res.statusCode, 401);
 });

 it('returns 400 when x-idempotency-key header missing', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 assert.equal(res.statusCode, 400);
 assert.equal(resToJson(res).code, 'missing_idempotency_key');
 });

 it('returns 400 when body is invalid (missing title)', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { description: 'd', severity: 'low' },
 });
 assert.equal(res.statusCode, 400);
 });

 it('returns 400 when severity is invalid', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'fatal' },
 });
 assert.equal(res.statusCode, 400);
 });

 it('returns problem+json content-type on errors', async () => {
 const res = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 assert.match(res.headers['content-type'], /application\/problem\+json/);
 const body = res.json();
 assert.ok(body.trace_id);
 assert.ok(body.code);
 });
});

describe('HTTP layer — GET /v1/projects/:projectId/issues (T-015)', () => {
 let app: FastifyInstance;

 beforeEach(async () => {
 app = await buildFieldServer();
 // seed
 for (let i = 1; i <= 3; i++) {
 await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { "x-tenant-id": "org_a", "x-idempotency-key": `idem-${i}` },
 payload: { title: `Issue ${i}`, description: 'd', severity: 'low' },
 });
 }
 });

 it('returns 200 with data array', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/issues', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.equal(body.data.length, 3);
 });

 it('filters by status', async () => {
 const created = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'extra' },
 payload: { title: '4', description: 'd', severity: 'low' },
 });
 const id = created.json().id;
 await app.inject({
 method: 'POST',
 url: `/v1/projects/prj_1/issues/${id}/resolve`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { actorId: 'u', resolutionNote: 'fixed' },
 });
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/issues?status=resolved', headers: { 'x-tenant-id': 'org_a' } });
 const body = res.json();
 assert.equal(body.data.length, 1);
 assert.equal(body.data[0]?.status, 'resolved');
 });

 it('returns 401 when x-tenant-id missing', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/issues' });
 assert.equal(res.statusCode, 401);
 });
});

describe('HTTP layer — GET /v1/projects/:projectId/issues/:id (T-016)', () => {
 let app: FastifyInstance;

 beforeEach(async () => {
 app = await buildFieldServer();
 });

 it('returns 200 with issue + timeline + comments', async () => {
 const create = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 const id = create.json().id;
 await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${id}/resolve`, headers: { 'x-tenant-id': 'org_a' }, payload: { actorId: 'u', resolutionNote: 'fixed' } });
 await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${id}/comments`, headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'c1' }, payload: { authorId: 'u', text: 'done' } });
 const res = await app.inject({ method: 'GET', url: `/v1/projects/prj_1/issues/${id}`, headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.equal(body.id, id);
 assert.equal(body.status, 'resolved');
 assert.ok(body.timeline);
 assert.equal(body.timeline.length, 1);
 assert.ok(body.comments);
 assert.equal(body.comments.length, 1);
 });

 it('returns 404 for cross-tenant probe (no existence leak)', async () => {
 const create = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 const id = create.json().id;
 const cross = await app.inject({ method: 'GET', url: `/v1/projects/prj_1/issues/${id}`, headers: { 'x-tenant-id': 'org_b' } });
 assert.equal(cross.statusCode, 404);
 });

 it('returns 404 for non-existent id', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/issues/iss_nonexistent', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 404);
 });
});

describe('HTTP layer — PATCH /v1/projects/:projectId/issues/:id (T-017)', () => {
 let app: FastifyInstance;
 let issueId: string;

 beforeEach(async () => {
 app = await buildFieldServer();
 const create = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 issueId = create.json().id;
 });

 it('updates title', async () => {
 const res = await app.inject({ method: 'PATCH', url: `/v1/projects/prj_1/issues/${issueId}`, headers: { 'x-tenant-id': 'org_a' }, payload: { title: 'New title', actorId: 'u' } });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().title, 'New title');
 });

 it('updates assignee to null (unassign)', async () => {
 const res = await app.inject({ method: 'PATCH', url: `/v1/projects/prj_1/issues/${issueId}`, headers: { 'x-tenant-id': 'org_a' }, payload: { assignedTo: null, actorId: 'u' } });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().assignedTo, null);
 });

 it('returns 404 for cross-tenant', async () => {
 const res = await app.inject({ method: 'PATCH', url: `/v1/projects/prj_1/issues/${issueId}`, headers: { 'x-tenant-id': 'org_b' }, payload: { title: 'x' } });
 assert.equal(res.statusCode, 404);
 });
});

describe('HTTP layer — POST comments / resolve / reopen (T-018)', () => {
 let app: FastifyInstance;
 let issueId: string;

 beforeEach(async () => {
 app = await buildFieldServer();
 const create = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 issueId = create.json().id;
 });

 it('POST /comments 201', async () => {
 const res = await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/comments`, headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'c1' }, payload: { authorId: 'u', text: 'comment' } });
 assert.equal(res.statusCode, 201);
 assert.ok(res.json().id.startsWith('cmt_'));
 });

 it('POST /comments 400 when missing Idempotency-Key', async () => {
 const res = await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/comments`, headers: { 'x-tenant-id': 'org_a' }, payload: { authorId: 'u', text: 'x' } });
 assert.equal(res.statusCode, 400);
 });

 it('POST /resolve 200', async () => {
 const res = await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/resolve`, headers: { 'x-tenant-id': 'org_a' }, payload: { actorId: 'u', resolutionNote: 'fixed' } });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'resolved');
 });

 it('POST /resolve 400 when resolutionNote missing', async () => {
 const res = await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/resolve`, headers: { 'x-tenant-id': 'org_a' }, payload: { actorId: 'u' } });
 assert.equal(res.statusCode, 400);
 });

 it('POST /reopen 200', async () => {
 await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/resolve`, headers: { 'x-tenant-id': 'org_a' }, payload: { actorId: 'u', resolutionNote: 'fixed' } });
 const res = await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/reopen`, headers: { 'x-tenant-id': 'org_a' }, payload: { actorId: 'u', reason: 'reopened' } });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'open');
 });

 it('POST /reopen 400 when reason missing', async () => {
 await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/resolve`, headers: { 'x-tenant-id': 'org_a' }, payload: { actorId: 'u', resolutionNote: 'fixed' } });
 const res = await app.inject({ method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/reopen`, headers: { 'x-tenant-id': 'org_a' }, payload: { actorId: 'u' } });
 assert.equal(res.statusCode, 400);
 });
});

describe('HTTP layer — health endpoint', () => {
 let app: FastifyInstance;

 beforeEach(async () => {
 app = await buildFieldServer();
 });

 it('GET /v1/health returns 200', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/health' });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'ok');
 });
});

function resToJson(res: { json: () => unknown }): { code: string; trace_id: string } {
 return res.json() as { code: string; trace_id: string };
}
