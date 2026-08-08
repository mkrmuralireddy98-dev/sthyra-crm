import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import { installAuthPlugin, type Principal } from './index.js';

describe('auth middleware', () => {
  let app: ReturnType<typeof Fastify>;
  let verifyCalls: string[] = [];

  beforeEach(async () => {
    verifyCalls = [];
    app = Fastify({ logger: false });
    await installAuthPlugin(app, {
      userServiceUrl: 'http://user-service.test',
      // Test seam: don't actually hit user-service.
      verify: async (token: string): Promise<Principal | null> => {
        verifyCalls.push(token);
        if (token === 'valid.token') {
          return { userId: 'usr_1', orgId: 'org_1', role: 'project_admin' };
        }
        return null;
      },
    });
    app.get('/v1/health', async () => ({ status: 'ok' }));
    app.get('/v1/secret', async (req: import('fastify').FastifyRequest) => ({
      ok: true,
      who: req.principal?.userId ?? null,
    }));
    await app.ready();
  });

  it('skips auth for /v1/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.equal(res.statusCode, 200);
    assert.equal(verifyCalls.length, 0);
  });

  it('returns 401 with problem+json when Authorization header is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/secret' });
    assert.equal(res.statusCode, 401);
    assert.ok(String(res.headers['content-type']).includes('application/problem+json'));
    const body = res.json();
    assert.equal(body.status, 401);
    assert.match(body.title, /missing bearer/i);
    assert.ok(body.trace_id);
  });

  it('returns 401 when the header is not Bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/secret',
      headers: { authorization: 'Basic abc.def.ghi' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('returns 401 when the token is empty after Bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/secret',
      headers: { authorization: 'Bearer ' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('returns 401 when verify returns null', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/secret',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('attaches the principal to req.principal when verify succeeds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/secret',
      headers: { authorization: 'Bearer valid.token' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().who, 'usr_1');
    assert.equal(verifyCalls.length, 1);
    assert.equal(verifyCalls[0], 'valid.token');
  });

  it('returns 503 when the verify function throws', async () => {
    const a = Fastify({ logger: false });
    await installAuthPlugin(a, {
      userServiceUrl: 'http://x',
      verify: async () => {
        throw new Error('user-service down');
      },
    });
    a.get('/v1/secret', async () => ({ ok: true }));
    await a.ready();
    const res = await a.inject({
      method: 'GET',
      url: '/v1/secret',
      headers: { authorization: 'Bearer abc' },
    });
    assert.equal(res.statusCode, 503);
    const body = res.json();
    assert.match(body.title, /auth service unavailable/i);
    await a.close();
  });
});
