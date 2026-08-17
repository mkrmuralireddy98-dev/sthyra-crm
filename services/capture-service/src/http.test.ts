import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildCaptureServer } from './http.js';
import { CaptureService } from './service.js';
import { InMemoryCaptureRepository, InMemoryIdempotencyStore } from './repo-memory.js';

interface InjectResult {
 statusCode: number;
 json: () => unknown;
 headers: Record<string, string>;
 body: string;
}

async function inject(app: FastifyInstance, opts: { method: string; url: string; headers?: Record<string, string>; payload?: unknown }): Promise<InjectResult> {
 // Build a plain object literal; cast to Fastify's loose InjectOptions shape
 // at the call site. exactOptionalPropertyTypes forbids passing
 // `headers: undefined` directly, so we omit the key when undefined.
 const injectOpts: { method: string; url: string; headers?: Record<string, string>; payload?: unknown } = {
 method: opts.method,
 url: opts.url,
 };
 if (opts.headers !== undefined) injectOpts.headers = opts.headers;
 if (opts.payload !== undefined) injectOpts.payload = opts.payload;
 // The actual Fastify inject() has multiple overloads. Cast through unknown.
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const result = await (app.inject as (opts: unknown) => Promise<InjectResult>)(injectOpts);
 return result;
}

async function makeApp(): Promise<FastifyInstance> {
 const repo = new InMemoryCaptureRepository();
 const idempotency = new InMemoryIdempotencyStore();
 const service = new CaptureService({ repo, idempotency });
 return buildCaptureServer({ service, repo, idempotency });
}

describe('capture-service HTTP — Phase 1 MVP', () => {
 let app: FastifyInstance;

 beforeEach(async () => {
 app = await makeApp();
 });

 describe('GET /v1/health', () => {
 it('returns 200 with status ok', async () => {
 const res = await inject(app, { method: 'GET', url: '/v1/health' });
 assert.equal(res.statusCode, 200);
 const body = res.json() as { status: string };
 assert.equal(body.status, 'ok');
 });
 });

 describe('POST /v1/projects/:projectId/captures', () => {
 it('returns 201 on first POST with Idempotency-Key', async () => {
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: {
 'content-type': 'application/json',
 'x-tenant-id': 'org_a',
 'x-idempotency-key': 'idem-001',
 },
 payload: {
 clientCaptureId: 'cli-001',
 kind: 'walkthrough_360',
 deviceModel: 'Insta360 X4',
 deviceOsVersion: 'iOS 17.5',
 },
 });
 assert.equal(res.statusCode, 201);
 const body = res.json() as { capture: { id: string; orgId: string }; uploadSession: { id: string; status: string } };
 assert.equal(body.capture.orgId, 'org_a');
 assert.equal(body.uploadSession.status, 'uploading');
 });

 it('returns 200 with SAME capture on retry (idempotency hit)', async () => {
 const headers = {
 'content-type': 'application/json',
 'x-tenant-id': 'org_a',
 'x-idempotency-key': 'idem-dup',
 };
 const payload = { clientCaptureId: 'cli-001', kind: 'walkthrough_360' };
 const first = await inject(app, { method: 'POST', url: '/v1/projects/prj_1/captures', headers, payload });
 const second = await inject(app, { method: 'POST', url: '/v1/projects/prj_1/captures', headers, payload });
 assert.equal(first.statusCode, 201);
 assert.equal(second.statusCode, 200);
 const f = first.json() as { capture: { id: string }; uploadSession: { id: string } };
 const s = second.json() as { capture: { id: string }; uploadSession: { id: string } };
 assert.equal(s.capture.id, f.capture.id);
 assert.equal(s.uploadSession.id, f.uploadSession.id);
 });

 it('returns 409 on duplicate (projectId, clientCaptureId) without idempotency key', async () => {
 const payload = { clientCaptureId: 'cli-dup', kind: 'walkthrough_360' };
 await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-A' },
 payload,
 });
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-B' },
 payload,
 });
 assert.equal(res.statusCode, 409);
 const body = res.json() as { code: string; trace_id: string };
 assert.equal(body.code, 'duplicate_client_capture_id');
 assert.ok(body.trace_id);
 });

 it('returns 401 when x-tenant-id is missing', async () => {
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-idempotency-key': 'idem-x' },
 payload: { clientCaptureId: 'cli-x', kind: 'walkthrough_360' },
 });
 assert.equal(res.statusCode, 401);
 });

 it('returns 400 with code missing_idempotency_key when x-idempotency-key is missing', async () => {
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a' },
 payload: { clientCaptureId: 'cli-x', kind: 'walkthrough_360' },
 });
 assert.equal(res.statusCode, 400);
 const body = res.json() as { code: string };
 assert.equal(body.code, 'missing_idempotency_key');
 });

 it('returns 400 on invalid kind', async () => {
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-y' },
 payload: { clientCaptureId: 'cli-y', kind: 'invalid-kind' },
 });
 assert.equal(res.statusCode, 400);
 const body = res.json() as { code: string };
 assert.equal(body.code, 'invalid_input');
 });

 it('every error is application/problem+json with trace_id', async () => {
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json' },
 payload: { clientCaptureId: 'cli-z', kind: 'walkthrough_360' },
 });
 assert.equal(res.statusCode, 401);
 assert.match(res.headers['content-type'] ?? '', /application\/problem\+json/);
 const body = res.json() as { type: string; status: number; title: string; detail: string; trace_id: string; code: string };
 assert.equal(body.status, 401);
 assert.ok(body.type && body.title && body.detail && body.trace_id && body.code);
 });

 it('sets x-request-id header on every response', async () => {
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-rr' },
 payload: { clientCaptureId: 'cli-rr', kind: 'walkthrough_360' },
 });
 assert.ok(res.headers['x-request-id']);
 });

 it('echoes the supplied x-request-id', async () => {
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: {
 'content-type': 'application/json',
 'x-tenant-id': 'org_a',
 'x-idempotency-key': 'idem-echo',
 'x-request-id': 'req_my_custom_id_001',
 },
 payload: { clientCaptureId: 'cli-echo', kind: 'walkthrough_360' },
 });
 assert.equal(res.headers['x-request-id'], 'req_my_custom_id_001');
 });

 it('upload session expires in 15 minutes (NFR-5)', async () => {
 const before = Date.now();
 const res = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-ttl' },
 payload: { clientCaptureId: 'cli-ttl', kind: 'walkthrough_360' },
 });
 const body = res.json() as { uploadSession: { expiresAt: string } };
 const expiry = new Date(body.uploadSession.expiresAt).getTime();
 const fifteenMin = 15 * 60 * 1000;
 assert.ok(expiry - before >= fifteenMin - 1000);
 });
 });

 describe('GET /v1/captures/:id', () => {
 it('returns 200 with the capture when found', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-1' },
 payload: { clientCaptureId: 'cli-1', kind: 'walkthrough_360' },
 });
 const { capture } = create.json() as { capture: { id: string } };
 const res = await inject(app, {
 method: 'GET',
 url: `/v1/captures/${capture.id}`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json() as { id: string; orgId: string };
 assert.equal(body.id, capture.id);
 assert.equal(body.orgId, 'org_a');
 });

 it('returns 404 when not found in same tenant', async () => {
 const res = await inject(app, {
 method: 'GET',
 url: '/v1/captures/cap_nonexistent',
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 404);
 });

 it('CROSS-TENANT PROBE returns 404 (does not leak existence)', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-iso' },
 payload: { clientCaptureId: 'cli-iso', kind: 'walkthrough_360' },
 });
 const { capture } = create.json() as { capture: { id: string } };
 const crossTenant = await inject(app, {
 method: 'GET',
 url: `/v1/captures/${capture.id}`,
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(crossTenant.statusCode, 404);
 });
 });

 describe('GET /v1/projects/:projectId/captures (list)', () => {
 it('returns 200 with data array', async () => {
 await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-l1' },
 payload: { clientCaptureId: 'cli-l1', kind: 'walkthrough_360' },
 });
 await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-l2' },
 payload: { clientCaptureId: 'cli-l2', kind: 'drone' },
 });
 const res = await inject(app, {
 method: 'GET',
 url: '/v1/projects/prj_1/captures',
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json() as { data: unknown[] };
 assert.equal(body.data.length, 2);
 });

 it('CROSS-TENANT LIST returns only same-tenant captures', async () => {
 await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-A' },
 payload: { clientCaptureId: 'cli-A', kind: 'walkthrough_360' },
 });
 await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_b', 'x-idempotency-key': 'idem-B' },
 payload: { clientCaptureId: 'cli-B', kind: 'walkthrough_360' },
 });
 const a = await inject(app, {
 method: 'GET',
 url: '/v1/projects/prj_1/captures',
 headers: { 'x-tenant-id': 'org_a' },
 });
 const b = await inject(app, {
 method: 'GET',
 url: '/v1/projects/prj_1/captures',
 headers: { 'x-tenant-id': 'org_b' },
 });
 const aBody = a.json() as { data: { orgId: string }[] };
 const bBody = b.json() as { data: { orgId: string }[] };
 assert.equal(aBody.data.length, 1);
 assert.equal(aBody.data[0]?.orgId, 'org_a');
 assert.equal(bBody.data.length, 1);
 assert.equal(bBody.data[0]?.orgId, 'org_b');
 });
 });

 describe('POST /v1/captures/:id/archive', () => {
 it('returns 204 and transitions to archived', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-arch' },
 payload: { clientCaptureId: 'cli-arch', kind: 'walkthrough_360' },
 });
 const { capture } = create.json() as { capture: { id: string } };
 const res = await inject(app, {
 method: 'POST',
 url: `/v1/captures/${capture.id}/archive`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 204);
 const get = await inject(app, {
 method: 'GET',
 url: `/v1/captures/${capture.id}`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 const getBody = get.json() as { status: string };
 assert.equal(getBody.status, 'archived');
 });

 it('CROSS-TENANT ARCHIVE returns 404', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-iso-arch' },
 payload: { clientCaptureId: 'cli-iso-arch', kind: 'walkthrough_360' },
 });
 const { capture } = create.json() as { capture: { id: string } };
 const cross = await inject(app, {
 method: 'POST',
 url: `/v1/captures/${capture.id}/archive`,
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(cross.statusCode, 404);
 });
 });

 describe('GET /v1/upload-sessions/:id', () => {
 it('returns 200 with receivedChunks', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-us' },
 payload: { clientCaptureId: 'cli-us', kind: 'walkthrough_360' },
 });
 const { uploadSession } = create.json() as { uploadSession: { id: string } };
 const res = await inject(app, {
 method: 'GET',
 url: `/v1/upload-sessions/${uploadSession.id}`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json() as { id: string; status: string; receivedChunks: number[] };
 assert.equal(body.id, uploadSession.id);
 assert.equal(body.status, 'uploading');
 assert.deepEqual(body.receivedChunks, []);
 });

 it('CROSS-TENANT UPLOAD SESSION READ returns 404', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-us-iso' },
 payload: { clientCaptureId: 'cli-us-iso', kind: 'walkthrough_360' },
 });
 const { uploadSession } = create.json() as { uploadSession: { id: string } };
 const cross = await inject(app, {
 method: 'GET',
 url: `/v1/upload-sessions/${uploadSession.id}`,
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(cross.statusCode, 404);
 });
 });

 describe('POST /v1/upload-sessions/:id/chunks/:n', () => {
 it('records chunk received (idempotent on chunkIndex)', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-chunk' },
 payload: { clientCaptureId: 'cli-chunk', kind: 'walkthrough_360' },
 });
 const { uploadSession } = create.json() as { uploadSession: { id: string } };
 await inject(app, {
 method: 'POST',
 url: `/v1/upload-sessions/${uploadSession.id}/chunks/0`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 await inject(app, {
 method: 'POST',
 url: `/v1/upload-sessions/${uploadSession.id}/chunks/0`, // duplicate
 headers: { 'x-tenant-id': 'org_a' },
 });
 await inject(app, {
 method: 'POST',
 url: `/v1/upload-sessions/${uploadSession.id}/chunks/1`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 const res = await inject(app, {
 method: 'GET',
 url: `/v1/upload-sessions/${uploadSession.id}`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 const body = res.json() as { receivedChunks: number[] };
 assert.deepEqual(body.receivedChunks, [0, 1]);
 });

 it('CROSS-TENANT CHUNK RECORD returns 404', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-chunk-iso' },
 payload: { clientCaptureId: 'cli-chunk-iso', kind: 'walkthrough_360' },
 });
 const { uploadSession } = create.json() as { uploadSession: { id: string } };
 const cross = await inject(app, {
 method: 'POST',
 url: `/v1/upload-sessions/${uploadSession.id}/chunks/0`,
 headers: { 'x-tenant-id': 'org_b' },
 });
 assert.equal(cross.statusCode, 404);
 });
 });

 describe('POST /v1/upload-sessions/:id/complete', () => {
 it('transitions capture to processing with sha256', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-fin' },
 payload: { clientCaptureId: 'cli-fin', kind: 'walkthrough_360' },
 });
 const { uploadSession, capture } = create.json() as { uploadSession: { id: string }; capture: { id: string } };
 const res = await inject(app, {
 method: 'POST',
 url: `/v1/upload-sessions/${uploadSession.id}/complete`,
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a' },
 payload: { sha256: 'sha256-final-hash-abc' },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json() as { captureId: string; status: string };
 assert.equal(body.captureId, capture.id);
 assert.equal(body.status, 'processing');

 // Verify the capture moved to 'processing'
 const get = await inject(app, {
 method: 'GET',
 url: `/v1/captures/${capture.id}`,
 headers: { 'x-tenant-id': 'org_a' },
 });
 const getBody = get.json() as { status: string };
 assert.equal(getBody.status, 'processing');
 });

 it('returns 400 on missing sha256', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-no-sha' },
 payload: { clientCaptureId: 'cli-no-sha', kind: 'walkthrough_360' },
 });
 const { uploadSession } = create.json() as { uploadSession: { id: string } };
 const res = await inject(app, {
 method: 'POST',
 url: `/v1/upload-sessions/${uploadSession.id}/complete`,
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a' },
 payload: {},
 });
 assert.equal(res.statusCode, 400);
 });

 it('CROSS-TENANT FINALIZE returns 404', async () => {
 const create = await inject(app, {
 method: 'POST',
 url: '/v1/projects/prj_1/captures',
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_a', 'x-idempotency-key': 'idem-fin-iso' },
 payload: { clientCaptureId: 'cli-fin-iso', kind: 'walkthrough_360' },
 });
 const { uploadSession } = create.json() as { uploadSession: { id: string } };
 const cross = await inject(app, {
 method: 'POST',
 url: `/v1/upload-sessions/${uploadSession.id}/complete`,
 headers: { 'content-type': 'application/json', 'x-tenant-id': 'org_b' },
 payload: { sha256: 'sha256' },
 });
 assert.equal(cross.statusCode, 404);
 });
 });
});
