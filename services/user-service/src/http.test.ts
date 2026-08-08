import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildServer } from './http.js';
import { UserService, InMemoryUserRepository, InMemoryTokenStore } from './index.js';

describe('user-service HTTP', () => {
  let service: UserService;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const tokens = new InMemoryTokenStore();
    service = new UserService({ users, tokens, tokenTtlSeconds: 3600 });
    app = buildServer({ service });
    await app.ready();
  });

  it('POST /v1/users creates a user and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'maya@hudson.gc',
        displayName: 'Maya Reyes',
        role: 'project_admin',
        orgId: 'org_00000001',
      }),
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.id.startsWith('usr_'));
    assert.equal(body.email, 'maya@hudson.gc');
    assert.equal(body.role, 'project_admin');
  });

  it('POST /v1/users with invalid role returns 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'a@b.com',
        displayName: 'A',
        role: 'god_mode',
        orgId: 'org_x',
      }),
    });
    assert.equal(res.statusCode, 422);
  });

  it('GET /v1/users/:id returns the user', async () => {
    const created = await service.provision({
      email: 'a@b.com',
      displayName: 'A',
      role: 'field_worker',
      orgId: 'org_x',
    });
    const res = await app.inject({ method: 'GET', url: `/v1/users/${created.id}` });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().id, created.id);
  });

  it('POST /v1/users/:id/tokens issues a token; GET /v1/tokens/verify round-trips', async () => {
    const created = await service.provision({
      email: 'a@b.com',
      displayName: 'A',
      role: 'project_admin',
      orgId: 'org_x',
    });

    const tokenRes = await app.inject({
      method: 'POST',
      url: `/v1/users/${created.id}/tokens`,
    });
    assert.equal(tokenRes.statusCode, 201);
    const { token } = tokenRes.json();

    const verifyRes = await app.inject({
      method: 'GET',
      url: '/v1/tokens/verify',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(verifyRes.statusCode, 200);
    assert.equal(verifyRes.json().userId, created.id);
  });

  it('GET /v1/tokens/verify without bearer returns 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/tokens/verify' });
    assert.equal(res.statusCode, 422);
  });

  it('GET /v1/tokens/verify with bogus token returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tokens/verify',
      headers: { authorization: 'Bearer opaque:notreal' },
    });
    assert.equal(res.statusCode, 401);
  });
});
