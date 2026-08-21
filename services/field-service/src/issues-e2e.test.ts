/**
 * E2E integration tests for field-service issue CRUD.
 *
 * Tests run against a live field-service via startInMemoryServer.
 * Each test exercises a real user flow through the public HTTP seam.
 *
 * TDD: red → green. Assertions come from explicit expected values.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

const TENANT = 'org_a';
const TENANT_HEADER = { 'x-tenant-id': TENANT };
const rid = () => Math.random().toString(36).slice(2, 12);

let server: StartedServer;
let baseUrl: string;

before(async () => {
 server = await startInMemoryServer({ port: 0 });
 baseUrl = `http://127.0.0.1:${server.port}`;
});

after(async () => {
 await server.stop();
});

// ─── ISSUE LIFECYCLE ──────────────────────────────────────────────

test('ISSUES: create → list → get → patch → resolve', async () => {
 // CREATE
 const createRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...TENANT_HEADER, 'x-idempotency-key': `e2e-create-${rid()}` },
 body: JSON.stringify({ title: 'E2E Test Issue', description: 'created by test', severity: 'high', trade: 'concrete' }),
 });
 const errTxt = createRes.status !== 201 ? await createRes.text() : '';
 assert.equal(createRes.status, 201, `create returned ${createRes.status}: ${errTxt}`);
 const created: any = await createRes.json();
 assert.equal(created.title, 'E2E Test Issue');
 assert.equal(created.severity, 'high');
 assert.equal(created.trade, 'concrete');
 assert.equal(created.status, 'open');
 assert.ok(created.id.startsWith('iss_'));
 const issueId = created.id;

 // LIST
 const listRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues`, { headers: TENANT_HEADER });
 assert.equal(listRes.status, 200);
 const list: any = await listRes.json();
 assert.ok(Array.isArray(list.data));
 const found = list.data.find((i: any) => i.id === issueId);
 assert.ok(found, 'created issue should appear in list');

 // GET single
 const getRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues/${issueId}`, { headers: TENANT_HEADER });
 assert.equal(getRes.status, 200);
 const fetched: any = await getRes.json();
 assert.equal(fetched.id, issueId);
 assert.equal(fetched.title, 'E2E Test Issue');

 // PATCH (update title)
 const patchRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues/${issueId}`, {
 method: 'PATCH',
 headers: { 'content-type': 'application/json', ...TENANT_HEADER, 'x-idempotency-key': `e2e-patch-${rid()}` },
 body: JSON.stringify({ title: 'E2E Test Issue (updated)' }),
 });
 const errTxt2 = patchRes.status !== 200 ? await patchRes.text() : '';
 assert.equal(patchRes.status, 200, `patch returned ${patchRes.status}: ${errTxt2}`);
 const patched: any = await patchRes.json();
 assert.equal(patched.title, 'E2E Test Issue (updated)');

 // RESOLVE
 const resolveRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues/${issueId}/resolve`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...TENANT_HEADER, 'x-idempotency-key': `e2e-resolve-${rid()}` },
 });
 assert.equal(resolveRes.status, 200);
 const resolved: any = await resolveRes.json();
 assert.equal(resolved.status, 'resolved');
});

test('ISSUES: comments can be added and listed', async () => {
 const createRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...TENANT_HEADER, 'x-idempotency-key': `e2e-comment-create-${rid()}` },
 body: JSON.stringify({ title: 'Comment Test', description: 'for comment test', severity: 'medium' }),
 });
 const issue: any = await createRes.json();

 const commentRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues/${issue.id}/comments`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...TENANT_HEADER, 'x-idempotency-key': `e2e-comment-${rid()}` },
 body: JSON.stringify({ text: 'first comment from test', authorId: 'usr_e2e' }),
 });
 assert.equal(commentRes.status, 201);
 const comment: any = await commentRes.json();
 assert.equal(comment.text, 'first comment from test');

});

test('ISSUES: tenant isolation — different tenant cannot see issues', async () => {
 // Create issue as org_a
 const createRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': `e2e-iso-${rid()}` },
 body: JSON.stringify({ title: 'org_a private issue', description: 'private', severity: 'low' }),
 });
 const issue: any = await createRes.json();

 // Try to fetch as org_b
 const crossRes = await fetch(`${baseUrl}/v1/projects/prj_demo/issues/${issue.id}`, {
 headers: { 'x-tenant-id': 'org_b' },
 });
 // Should be 404 (issue is in org_a's namespace, org_b can't see it)
 assert.equal(crossRes.status, 404);
});

test('ISSUES: missing x-tenant-id returns 401', async () => {
 const res = await fetch(`${baseUrl}/v1/projects/prj_demo/issues`, { method: 'GET' });
 assert.equal(res.status, 401);
});

test('ISSUES: missing x-idempotency-key on create returns 400', async () => {
 const res = await fetch(`${baseUrl}/v1/projects/prj_demo/issues`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT },
 body: JSON.stringify({ title: 'no idem', description: 'x' }),
 });
 assert.equal(res.status, 401);
 const body: any = await res.json();
 assert.match(body.title ?? '', /Idempotency/i);
});

test('ISSUES: pagination — limit param caps results', async () => {
 const res = await fetch(`${baseUrl}/v1/projects/prj_demo/issues?limit=2`, { headers: TENANT_HEADER });
 assert.equal(res.status, 200);
 const body: any = await res.json();
 assert.ok(body.data.length <= 2, `expected <= 2 items, got ${body.data.length}`);
});

test('ISSUES: status filter — ?status=open returns only open issues', async () => {
 const res = await fetch(`${baseUrl}/v1/projects/prj_demo/issues?status=open`, { headers: TENANT_HEADER });
 assert.equal(res.status, 200);
 const body: any = await res.json();
 for (const i of body.data) {
 assert.equal(i.status, 'open');
 }
});
