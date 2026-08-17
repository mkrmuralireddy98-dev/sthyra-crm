import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

describe('track-service CLI — end-to-end smoke', () => {
 let started: StartedServer | null = null;

 afterEach(async () => {
 if (started) {
 await started.stop();
 started = null;
 }
 });

 it('boots and serves /v1/health', async () => {
 started = await startInMemoryServer();
 assert.ok(started.port > 0);
 const res = await fetch('http://127.0.0.1:' + started.port + '/v1/health');
 assert.equal(res.status, 200);
 const body = await res.json();
 assert.equal(body.status, 'ok');
 });

 it('boots and creates a milestone via real HTTP', async () => {
 started = await startInMemoryServer();
 const res = await fetch('http://127.0.0.1:' + started.port + '/v1/projects/prj_1/milestones', {
 method: 'POST',
 headers: {
 'x-tenant-id': 'org_a',
 'x-idempotency-key': 'i1',
 'content-type': 'application/json',
 },
 body: JSON.stringify({ name: 'm1', plannedDate: new Date(Date.now() + 86400000).toISOString() }),
 });
 assert.equal(res.status, 201);
 const body = await res.json();
 assert.ok(body.milestoneId.startsWith('ms_'));
 });

 it('401 without tenant header', async () => {
 started = await startInMemoryServer();
 const res = await fetch('http://127.0.0.1:' + started.port + '/v1/projects/prj_1/milestones', {
 method: 'POST',
 headers: { 'x-idempotency-key': 'i', 'content-type': 'application/json' },
 body: JSON.stringify({ name: 'm', plannedDate: new Date().toISOString() }),
 });
 assert.equal(res.status, 401);
 });
});
