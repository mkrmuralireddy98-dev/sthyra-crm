import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildFieldServer } from './http.js';
import { InMemoryIssueRepository } from './repo-memory.js';
import { InMemoryIdempotencyStore } from './in-memory-idempotency.js';
import { IssueService } from './service.js';

const IFC_PHOTO = {
 sha256: 'photo-sha-abc',
 contentType: 'image/jpeg',
 caption: 'Before fix',
 sizeBytes: 1024,
};

let app: FastifyInstance;
let issueId: string;

beforeEach(async () => {
 const repo = new InMemoryIssueRepository();
 const idem = new InMemoryIdempotencyStore();
 const service = new IssueService({ repo, idempotency: idem });
 app = await buildFieldServer({ service, repo, idempotency: idem });
 const create = await app.inject({
 method: 'POST',
 url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i1' },
 payload: { title: 'Test issue', description: 'desc', severity: 'high' },
 });
 issueId = create.json().id;
 // resolve the issue so we can test inspect
 await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/resolve`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { actorId: 'user_1', resolutionNote: 'fixed' },
 });
});

describe('Phase 7 FR-2: POST photos', () => {
 it('201 on first photo upload', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/photos`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: IFC_PHOTO,
 });
 assert.equal(res.statusCode, 201);
 const body = res.json();
 assert.ok(body.photoId.startsWith('pho_'));
 assert.equal(body.sha256, IFC_PHOTO.sha256);
 });

 it('401 when tenant missing', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/photos`,
 payload: IFC_PHOTO,
 });
 assert.equal(res.statusCode, 401);
 });

 it('413 when photo > 10MB', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/photos`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { ...IFC_PHOTO, sizeBytes: 11 * 1024 * 1024 },
 });
 assert.equal(res.statusCode, 413);
 });

 it('404 on cross-tenant probe', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/photos`,
 headers: { 'x-tenant-id': 'org_b' },
 payload: IFC_PHOTO,
 });
 assert.equal(res.statusCode, 404);
 });

 it('400 on missing body fields', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/photos`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { sha256: 'a' },
 });
 assert.equal(res.statusCode, 400);
 });
});

describe('Phase 7 FR-4: POST inspect (pass/fail)', () => {
 it('200 with outcome pass → status closed', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/inspect`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { inspectorId: 'qa_1', outcome: 'pass', note: 'looks good' },
 });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'closed');
 });

 it('200 with outcome fail → status in_progress (reopened)', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/inspect`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { inspectorId: 'qa_1', outcome: 'fail', note: 'not fixed' },
 });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'in_progress');
 });

 it('409 when inspecting an open issue (wrong state)', async () => {
 const create = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/issues',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'open-i' },
 payload: { title: 'Open', description: 'd', severity: 'low' },
 });
 const openId = create.json().id;
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${openId}/inspect`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { inspectorId: 'qa_1', outcome: 'pass' },
 });
 assert.equal(res.statusCode, 409);
 });

 it('400 when outcome invalid', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/inspect`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { inspectorId: 'qa_1', outcome: 'maybe' },
 });
 assert.equal(res.statusCode, 400);
 });

 it('404 on cross-tenant probe', async () => {
 const res = await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/inspect`,
 headers: { 'x-tenant-id': 'org_b' },
 payload: { inspectorId: 'qa_1', outcome: 'pass' },
 });
 assert.equal(res.statusCode, 404);
 });
});

describe('Phase 7 FR-5: GET closeout', () => {
 it('200 returns total + byStatus + completionPct', async () => {
 const res = await app.inject({
 method: 'GET', url: '/v1/projects/prj_1/closeout',
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.equal(body.total, 1);
 assert.ok(typeof body.byStatus === 'object');
 assert.equal(typeof body.completionPct, 'number');
 });

 it('completionPct = 100 after inspect pass', async () => {
 await app.inject({
 method: 'POST', url: `/v1/projects/prj_1/issues/${issueId}/inspect`,
 headers: { 'x-tenant-id': 'org_a' },
 payload: { inspectorId: 'qa_1', outcome: 'pass' },
 });
 const res = await app.inject({
 method: 'GET', url: '/v1/projects/prj_1/closeout',
 headers: { 'x-tenant-id': 'org_a' },
 });
 const body = res.json();
 assert.equal(body.completionPct, 100);
 assert.equal(body.byStatus['closed'], 1);
 });

 it('empty project returns total=0 + completionPct=100', async () => {
 const emptyApp = await buildFieldServer({
 service: new IssueService({ repo: new InMemoryIssueRepository(), idempotency: new InMemoryIdempotencyStore() }),
 repo: new InMemoryIssueRepository(),
 idempotency: new InMemoryIdempotencyStore(),
 });
 const res = await emptyApp.inject({
 method: 'GET', url: '/v1/projects/empty/closeout',
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().total, 0);
 assert.equal(res.json().completionPct, 100);
 });

 it('401 when tenant missing', async () => {
 const res = await app.inject({
 method: 'GET', url: '/v1/projects/prj_1/closeout',
 });
 assert.equal(res.statusCode, 401);
 });
});
