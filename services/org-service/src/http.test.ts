import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildServer } from './http.js';
import { OrgService, InMemoryOrgRepository } from './index.js';

describe('org-service HTTP', () => {
  let service: OrgService;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    service = new OrgService(new InMemoryOrgRepository());
    app = buildServer({ service });
    await app.ready();
  });

  it('POST /v1/orgs creates an org and returns 201 with the org', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Hudson Tower GC', region: 'us-east', plan: 'pro' }),
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.id);
    assert.equal(body.name, 'Hudson Tower GC');
    assert.equal(body.region, 'us-east');
    assert.equal(body.plan, 'pro');
    assert.ok(body.createdAt);
  });

  it('POST /v1/orgs with an invalid region returns RFC 7807 problem+json 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Acme', region: 'mars', plan: 'pro' }),
    });

    assert.equal(res.statusCode, 422);
    const ct = res.headers['content-type'];
    assert.ok(String(ct).includes('application/problem+json'), `content-type was ${ct}`);
    const body = res.json();
    assert.equal(body.status, 422);
    assert.match(body.title, /region/i);
    assert.ok(body.detail?.length > 0);
    assert.ok(body.trace_id, 'must include a trace_id');
  });

  it('POST /v1/orgs with a duplicate (name, region) returns 409 problem+json', async () => {
    const payload = JSON.stringify({ name: 'Acme', region: 'us-east', plan: 'pro' });
    await app.inject({ method: 'POST', url: '/v1/orgs', headers: { 'content-type': 'application/json' }, payload });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { 'content-type': 'application/json' },
      payload,
    });

    assert.equal(res.statusCode, 409);
    const body = res.json();
    assert.equal(body.status, 409);
    assert.match(body.title, /already exists/i);
  });

  it('GET /v1/orgs/:id returns the org', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Acme', region: 'us-east', plan: 'pro' }),
    });
    const createdBody = created.json();

    const res = await app.inject({ method: 'GET', url: `/v1/orgs/${createdBody.id}` });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().id, createdBody.id);
  });

  it('GET /v1/orgs/:id returns 404 problem+json for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/orgs/does-not-exist' });
    assert.equal(res.statusCode, 404);
    const body = res.json();
    assert.equal(body.status, 404);
    assert.ok(body.trace_id);
  });

  it('GET /v1/health returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: 'ok' });
  });

  it('respects Idempotency-Key: same key returns 409 with the existing org', async () => {
    const payload = JSON.stringify({ name: 'Acme', region: 'us-east', plan: 'pro' });
    const first = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'k-1' },
      payload,
    });
    assert.equal(first.statusCode, 201);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'k-1' },
      payload,
    });
    assert.equal(second.statusCode, 409);
    const body = second.json();
    assert.equal(body.status, 409);
    assert.match(body.title, /idempotency/i);
  });
});
