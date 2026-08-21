/**
 * E2E integration tests for admin-service org + project CRUD.
 *
 * These tests run against a live admin-service started with InMemoryAdminRepository.
 * They exercise the public HTTP seam (Fastify inject) the way the dashboard
 * Next.js proxy hits it.
 *
 * Tests follow TDD: each `it()` describes a user-facing behavior, the assertion
 * comes from an independent source (the response body itself, not a recompute).
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

const ADMIN_AUTH = { authorization: 'Bearer admin:super:usr_test' };
const IDEM = (key: string) => ({ 'idempotency-key': key });
const rid = () => Math.random().toString(36).slice(2, 12);

let server: StartedServer;
let baseUrl: string;

before(async () => {
 server = await startInMemoryServer({ port: 0 });
 const port = server.port;
 baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
 await server.stop();
});

// ─── ORG CRUD ──────────────────────────────────────────────────────

test('CRUD: create org → get → update → suspend → resume → delete', async () => {
 const name = `E2E Org ${rid()}`;
 const idemKey = `e2e-org-${rid()}`;

 // CREATE
 const createHeaders = { 'content-type': 'application/json', ...ADMIN_AUTH, 'x-idempotency-key': idemKey };
 const createRes = await fetch(`${baseUrl}/v1/admin/tenants`, {
 method: 'POST',
 headers: createHeaders,
 body: JSON.stringify({ name, region: 'us-east', plan: 'pro' }),
 });
 const errText = createRes.status !== 201 ? await createRes.text() : '';
 assert.equal(createRes.status, 201, `create returned ${createRes.status}: ${errText}`);
 const created: any = await createRes.json();
 assert.equal(created.name, name);
 assert.equal(created.region, 'us-east');
 assert.equal(created.plan, 'pro');
 assert.equal(created.status, 'active');
 assert.ok(created.id.startsWith('org_'));
 const orgId = created.id;

 // GET
 const getRes = await fetch(`${baseUrl}/v1/admin/tenants/${orgId}`, {
 headers: ADMIN_AUTH,
 });
 assert.equal(getRes.status, 200);
 const fetched: any = await getRes.json();
 assert.equal(fetched.id, orgId);
 assert.equal(fetched.name, name);

 // PATCH
 const patchRes = await fetch(`${baseUrl}/v1/admin/tenants/${orgId}`, {
 method: 'PATCH',
 headers: { 'content-type': 'application/json', ...ADMIN_AUTH, 'x-idempotency-key': `patch-${idemKey}` },
 body: JSON.stringify({ name: 'E2E Org Renamed', plan: 'enterprise' }),
 });
 assert.equal(patchRes.status, 200);
 const patched: any = await patchRes.json();
 assert.equal(patched.name, 'E2E Org Renamed');
 assert.equal(patched.plan, 'enterprise');

 // SUSPEND
 const suspendRes = await fetch(`${baseUrl}/v1/admin/tenants/${orgId}/suspend`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...ADMIN_AUTH, 'x-idempotency-key': `susp-${idemKey}` },
 body: JSON.stringify({}),
 });
 assert.equal(suspendRes.status, 200);
 const suspended: any = await suspendRes.json();
 assert.equal(suspended.status, 'suspended');

 // RESUME
 const resumeRes = await fetch(`${baseUrl}/v1/admin/tenants/${orgId}/resume`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...ADMIN_AUTH, 'x-idempotency-key': `res-${idemKey}` },
 body: JSON.stringify({}),
 });
 assert.equal(resumeRes.status, 200);
 const resumed: any = await resumeRes.json();
 assert.equal(resumed.status, 'active');

 // DELETE
 const deleteRes = await fetch(`${baseUrl}/v1/admin/tenants/${orgId}`, {
 method: 'DELETE',
 headers: { ...ADMIN_AUTH, 'x-idempotency-key': `del-${idemKey}` },
 });
 assert.equal(deleteRes.status, 204);

 // VERIFY GONE
 const verifyRes = await fetch(`${baseUrl}/v1/admin/tenants/${orgId}`, {
 headers: ADMIN_AUTH,
 });
 assert.equal(verifyRes.status, 404);
});

test('CRUD: rejects unknown org with 404', async () => {
 const res = await fetch(`${baseUrl}/v1/admin/tenants/org_does_not_exist_${rid()}`, {
 headers: ADMIN_AUTH,
 });
 assert.equal(res.status, 404);
});

test('CRUD: missing idempotency-key returns 400', async () => {
 const res = await fetch(`${baseUrl}/v1/admin/tenants`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...ADMIN_AUTH },
 body: JSON.stringify({ name: 'No Idemp', region: 'US', plan: 'pro' }),
 });
 assert.equal(res.status, 400);
 const body: any = await res.json();
 assert.match(body.title, /Idempotency/);
});

test('CRUD: missing auth returns 401', async () => {
 const res = await fetch(`${baseUrl}/v1/admin/tenants`, { method: 'GET' });
 assert.equal(res.status, 401);
});

// ─── PROJECT CRUD ──────────────────────────────────────────────────

test('PROJECTS: create → list → get → update → delete', async () => {
 const tenantId = 'org_a';
 const projectName = `E2E Project ${rid()}`;

 // CREATE
 const createRes = await fetch(`${baseUrl}/v1/admin/tenants/${tenantId}/projects`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...ADMIN_AUTH, 'x-idempotency-key': `proj-${rid()}` },
 body: JSON.stringify({ name: projectName, location: 'Boston', type: 'residential' }),
 });
 const errTxt = createRes.status !== 201 ? await createRes.text() : '';
 assert.equal(createRes.status, 201, `create returned ${createRes.status}: ${errTxt}`);
 const created: any = await createRes.json();
 assert.equal(created.name, projectName);
 assert.equal(created.tenantId, tenantId);
 assert.equal(created.location, 'Boston');
 assert.equal(created.type, 'residential');
 assert.equal(created.status, 'planning');
 const projectId = created.id;

 // LIST
 const listRes = await fetch(`${baseUrl}/v1/admin/tenants/${tenantId}/projects`, {
 headers: ADMIN_AUTH,
 });
 assert.equal(listRes.status, 200);
 const list: any = await listRes.json();
 assert.ok(Array.isArray(list.data));
 assert.ok(list.data.find((p: any) => p.id === projectId));

 // PATCH
 const patchRes = await fetch(`${baseUrl}/v1/admin/tenants/${tenantId}/projects/${projectId}`, {
 method: 'PATCH',
 headers: { 'content-type': 'application/json', ...ADMIN_AUTH, 'x-idempotency-key': `p-${rid()}` },
 body: JSON.stringify({ name: 'Renamed', status: 'active', progressPct: 50 }),
 });
 assert.equal(patchRes.status, 200);
 const patched: any = await patchRes.json();
 assert.equal(patched.name, 'Renamed');
 assert.equal(patched.status, 'active');
 assert.equal(patched.progressPct, 50);

 // DELETE
 const deleteRes = await fetch(`${baseUrl}/v1/admin/tenants/${tenantId}/projects/${projectId}`, {
 method: 'DELETE',
 headers: { ...ADMIN_AUTH, 'x-idempotency-key': `d-${rid()}` },
 });
 assert.equal(deleteRes.status, 204);

 // VERIFY
 const listRes2 = await fetch(`${baseUrl}/v1/admin/tenants/${tenantId}/projects`, {
 headers: ADMIN_AUTH,
 });
 const list2: any = await listRes2.json();
 assert.equal(list2.data.find((p: any) => p.id === projectId), undefined);
});

test('PROJECTS: missing idempotency-key on create returns 400', async () => {
 const res = await fetch(`${baseUrl}/v1/admin/tenants/org_a/projects`, {
 method: 'POST',
 headers: { 'content-type': 'application/json', ...ADMIN_AUTH },
 body: JSON.stringify({ name: 'No Idem', location: 'X', type: 'residential' }),
 });
 assert.equal(res.status, 400);
});

// ─── CORS ──────────────────────────────────────────────────────────

test('CORS: preflight OPTIONS returns 204 with allowed headers', async () => {
 const res = await fetch(`${baseUrl}/v1/admin/tenants`, {
 method: 'OPTIONS',
 headers: {
 origin: 'http://localhost:3000',
 'access-control-request-method': 'POST',
 'access-control-request-headers': 'content-type,idempotency-key',
 },
 });
 assert.equal(res.status, 204);
 assert.ok(res.headers.get('access-control-allow-methods')?.includes('POST'));
 assert.ok(res.headers.get('access-control-allow-headers')?.includes('idempotency-key'));
});
