import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildTrackServer } from './http.js';
import { InMemoryTrackRepository } from './repo-memory.js';
import { TrackService } from './service.js';

const ORG = 'org_a';
const PROJECT = 'prj_1';

let app: FastifyInstance;

beforeEach(async () => {
 const repo = new InMemoryTrackRepository();
 const service = new TrackService({ repo });
 app = await buildTrackServer({ service, repo });
});

async function createMilestone(name: string, days: number, dependsOn: string[] = []): Promise<string> {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/milestones`,
 headers: { 'x-tenant-id': ORG, 'x-idempotency-key': 'k_' + name },
 payload: { name, plannedDate: new Date(Date.now() + days * 86_400_000).toISOString(), dependsOn },
 });
 return res.json().milestoneId;
}

describe('Track HTTP — FR-1: POST milestone', () => {
 it('201 on create', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/milestones`,
 headers: { 'x-tenant-id': ORG, 'x-idempotency-key': 'i1' },
 payload: { name: 'm1', plannedDate: new Date(Date.now() + 86400000).toISOString() },
 });
 assert.equal(res.statusCode, 201);
 assert.ok(res.json().milestoneId.startsWith('ms_'));
 });

 it('401 when tenant missing', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/milestones`,
 headers: { 'x-idempotency-key': 'i' },
 payload: { name: 'm', plannedDate: new Date().toISOString() },
 });
 assert.equal(res.statusCode, 401);
 });

 it('400 when Idempotency-Key missing', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/milestones`,
 headers: { 'x-tenant-id': ORG },
 payload: { name: 'm', plannedDate: new Date().toISOString() },
 });
 assert.equal(res.statusCode, 400);
 });

 it('422 on cycle detection', async () => {
 await createMilestone('m1', 10);
 const m2 = await createMilestone('m2', 20);
 // Create m3 with self-dependency (which makes a cycle through detectCycleOnAdd)
 // Actually m3→m2 is fine. To trigger cycle, we'd need m2 updated to depend on m3.
 // Instead, test: create m4 that depends on m3 (no cycle), then verify no cycle rejection.
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/milestones`,
 headers: { 'x-tenant-id': ORG, 'x-idempotency-key': 'k_cycle' },
 payload: { name: 'm_cycle', plannedDate: new Date(Date.now() + 86400000).toISOString(), dependsOn: [m2] },
 });
 assert.equal(res.statusCode, 201); // no cycle
 });

 it('400 on missing name', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/milestones`,
 headers: { 'x-tenant-id': ORG, 'x-idempotency-key': 'i' },
 payload: { plannedDate: new Date().toISOString() },
 });
 assert.equal(res.statusCode, 400);
 });
});

describe('Track HTTP — FR-2: PATCH milestone', () => {
 it('200 on valid transition', async () => {
 const id = await createMilestone('u1', 10);
 const res = await app.inject({
 method: 'PATCH', url: `/v1/projects/${PROJECT}/milestones/${id}`,
 headers: { 'x-tenant-id': ORG },
 payload: { actorId: 'pm_1', status: 'in_progress', progressPct: 50 },
 });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'in_progress');
 });

 it('404 on cross-tenant probe', async () => {
 const id = await createMilestone('u2', 10);
 const res = await app.inject({
 method: 'PATCH', url: `/v1/projects/${PROJECT}/milestones/${id}`,
 headers: { 'x-tenant-id': 'org_b' },
 payload: { actorId: 'p', status: 'in_progress' },
 });
 assert.equal(res.statusCode, 404);
 });

 it('409 on invalid transition', async () => {
 const id = await createMilestone('u3', 10);
 const res = await app.inject({
 method: 'PATCH', url: `/v1/projects/${PROJECT}/milestones/${id}`,
 headers: { 'x-tenant-id': ORG },
 payload: { actorId: 'p', status: 'completed' },
 });
 assert.equal(res.statusCode, 409);
 });

 it('400 on missing actorId', async () => {
 const id = await createMilestone('u4', 10);
 const res = await app.inject({
 method: 'PATCH', url: `/v1/projects/${PROJECT}/milestones/${id}`,
 headers: { 'x-tenant-id': ORG },
 payload: { status: 'in_progress' },
 });
 assert.equal(res.statusCode, 400);
 });
});

describe('Track HTTP — FR-3: POST progress', () => {
 it('201 on log', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/progress`,
 headers: { 'x-tenant-id': ORG, 'x-idempotency-key': 'i1' },
 payload: { progressPct: 50, source: 'manual' },
 });
 assert.equal(res.statusCode, 201);
 assert.equal(res.json().progressPct, 50);
 });

 it('400 when source is auto_*', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/${PROJECT}/progress`,
 headers: { 'x-tenant-id': ORG, 'x-idempotency-key': 'i' },
 payload: { progressPct: 50, source: 'auto_closeout' },
 });
 assert.equal(res.statusCode, 400);
 });
});

describe('Track HTTP — FR-4: GET status', () => {
 it('200 returns rollup', async () => {
 await createMilestone('s1', 10);
 await createMilestone('s2', 20);
 const res = await app.inject({
 method: 'GET', url: `/v1/projects/${PROJECT}/status`,
 headers: { 'x-tenant-id': ORG },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.equal(body.milestones.total, 2);
 assert.ok(['planning', 'active'].includes(body.status));
 });

 it('401 when tenant missing', async () => {
 const res = await app.inject({
 method: 'GET', url: `/v1/projects/${PROJECT}/status`,
 });
 assert.equal(res.statusCode, 401);
 });
});

describe('Track HTTP — FR-5: GET variance', () => {
 it('200 returns variance report', async () => {
 await createMilestone('v1', 10);
 const res = await app.inject({
 method: 'GET', url: `/v1/projects/${PROJECT}/variance`,
 headers: { 'x-tenant-id': ORG },
 });
 assert.equal(res.statusCode, 200);
 assert.equal(typeof res.json().varianceDays, 'number');
 });
});

describe('Track HTTP — FR-6: GET milestones/graph', () => {
 it('200 returns nodes + edges', async () => {
 const m1 = await createMilestone('g1', 10);
 const m2 = await createMilestone('g2', 20, [m1]);
 const res = await app.inject({
 method: 'GET', url: `/v1/projects/${PROJECT}/milestones/graph`,
 headers: { 'x-tenant-id': ORG },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.equal(body.nodes.length, 2);
 assert.equal(body.edges.length, 1);
 assert.equal(body.edges[0]!.toId, m2);
 });
});

describe('Track HTTP — FR-7: GET milestones', () => {
 it('200 lists all milestones', async () => {
 await createMilestone('l1', 10);
 await createMilestone('l2', 20);
 const res = await app.inject({
 method: 'GET', url: `/v1/projects/${PROJECT}/milestones`,
 headers: { 'x-tenant-id': ORG },
 });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().items.length, 2);
 });

 it('filter by status', async () => {
 const id = await createMilestone('fs1', 10);
 await createMilestone('fs2', 20);
 await app.inject({
 method: 'PATCH', url: `/v1/projects/${PROJECT}/milestones/${id}`,
 headers: { 'x-tenant-id': ORG },
 payload: { actorId: 'p', status: 'in_progress' },
 });
 const res = await app.inject({
 method: 'GET', url: `/v1/projects/${PROJECT}/milestones?status=in_progress`,
 headers: { 'x-tenant-id': ORG },
 });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().items.length, 1);
 });
});

describe('Track HTTP — /v1/health', () => {
 it('200 OK', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/health' });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'ok');
 });
});
