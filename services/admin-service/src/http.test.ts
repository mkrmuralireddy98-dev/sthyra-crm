import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminServer } from './http.js';

async function setup() {
 const app = await buildAdminServer();
 return { app };
}

async function withAdmin(app: any, method: string, url: string, body?: any) {
 return app.inject({
 method,
 url,
 headers: {
 'authorization': 'Bearer admin:super:usr_test_admin',
 'x-idempotency-key': 'test-' + Math.random().toString(36).slice(2, 10),
 ...(body ? { 'content-type': 'application/json' } : {}),
 },
 payload: body,
 });
}

async function withoutAuth(app: any, method: string, url: string) {
 return app.inject({ method, url });
}

test('GET /v1/health returns ok', async () => {
 const { app } = await setup();
 const res = await withoutAuth(app, 'GET', '/v1/health');
 assert.equal(res.statusCode, 200);
 const body = JSON.parse(res.body);
 assert.equal(body.status, 'ok');
});

test('admin endpoint requires auth', async () => {
 const { app } = await setup();
 const res = await withoutAuth(app, 'GET', '/v1/admin/tenants');
 assert.equal(res.statusCode, 401);
});

test('admin endpoint rejects non-admin token', async () => {
 const { app } = await setup();
 const res = await app.inject({
 method: 'GET',
 url: '/v1/admin/tenants',
 headers: { 'authorization': 'Bearer not-an-admin-token' },
 });
 assert.equal(res.statusCode, 401);
});

test('list tenants returns 3 seed tenants', async () => {
 const { app } = await setup();
 const res = await withAdmin(app, 'GET', '/v1/admin/tenants');
 assert.equal(res.statusCode, 200);
 const body = JSON.parse(res.body);
 assert.ok(body.data.length >= 3);
});

test('create tenant returns 201 with org_ id', async () => {
 const { app } = await setup();
 const res = await withAdmin(app, 'POST', '/v1/admin/tenants', {
 name: 'New Tenant', region: 'us-east', plan: 'pro',
 });
 assert.equal(res.statusCode, 201);
 const body = JSON.parse(res.body);
 assert.match(body.id, /^org_/);
});

test('create tenant without Idempotency-Key returns 400', async () => {
 const { app } = await setup();
 const res = await app.inject({
 method: 'POST',
 url: '/v1/admin/tenants',
 headers: {
 'authorization': 'Bearer admin:super:usr_test',
 'content-type': 'application/json',
 },
 payload: { name: 'X', region: 'us-east', plan: 'pro' },
 });
 assert.equal(res.statusCode, 400);
});

test('suspend then resume tenant toggles status', async () => {
 const { app } = await setup();
 const suspendRes = await withAdmin(app, 'POST', '/v1/admin/tenants/org_a/suspend');
 assert.equal(suspendRes.statusCode, 200);
 const body1 = JSON.parse(suspendRes.body);
 assert.equal(body1.status, 'suspended');

 const resumeRes = await withAdmin(app, 'POST', '/v1/admin/tenants/org_a/resume');
 assert.equal(resumeRes.statusCode, 200);
 const body2 = JSON.parse(resumeRes.body);
 assert.equal(body2.status, 'active');
});

test('list users works with admin auth', async () => {
 const { app } = await setup();
 const res = await withAdmin(app, 'GET', '/v1/admin/users');
 assert.equal(res.statusCode, 200);
});

test('force logout returns ok', async () => {
 const { app } = await setup();
 const res = await withAdmin(app, 'POST', '/v1/admin/users/usr_admin/logout');
 assert.equal(res.statusCode, 200);
});

test('reset password returns one-time password', async () => {
 const { app } = await setup();
 const res = await withAdmin(app, 'POST', '/v1/admin/users/usr_admin/reset-password');
 assert.equal(res.statusCode, 200);
 const body = JSON.parse(res.body);
 assert.match(body.oneTimePassword, /^otp_/);
});

test('audit log shows admin actions', async () => {
 const { app } = await setup();
 await withAdmin(app, 'POST', '/v1/admin/tenants/org_b/suspend');
 const res = await withAdmin(app, 'GET', '/v1/admin/audit');
 assert.equal(res.statusCode, 200);
 const body = JSON.parse(res.body);
 assert.ok(body.data.length >= 1);
});

test('feature flag toggle persists', async () => {
 const { app } = await setup();
 const res = await withAdmin(app, 'PUT', '/v1/admin/feature-flags/capture.gpu_acceleration', {
 tenantId: 'org_a', enabled: true,
 });
 assert.equal(res.statusCode, 200);
 const body = JSON.parse(res.body);
 assert.equal(body.overrides.org_a, true);
});

test('system health returns aggregated status', async () => {
 const { app } = await setup();
 const res = await withoutAuth(app, 'GET', '/v1/admin/health');
 assert.equal(res.statusCode, 200);
 const body = JSON.parse(res.body);
 assert.ok(body.services);
 assert.ok(body.status);
});

test('tenant stats returns counts', async () => {
 const { app } = await setup();
 const res = await withAdmin(app, 'GET', '/v1/admin/tenants/org_a/stats');
 assert.equal(res.statusCode, 200);
 const body = JSON.parse(res.body);
 assert.equal(body.tenantId, 'org_a');
});
