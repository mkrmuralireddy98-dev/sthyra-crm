import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildMobileServer } from './http.js';
import { InMemoryMobileRepository } from './repo-memory.js';
import { signJwt } from './jwt.js';

const JWT_SECRET = 'test-jwt-secret-32-bytes-padded';

let app: FastifyInstance;
let validToken: string;
let validHeaders: Record<string, string>;

beforeEach(async () => {
  const repo = new InMemoryMobileRepository();
  app = await buildMobileServer({ repo, jwtSecret: JWT_SECRET });
  validToken = signJwt(
    { orgId: 'org_a', userId: 'user_1', deviceId: 'dev_1' },
    { secret: JWT_SECRET },
  );
  validHeaders = {
    'authorization': 'Bearer ' + validToken,
    'x-tenant-id': 'org_a',
  };
});

describe('Mobile BFF HTTP — JWT auth', () => {
  it('rejects requests without Authorization header (401)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('rejects malformed Authorization (no Bearer prefix)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'authorization': 'Basic xyz' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('rejects expired/tampered JWT (401)', async () => {
    const expired = signJwt(
      { orgId: 'org_a', userId: 'user_1', deviceId: 'dev_1' },
      { secret: JWT_SECRET, ttlSeconds: -1 },
    );
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'authorization': 'Bearer ' + expired },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('rejects JWT signed with different secret (401)', async () => {
    const wrong = signJwt(
      { orgId: 'org_a', userId: 'user_1', deviceId: 'dev_1' },
      { secret: 'wrong-secret-32-bytes-padded-here!' },
    );
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'authorization': 'Bearer ' + wrong },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('returns 401 problem+json when JWT fails', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { 'authorization': 'x' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    assert.match(res.headers['content-type'], /application\/problem\+json/);
  });
});

describe('Mobile BFF HTTP — POST /v1/mobile/sessions (FR-1)', () => {
  it('201 on first create', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: { projectId: 'prj_1', kind: 'walkthrough_360' },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.sessionId.startsWith('mob_'));
    assert.equal(body.kind, 'walkthrough_360');
  });

  it('400 when Idempotency-Key missing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: validHeaders,
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, 'missing_idempotency_key');
  });

  it('400 when kind invalid', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'invalid' },
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('Mobile BFF HTTP — POST .../chunks/:n (FR-2)', () => {
  it('201 on first chunk', async () => {
    const create = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    const sessionId = create.json().sessionId;
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/chunks/0',
      headers: validHeaders,
      payload: { sha256: 'a', sizeBytes: 1024 },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().chunkIndex, 0);
  });

  it('idempotent: same chunk → 200', async () => {
    const create = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    const sessionId = create.json().sessionId;
    const a = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/chunks/0',
      headers: validHeaders,
      payload: { sha256: 'a', sizeBytes: 1024 },
    });
    const b = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/chunks/0',
      headers: validHeaders,
      payload: { sha256: 'a', sizeBytes: 1024 },
    });
    assert.equal(a.statusCode, 201);
    assert.equal(b.statusCode, 200);
    assert.equal(a.json().chunkId, b.json().chunkId);
  });

  it('413 when chunk > 32MB (NFR-8)', async () => {
    const create = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    const sessionId = create.json().sessionId;
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/chunks/0',
      headers: validHeaders,
      payload: { sha256: 'a', sizeBytes: 33 * 1024 * 1024 },
    });
    assert.equal(res.statusCode, 413);
  });
});

describe('Mobile BFF HTTP — POST .../finalize (FR-3)', () => {
  it('200 on successful finalize', async () => {
    const create = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    const sessionId = create.json().sessionId;
    await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/chunks/0',
      headers: validHeaders,
      payload: { sha256: 'a', sizeBytes: 1024 },
    });
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/finalize',
      headers: validHeaders,
      payload: { actualChunkCount: 1, totalSizeBytes: 1024, sha256Root: 'a' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'uploading');
  });

  it('409 when chunk count mismatches', async () => {
    const create = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    const sessionId = create.json().sessionId;
    await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/chunks/0',
      headers: validHeaders,
      payload: { sha256: 'a', sizeBytes: 1024 },
    });
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions/' + sessionId + '/finalize',
      headers: validHeaders,
      payload: { actualChunkCount: 99, totalSizeBytes: 1024, sha256Root: 'a' },
    });
    assert.equal(res.statusCode, 409);
  });
});

describe('Mobile BFF HTTP — GET /v1/mobile/captures/:id (FR-4)', () => {
  it('200 with status + pipeline stage', async () => {
    const res = await app.inject({
      method: 'GET', url: '/v1/mobile/captures/cap_001',
      headers: validHeaders,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'processing');
    assert.equal(body.pipelineStage, 'sfm');
  });
});

describe('Mobile BFF HTTP — POST /v1/mobile/issues (FR-5)', () => {
  it('201 on create', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/issues',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: {
        captureId: 'cap_001', title: 't', description: 'd', severity: 'high',
        coordinates: { x: 1, y: 2, z: 3 },
      },
    });
    assert.equal(res.statusCode, 201);
    assert.ok(res.json().issueId.startsWith('iss_'));
  });

  it('400 when severity invalid', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/issues',
      headers: { ...validHeaders, 'x-idempotency-key': 'i' },
      payload: {
        captureId: 'cap_001', title: 't', description: 'd', severity: 'fatal',
        coordinates: { x: 1, y: 2, z: 3 },
      },
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('Mobile BFF HTTP — POST /v1/mobile/copilot (FR-6)', () => {
  it('200 with replyText + latencyMs', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/copilot',
      headers: validHeaders,
      payload: { projectId: 'p', text: 'show open issues' },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(typeof body.replyText === 'string');
    assert.ok(typeof body.latencyMs === 'number');
  });
});

describe('Mobile BFF HTTP — POST /v1/mobile/devices (FR-8)', () => {
  it('201 on register', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: validHeaders,
      payload: { apnsToken: 'apns-abc-123' },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().deviceId, 'dev_1');
  });

  it('204 on unregister (own device)', async () => {
    await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: validHeaders,
      payload: { apnsToken: 'apns-abc-123' },
    });
    const res = await app.inject({
      method: 'DELETE', url: '/v1/mobile/devices/dev_1',
      headers: validHeaders,
    });
    assert.equal(res.statusCode, 204);
  });

  it('404 on unregister (other tenant\'s device)', async () => {
    const otherToken = signJwt(
      { orgId: 'org_b', userId: 'user_2', deviceId: 'dev_other' },
      { secret: JWT_SECRET },
    );
    const res = await app.inject({
      method: 'DELETE', url: '/v1/mobile/devices/dev_1',
      headers: { ...validHeaders, 'authorization': 'Bearer ' + otherToken },
    });
    assert.equal(res.statusCode, 404);
  });
});

describe('Mobile BFF HTTP — /v1/health', () => {
  it('200 OK (no JWT required)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'ok');
  });
});