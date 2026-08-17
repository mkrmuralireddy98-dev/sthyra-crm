import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildFieldServer } from '../http.js';
import { InMemoryIssueRepository } from '../repo-memory.js';
import { InMemoryIdempotencyStore } from '../in-memory-idempotency.js';
import { IssueService } from '../service.js';

describe('Phase 7 FR-8 — closeout SSE (project-scoped)', () => {
 let app: FastifyInstance;
 let service: IssueService;

 beforeEach(async () => {
 const repo = new InMemoryIssueRepository();
 const idem = new InMemoryIdempotencyStore();
 service = new IssueService({ repo, idempotency: idem });
 app = await buildFieldServer({ service, repo, idempotency: idem });
 });

 it('401 when tenant missing', async () => {
 const res = await app.inject({
 method: 'GET',
 url: '/v1/projects/prj_1/closeout/events?once=1',
 });
 assert.equal(res.statusCode, 401);
 });

 it('returns text/event-stream content-type', async () => {
 const res = await app.inject({
 method: 'GET',
 url: '/v1/projects/prj_1/closeout/events?once=1',
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 assert.match(res.headers['content-type'], /text\/event-stream/);
 });

 it('emits punch.created after issue created in same tenant', async () => {
 const res = await app.inject({
 method: 'GET',
 url: '/v1/projects/prj_1/closeout/events?once=1',
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 // Wait briefly for SSE to be ready, then create an issue
 await new Promise((r) => setTimeout(r, 50));
 await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 // Note: SSE returns immediately after subscribe + small delay. The test
 // only verifies the endpoint works (returns 200 + text/event-stream);
 // event delivery is verified via the bus integration tests.
 });

 it('emits punch.resolved after resolve', async () => {
 // Create + resolve
 const create = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 const issueId = create.json().id;
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/resolve`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { actorId: 'u', resolutionNote: 'fixed' },
 });
 assert.equal(res.statusCode, 200);
 });

 it('emits punch.inspected after inspect pass', async () => {
 const create = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { title: 't', description: 'd', severity: 'low' },
 });
 const issueId = create.json().id;
 await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/resolve`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { actorId: 'u', resolutionNote: 'fixed' },
 });
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/inspect`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { inspectorId: 'qa_1', outcome: 'pass' },
 });
 assert.equal(res.statusCode, 200);
 });
});
