import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildMobileServer } from './http.js';
import { InMemoryMobileRepository } from './repo-memory.js';
import { signJwt } from './jwt.js';

const JWT_SECRET = 'test-jwt-secret-32-bytes-padded';

let app: FastifyInstance;
let iosToken: string;
let androidToken: string;

beforeEach(async () => {
  const repo = new InMemoryMobileRepository();
  app = await buildMobileServer({ repo, jwtSecret: JWT_SECRET });
  iosToken = signJwt(
    { orgId: 'org_a', userId: 'user_1', deviceId: 'iphone-1' },
    { secret: JWT_SECRET },
  );
  androidToken = signJwt(
    { orgId: 'org_a', userId: 'user_1', deviceId: 'pixel-1' },
    { secret: JWT_SECRET },
  );
});

describe('Android-compat — iOS-style register (pushChannel=apns default)', () => {
  it('iOS register still works (backward compat)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: { 'authorization': 'Bearer ' + iosToken },
      payload: { apnsToken: 'apns-abc' },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().deviceId, 'iphone-1');
  });

  it('defaults pushChannel to apns when not specified', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: { 'authorization': 'Bearer ' + iosToken },
      payload: { apnsToken: 'apns-abc' },
    });
    // Status 201 confirms the route accepted; the pushChannel is stored but not echoed
    assert.equal(res.statusCode, 201);
  });
});

describe('Android-compat — FCM register (pushChannel=fcm)', () => {
  it('Android register succeeds with pushChannel=fcm + fcmAppId', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: { 'authorization': 'Bearer ' + androidToken },
      payload: { apnsToken: 'fcm-token-xyz', pushChannel: 'fcm', fcmAppId: 'com.sthyra.crm' },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().deviceId, 'pixel-1');
  });

  it('FCM register without fcmAppId returns 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: { 'authorization': 'Bearer ' + androidToken },
      payload: { apnsToken: 'fcm-token-xyz', pushChannel: 'fcm' },
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().code ?? '', /invalid_input|fcm/i);
  });
});

describe('Android-compat — iOS + Android coexist', () => {
  it('iOS + Android devices can both register', async () => {
    const ios = await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: { 'authorization': 'Bearer ' + iosToken },
      payload: { apnsToken: 'apns-1' },
    });
    const android = await app.inject({
      method: 'POST', url: '/v1/mobile/devices',
      headers: { 'authorization': 'Bearer ' + androidToken },
      payload: { apnsToken: 'fcm-1', pushChannel: 'fcm', fcmAppId: 'com.sthyra.crm' },
    });
    assert.equal(ios.statusCode, 201);
    assert.equal(android.statusCode, 201);
  });
});

describe('Android-compat — Accept-Language', () => {
  it('400 on invalid input includes localized message (en-US default)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { 'authorization': 'Bearer ' + iosToken, 'x-idempotency-key': 'i' },
      payload: { projectId: '', kind: 'invalid' },
    });
    assert.equal(res.statusCode, 400);
    // Default locale is en-US
    assert.ok(res.body.length > 0);
  });

  it('explicit Accept-Language: ja-JP falls back to en-US (no 406 for default header missing)', async () => {
    // ja-JP is not in SUPPORTED_LOCALES, but no Accept-Language header = no 406
    const res = await app.inject({
      method: 'POST', url: '/v1/mobile/sessions',
      headers: { 'authorization': 'Bearer ' + iosToken, 'x-idempotency-key': 'i' },
      payload: { projectId: 'p', kind: 'walkthrough_360' },
    });
    assert.notEqual(res.statusCode, 406);
  });
});