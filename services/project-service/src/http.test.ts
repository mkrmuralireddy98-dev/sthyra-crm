import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildServer } from './http.js';
import { ProjectService, InMemoryProjectRepository } from './index.js';

describe('project-service HTTP', () => {
  let service: ProjectService;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    service = new ProjectService(new InMemoryProjectRepository());
    app = buildServer({ service });
    await app.ready();
  });

  it('POST /v1/projects creates a project and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        orgId: 'org_00000001',
        name: 'Hudson Tower',
        address: '500 W 33rd St',
        startedAt: '2026-01-15T00:00:00.000Z',
      }),
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.id);
    assert.equal(body.orgId, 'org_00000001');
    assert.equal(body.status, 'active');
  });

  it('POST /v1/projects with missing name returns 422 problem+json', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        orgId: 'org_x',
        name: '',
        address: 'A',
        startedAt: '2026-01-15T00:00:00.000Z',
      }),
    });
    assert.equal(res.statusCode, 422);
    assert.ok(String(res.headers['content-type']).includes('application/problem+json'));
  });

  it('GET /v1/projects?orgId=X lists projects for that org only', async () => {
    await service.create({ orgId: 'org_a', name: 'A1', address: 'x', startedAt: new Date() });
    await service.create({ orgId: 'org_a', name: 'A2', address: 'y', startedAt: new Date() });
    await service.create({ orgId: 'org_b', name: 'B1', address: 'z', startedAt: new Date() });

    const res = await app.inject({ method: 'GET', url: '/v1/projects?orgId=org_a' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.data.length, 2);
    assert.ok(body.data.every((p: { orgId: string }) => p.orgId === 'org_a'));
  });

  it('GET /v1/projects requires orgId query param', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/projects' });
    assert.equal(res.statusCode, 422);
  });

  it('GET /v1/projects/:id returns the project', async () => {
    const created = await service.create({
      orgId: 'org_a',
      name: 'A',
      address: 'A',
      startedAt: new Date(),
    });
    const res = await app.inject({ method: 'GET', url: `/v1/projects/${created.id}` });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().id, created.id);
  });

  it('POST /v1/projects/:id/archive archives the project', async () => {
    const created = await service.create({
      orgId: 'org_a',
      name: 'A',
      address: 'A',
      startedAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${created.id}/archive`,
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'archived');
    assert.ok(res.json().archivedAt);
  });

  it('POST /v1/projects/:id/archive returns 409 if already archived', async () => {
    const created = await service.create({
      orgId: 'org_a',
      name: 'A',
      address: 'A',
      startedAt: new Date(),
    });
    await service.archive(created.id);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${created.id}/archive`,
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().status, 409);
  });

  it('GET /v1/health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: 'ok' });
  });
});
