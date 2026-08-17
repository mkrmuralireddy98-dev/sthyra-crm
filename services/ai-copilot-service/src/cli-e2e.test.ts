import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

describe('ai-copilot-service CLI — end-to-end smoke', () => {
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

 it('boots and submits a question', async () => {
 started = await startInMemoryServer();
 const res = await fetch('http://127.0.0.1:' + started.port + '/v1/conversations//messages', {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i', 'content-type': 'application/json' },
 body: JSON.stringify({ text: 'show all issues', projectId: 'prj_1' }),
 });
 assert.equal(res.status, 201);
 const body = await res.json();
 assert.ok(body.reply.id.startsWith('msg_'));
 assert.ok(body.reply.text.length > 0);
 });

 it('lists conversations for userId', async () => {
 started = await startInMemoryServer();
 await fetch('http://127.0.0.1:' + started.port + '/v1/conversations//messages', {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i1', 'content-type': 'application/json' },
 body: JSON.stringify({ text: 'q1', projectId: 'p' }),
 });
 const res = await fetch('http://127.0.0.1:' + started.port + '/v1/conversations?userId=default', {
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.status, 200);
 const body = await res.json();
 assert.ok(Array.isArray(body.data));
 assert.ok(body.data.length >= 1);
 });

 it('cross-tenant probe returns 404', async () => {
 started = await startInMemoryServer();
 const create = await fetch('http://127.0.0.1:' + started.port + '/v1/conversations//messages', {
 method: 'POST',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i', 'content-type': 'application/json' },
 body: JSON.stringify({ text: 'x', projectId: 'p' }),
 });
 const convId = (await create.json()).reply.conversationId;
 const cross = await fetch('http://127.0.0.1:' + started.port + '/v1/conversations/' + convId, {
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(cross.status, 404);
 });
});
