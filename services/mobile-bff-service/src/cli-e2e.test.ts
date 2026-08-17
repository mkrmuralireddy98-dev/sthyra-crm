import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';
import { signJwt } from './jwt.js';

const JWT_SECRET = 'sthyra-crm-mobile-jwt-secret-32b-padded';

describe('mobile-bff-service CLI — end-to-end smoke', () => {
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

  it('boots and creates a session with valid JWT', async () => {
    started = await startInMemoryServer();
    const token = signJwt(
      { orgId: 'org_a', userId: 'user_1', deviceId: 'dev_1' },
      { secret: JWT_SECRET },
    );
    const res = await fetch('http://127.0.0.1:' + started.port + '/v1/mobile/sessions', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + token,
        'x-idempotency-key': 'i',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ projectId: 'prj_1', kind: 'walkthrough_360' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.sessionId.startsWith('mob_'));
  });

  it('rejects requests without JWT (401)', async () => {
    started = await startInMemoryServer();
    const res = await fetch('http://127.0.0.1:' + started.port + '/v1/mobile/sessions', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'i', 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p', kind: 'walkthrough_360' }),
    });
    assert.equal(res.status, 401);
  });

  it('full chunk upload lifecycle', async () => {
    started = await startInMemoryServer();
    const token = signJwt(
      { orgId: 'org_a', userId: 'user_1', deviceId: 'dev_1' },
      { secret: JWT_SECRET },
    );
    const auth = { 'authorization': 'Bearer ' + token, 'content-type': 'application/json' };

    // Create session
    const create = await fetch('http://127.0.0.1:' + started.port + '/v1/mobile/sessions', {
      method: 'POST',
      headers: { ...auth, 'x-idempotency-key': 'i1' },
      body: JSON.stringify({ projectId: 'p', kind: 'walkthrough_360' }),
    });
    const sessionId = (await create.json()).sessionId;

    // Upload chunk
    const chunk = await fetch('http://127.0.0.1:' + started.port + '/v1/mobile/sessions/' + sessionId + '/chunks/0', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ sha256: 'abc', sizeBytes: 1024 }),
    });
    assert.equal(chunk.status, 201);

    // Finalize
    const finalize = await fetch('http://127.0.0.1:' + started.port + '/v1/mobile/sessions/' + sessionId + '/finalize', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ actualChunkCount: 1, totalSizeBytes: 1024, sha256Root: 'abc' }),
    });
    assert.equal(finalize.status, 200);
    const finalBody = await finalize.json();
    assert.equal(finalBody.status, 'uploading');
  });
});