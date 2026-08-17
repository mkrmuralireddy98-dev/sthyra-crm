import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { startInMemoryServer, type StartedServer } from './cli.js';

describe('dashboard-service CLI — end-to-end', () => {
  let started: StartedServer | null = null;

  afterEach(async () => {
    if (started) {
      await started.stop();
      started = null;
    }
  });

  it('boots and serves /v1/health', async () => {
    started = await startInMemoryServer();
    const res = await fetch('http://127.0.0.1:' + started.port + '/v1/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  it('boots and serves HTML home page with tenant', async () => {
    started = await startInMemoryServer();
    const res = await fetch('http://127.0.0.1:' + started.port + '/', {
      headers: { 'x-tenant-id': 'org_a' },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    const body = await res.text();
    assert.match(body, /<!DOCTYPE html>/);
  });

  it('returns 401 without tenant header', async () => {
    started = await startInMemoryServer();
    const res = await fetch('http://127.0.0.1:' + started.port + '/');
    assert.equal(res.status, 401);
  });
});
