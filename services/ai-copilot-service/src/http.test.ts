import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildCopilotServer } from './http.js';
import { InMemoryCopilotRepository } from './repo-memory.js';
import { InMemoryEventBus } from './realtime/index.js';

let app: FastifyInstance;

beforeEach(async () => {
 const repo = new InMemoryCopilotRepository();
 const bus = new InMemoryEventBus();
 app = await buildCopilotServer({
 repo,
 bus,
 routerDeps: {
 fetchFn: (async () => ({
 ok: true, status: 200,
 json: async () => ({ items: [], total: 0 }),
 } as unknown as Response)) as typeof fetch,
 captureServiceUrl: 'http://capture',
 fieldServiceUrl: 'http://field',
 bimViewerServiceUrl: 'http://bim',
 },
 });
});

describe('AI Copilot HTTP — POST .../messages (FR-1)', () => {
 it('201 on first submit', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/conversations//messages', // empty convoId → new
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { text: 'show all issues', projectId: 'prj_1' },
 });
 assert.equal(res.statusCode, 201);
 const body = res.json();
 assert.ok(body.reply.id.startsWith('msg_'));
 assert.equal(body.reply.role, 'assistant');
 });

 it('401 when tenant missing', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-idempotency-key': 'i' },
 payload: { text: 'x', projectId: 'p' },
 });
 assert.equal(res.statusCode, 401);
 });

 it('400 when Idempotency-Key missing', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a' },
 payload: { text: 'x', projectId: 'p' },
 });
 assert.equal(res.statusCode, 400);
 });

 it('400 when text missing', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { projectId: 'p' },
 });
 assert.equal(res.statusCode, 400);
 });

 it('returns problem+json on error', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a' },
 payload: {},
 });
 assert.match(res.headers['content-type'], /application\/problem\+json/);
 });
});

describe('AI Copilot HTTP — GET .../messages/:id (FR-2)', () => {
 it('200 with conversation + messages when found', async () => {
 const create = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { text: 'show all issues', projectId: 'prj_1' },
 });
 const convId = create.json().reply.conversationId;
 const res = await app.inject({ method: 'GET', url: `/v1/conversations/${convId}`, headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.equal(body.id, convId);
 assert.ok(Array.isArray(body.messages));
 });

 it('404 on cross-tenant probe', async () => {
 const create = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { text: 'x', projectId: 'prj_1' },
 });
 const convId = create.json().reply.conversationId;
 const res = await app.inject({ method: 'GET', url: `/v1/conversations/${convId}`, headers: { 'x-tenant-id': 'org_b' } });
 assert.equal(res.statusCode, 404);
 });

 it('404 on non-existent conversation', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/conversations/conv_nonexistent', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 404);
 });
});

describe('AI Copilot HTTP — GET /v1/conversations (FR-3)', () => {
 it('200 with data array', async () => {
 await app.inject({ method: 'POST', url: '/v1/conversations//messages', headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i1' }, payload: { text: 'q1', projectId: 'p' } });
 await app.inject({ method: 'POST', url: '/v1/conversations//messages', headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i2' }, payload: { text: 'q2', projectId: 'p' } });
 const res = await app.inject({ method: 'GET', url: '/v1/conversations?userId=default', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.ok(Array.isArray(body.data));
 assert.equal(body.data.length >= 1, true);
 });

 it('400 when userId query missing', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/conversations', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 400);
 });
});

describe('AI Copilot HTTP — POST .../messages/:id/pin (FR-8)', () => {
 it('200 with pinned: true', async () => {
 const create = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { text: 'show issues', projectId: 'p' },
 });
 const convId = create.json().reply.conversationId;
 const msgId = create.json().reply.id;
 const res = await app.inject({ method: 'POST', url: `/v1/conversations/${convId}/messages/${msgId}/pin`, headers: { 'x-tenant-id': 'org_a' }, payload: { pinned: true } });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().pinned, true);
 });

 it('200 with pinned: false (unpin)', async () => {
 const create = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { text: 'show issues', projectId: 'p' },
 });
 const convId = create.json().reply.conversationId;
 const msgId = create.json().reply.id;
 const res = await app.inject({ method: 'POST', url: `/v1/conversations/${convId}/messages/${msgId}/pin`, headers: { 'x-tenant-id': 'org_a' }, payload: { pinned: false } });
 assert.equal(res.statusCode, 200);
 });
});

describe('AI Copilot HTTP — /v1/health', () => {
 it('200 OK', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/health' });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'ok');
 });
});

describe('AI Copilot HTTP — SSE (FR-7)', () => {
 it('SSE returns text/event-stream content-type', async () => {
 const create = await app.inject({
 method: 'POST', url: '/v1/conversations//messages',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { text: 'x', projectId: 'p' },
 });
 const convId = create.json().reply.conversationId;
 const res = await app.inject({ method: 'GET', url: `/v1/conversations/${convId}/events?once=1`, headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 assert.match(res.headers['content-type'], /text\/event-stream/);
 });

 it('SSE returns 401 when tenant missing', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/conversations/conv_001/events' });
 assert.equal(res.statusCode, 401);
 });
});
