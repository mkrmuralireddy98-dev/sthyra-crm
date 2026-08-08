import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildServer } from './http.js';
import { MembershipService, InMemoryMembershipRepository } from './index.js';

describe('membership-service HTTP', () => {
  let service: MembershipService;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    service = new MembershipService(new InMemoryMembershipRepository());
    // Auth is wired into the membership HTTP server. Phase 0: stub the verify
    // seam so tests don't need a real bearer token. The auth package itself
    // has its own dedicated test suite verifying 401/503 paths.
    app = buildServer({
      service,
      verifyToken: async (token: string) => {
        if (token === 'good') {
          return { userId: 'usr_self', orgId: 'org_1', role: 'project_admin' };
        }
        return null;
      },
    });
    await app.ready();
  });

  /** Helper: inject with a valid bearer token. The response is typed as
   *  `any` because Fastify's `inject` overloads are noisy; tests narrow as
   *  needed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function authed(url: string, init: { method?: string; headers?: Record<string, string>; payload?: string } = {}): Promise<any> {
    const result = app.inject({
      method: (init.method ?? 'GET') as 'GET' | 'POST' | 'DELETE',
      url,
      headers: { ...(init.headers ?? {}), authorization: 'Bearer good' },
      payload: init.payload ?? '',
    });
    return result as unknown as Promise<any>;
  }

  it('POST /v1/orgs/:orgId/members adds a member and returns 201', async () => {
    const res = await authed('/v1/orgs/org_1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'usr_1', role: 'project_admin' }),
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.userId, 'usr_1');
    assert.equal(body.orgId, 'org_1');
    assert.equal(body.role, 'project_admin');
  });

  it('POST duplicate member returns 409 problem+json', async () => {
    await authed('/v1/orgs/org_1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'usr_1', role: 'project_admin' }),
    });
    const res = await authed('/v1/orgs/org_1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'usr_1', role: 'project_admin' }),
    });
    assert.equal(res.statusCode, 409);
    const body = res.json();
    assert.match(body.title, /already a member/i);
  });

  it('GET /v1/orgs/:orgId/members returns members', async () => {
    await authed('/v1/orgs/org_1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'u1', role: 'org_owner' }),
    });
    const res = await authed('/v1/orgs/org_1/members');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.length, 1);
  });

  it('POST /v1/projects/:projectId/members adds a project member', async () => {
    const res = await authed('/v1/projects/prj_1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'usr_1', role: 'field_worker' }),
    });
    assert.equal(res.statusCode, 201);
  });

  it("GET /v1/users/:userId/projects returns the user's project memberships", async () => {
    await authed('/v1/projects/prj_a/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'usr_1', role: 'field_worker' }),
    });
    await authed('/v1/projects/prj_b/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'usr_1', role: 'foreman' }),
    });
    const res = await authed('/v1/users/usr_1/projects');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.length, 2);
  });

  it('DELETE /v1/orgs/:orgId/members/:userId removes a member', async () => {
    await authed('/v1/orgs/org_1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'usr_1', role: 'project_admin' }),
    });
    const res = await authed('/v1/orgs/org_1/members/usr_1', { method: 'DELETE' });
    assert.equal(res.statusCode, 204);

    const list = await authed('/v1/orgs/org_1/members');
    assert.equal(list.json().data.length, 0);
  });

  it('POST with invalid role returns 422 problem+json', async () => {
    const res = await authed('/v1/orgs/org_1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'u1', role: 'god_mode' }),
    });
    assert.equal(res.statusCode, 422);
    const body = res.json();
    assert.match(body.detail, /unknown.*role/i);
    assert.ok(body.trace_id);
  });

  it('returns 401 when no bearer token is supplied', async () => {
    const res = (await app.inject({ method: 'GET', url: '/v1/orgs/org_1/members' })) as unknown as {
      statusCode: number;
      json: () => { title: string };
    };
    assert.equal(res.statusCode, 401);
    assert.match(res.json().title, /missing bearer/i);
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const res = (await app.inject({
      method: 'GET',
      url: '/v1/orgs/org_1/members',
      headers: { authorization: 'Bearer not-the-good-token' },
    })) as unknown as { statusCode: number };
    assert.equal(res.statusCode, 401);
  });
});
