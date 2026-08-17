import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

describe('field-service CLI — end-to-end smoke (T-028)', () => {
 let started: StartedServer | null = null;

 afterEach(async () => {
 if (started) {
 await started.stop();
 started = null;
 }
 });

 it('boots in-memory server and serves /v1/health', async () => {
 started = await startInMemoryServer();
 assert.ok(started.port > 0);
 const res = await fetch(`http://127.0.0.1:${started.port}/v1/health`);
 assert.equal(res.status, 200);
 const body = await res.json();
 assert.equal(body.status, 'ok');
 });

 it('boots and serves /v1/projects/:projectId/issues POST', async () => {
 started = await startInMemoryServer();
 const res = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/issues`, {
 method: 'POST',
 headers: {
 'x-tenant-id': 'org_a',
 'x-idempotency-key': 'idem-e2e',
 'content-type': 'application/json',
 },
 body: JSON.stringify({ title: 'E2E test', description: 'd', severity: 'high', createdBy: 'u' }),
 });
 assert.equal(res.status, 201);
 const body = await res.json();
 assert.ok(body.id.startsWith('iss_'));
 });

 it('boots and serves /v1/projects/:projectId/issues GET (list)', async () => {
 started = await startInMemoryServer();
 // Create 2 issues
 for (let i = 1; i <= 2; i++) {
 await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/issues`, {
 method: 'POST',
 headers: {
 'x-tenant-id': 'org_a',
 'x-idempotency-key': `e2e-${i}`,
 'content-type': 'application/json',
 },
 body: JSON.stringify({ title: `Issue ${i}`, description: 'd', severity: 'low' }),
 });
 }
 const res = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/issues`, {
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.status, 200);
 const body = await res.json();
 assert.equal(body.data.length, 2);
 });

 it('cross-tenant probe returns 404 (no existence leak)', async () => {
 started = await startInMemoryServer();
 const create = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/issues`, {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i', 'content-type': 'application/json' },
 body: JSON.stringify({ title: 't', description: 'd', severity: 'low' }),
 });
 const issue = await create.json();
 const cross = await fetch(`http://127.0.0.1:${started.port}/v1/projects/prj_1/issues/${issue.id}`, {
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(cross.status, 404);
 });
});
