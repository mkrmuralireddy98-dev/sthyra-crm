import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildFieldServer } from '../http.js';
import { InMemoryEventBus } from './index.js';

describe('Realtime — InMemoryEventBus (T-022)', () => {
 let bus: InMemoryEventBus;

 beforeEach(() => {
 bus = new InMemoryEventBus();
 });

 it('subscribe + publish delivers to matching (orgId, issueId)', async () => {
 const events: string[] = [];
 const unsub = bus.subscribe('org_a', 'iss_1', (e) => { events.push(e.type); });
 await bus.publish({
 type: 'issue.created', issueId: 'iss_1', orgId: 'org_a',
 projectId: 'p', occurredAt: new Date(),
 });
 assert.deepEqual(events, ['issue.created']);
 unsub();
 });

 it('cross-tenant events are filtered (no leak)', async () => {
 const events: string[] = [];
 const unsub = bus.subscribe('org_a', 'iss_1', (e) => { events.push(e.type); });
 await bus.publish({
 type: 'issue.created', issueId: 'iss_1', orgId: 'org_b',
 projectId: 'p', occurredAt: new Date(),
 });
 assert.equal(events.length, 0);
 unsub();
 });

 it('unsubscribe stops delivery', async () => {
 const events: string[] = [];
 const unsub = bus.subscribe('org_a', 'iss_1', (e) => { events.push(e.type); });
 await bus.publish({ type: 'issue.created', issueId: 'iss_1', orgId: 'org_a', projectId: 'p', occurredAt: new Date() });
 unsub();
 await bus.publish({ type: 'issue.resolved', issueId: 'iss_1', orgId: 'org_a', projectId: 'p', occurredAt: new Date() });
 assert.equal(events.length, 1);
 });

 it('multiple subscribers receive all matching events', async () => {
 const a: string[] = [];
 const b: string[] = [];
 bus.subscribe('org_a', 'iss_1', (e) => { a.push(e.type); });
 bus.subscribe('org_a', 'iss_1', (e) => { b.push(e.type); });
 await bus.publish({ type: 'issue.created', issueId: 'iss_1', orgId: 'org_a', projectId: 'p', occurredAt: new Date() });
 assert.equal(a.length, 1);
 assert.equal(b.length, 1);
 });

 it('subscriber error does not break other subscribers', async () => {
 const events: string[] = [];
 bus.subscribe('org_a', 'iss_1', () => { throw new Error('boom'); });
 bus.subscribe('org_a', 'iss_1', (e) => { events.push(e.type); });
 await bus.publish({ type: 'issue.created', issueId: 'iss_1', orgId: 'org_a', projectId: 'p', occurredAt: new Date() });
 assert.equal(events.length, 1);
 });

 it('subscriberCount reports total', () => {
 bus.subscribe('org_a', 'iss_1', () => {});
 bus.subscribe('org_a', 'iss_2', () => {});
 bus.subscribe('org_b', 'iss_1', () => {});
 assert.equal(bus.subscriberCount(), 3);
 });
});

describe('Realtime — SSE endpoint (T-023)', () => {
 let app: FastifyInstance;

 beforeEach(async () => {
 app = await buildFieldServer();
 });

 it('SSE returns text/event-stream content-type with history replay', async () => {
 const create = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 const id = create.json().id;
 const res = await app.inject({ method: 'GET', url: `/v1/projects/prj_1/issues/${id}/events?once=1`, headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 assert.match(res.headers['content-type'], /text\/event-stream/);
 assert.match(res.body, /issue\.created/);
 });

 it('SSE returns 401 when x-tenant-id missing', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/issues/iss_x/events' });
 assert.equal(res.statusCode, 401);
 });

 it('SSE returns 404 for cross-tenant', async () => {
 const create = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 const id = create.json().id;
 const res = await app.inject({ method: 'GET', url: `/v1/projects/prj_1/issues/${id}/events`, headers: { 'x-tenant-id': 'org_b' } });
 assert.equal(res.statusCode, 404);
 });
});
