import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { ApiError, createOrg, listOrgs, listProjects, archiveProject } from './api.js';

describe('api client', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockImpl: (url: string, init?: RequestInit) => Promise<Response>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockImpl = async () =>
      new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });
    globalThis.fetch = mockImpl as unknown as typeof globalThis.fetch;
  });

  function setFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
    mockImpl = impl;
    globalThis.fetch = impl as unknown as typeof globalThis.fetch;
  }

  function restoreFetch() {
    globalThis.fetch = originalFetch;
  }

  it('createOrg POSTs to /v1/orgs with JSON body and request-id', async () => {
    let lastUrl = '';
    let lastInit: RequestInit | undefined;
    setFetch(async (url, init) => {
      lastUrl = url;
      lastInit = init;
      return new Response(
        JSON.stringify({ id: 'org_1', name: 'X', region: 'us-east', plan: 'pro', createdAt: 'now' }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    });

    const org = await createOrg({ name: 'X', region: 'us-east', plan: 'pro' }, { requestId: 'req_a' });
    assert.equal(org.id, 'org_1');
    assert.equal(lastUrl, 'http://127.0.0.1:8080/v1/orgs');
    assert.equal(lastInit?.method, 'POST');
    const headers = lastInit?.headers as Record<string, string>;
    assert.equal(headers['x-request-id'], 'req_a');
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(lastInit?.body, JSON.stringify({ name: 'X', region: 'us-east', plan: 'pro' }));
  });

  it('mints a request-id when none is provided', async () => {
    let capturedId = '';
    setFetch(async (_url, init) => {
      capturedId = (init?.headers as Record<string, string>)['x-request-id'] ?? '';
      return new Response(JSON.stringify({ id: 'org_1', name: 'X', region: 'us-east', plan: 'pro', createdAt: 'now' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    });
    await createOrg({ name: 'X', region: 'us-east', plan: 'pro' });
    assert.ok(capturedId.length > 0, `expected a request-id, got "${capturedId}"`);
  });

  it('rejects with an ApiError carrying the trace_id from the server', async () => {
    setFetch(async () =>
      new Response(
        JSON.stringify({
          type: 'https://plumb.dev/errors/conflict',
          title: 'Organization already exists',
          status: 409,
          detail: 'already exists',
          trace_id: 'srv-trace-123',
          code: 'already_exists',
        }),
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    await assert.rejects(
      () => createOrg({ name: 'X', region: 'us-east', plan: 'pro' }),
      (err: unknown) => {
        const e = err as ApiError;
        return e.status === 409 && e.code === 'already_exists' && e.traceId === 'srv-trace-123';
      },
    );
  });

  it('listProjects returns the data array', async () => {
    setFetch(async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 'p1', orgId: 'org_1', name: 'A', status: 'active', address: 'a', startedAt: 't', createdAt: 't' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const projects = await listProjects('org_1');
    assert.equal(projects.length, 1);
    assert.equal(projects[0]?.id, 'p1');
  });

  it('listOrgs GETs /v1/orgs and deserializes the {data: Org[]} envelope', async () => {
    let lastUrl = '';
    setFetch(async (url) => {
      lastUrl = url;
      return new Response(
        JSON.stringify({
          data: [
            { id: 'org_1', name: 'A', region: 'us-east', plan: 'pro', createdAt: 't' },
            { id: 'org_2', name: 'B', region: 'eu-west', plan: 'free', createdAt: 't' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const orgs = await listOrgs();
    assert.equal(orgs.length, 2);
    assert.equal(orgs[0]?.id, 'org_1');
    assert.equal(orgs[1]?.region, 'eu-west');
    assert.equal(lastUrl, 'http://127.0.0.1:8080/v1/orgs');
  });

  it('archiveProject POSTs to /v1/projects/:id/archive', async () => {
    let lastUrl = '';
    setFetch(async (url, init) => {
      lastUrl = url;
      return new Response(
        JSON.stringify({ id: 'p1', orgId: 'org_1', name: 'A', status: 'archived', address: 'a', startedAt: 't', createdAt: 't', archivedAt: 'now' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const project = await archiveProject('p1');
    assert.equal(project.status, 'archived');
    assert.equal(lastUrl, 'http://127.0.0.1:8082/v1/projects/p1/archive');
  });
});
