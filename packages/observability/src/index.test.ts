import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import { emit, installRequestIdPlugin, installCorsPlugin, currentRequestId } from './index.js';

describe('observability', () => {
  it('installRequestIdPlugin assigns x-request-id and echoes it back', async () => {
    const app = Fastify({ logger: false });
    installRequestIdPlugin(app);
    app.get('/v1/health', async () => ({ status: 'ok' }));
    await app.ready();

    // No incoming header → server mints a UUID.
    const res1 = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.ok(res1.headers['x-request-id']);
    assert.match(String(res1.headers['x-request-id']), /^[0-9a-f-]{36}$/);

    // With incoming header → server echoes it.
    const incoming = 'req_test_abc';
    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { 'x-request-id': incoming },
    });
    assert.equal(res2.headers['x-request-id'], incoming);

    await app.close();
  });

  it('rejects an over-long incoming x-request-id and mints a new one', async () => {
    const app = Fastify({ logger: false });
    installRequestIdPlugin(app);
    app.get('/v1/health', async () => ({ status: 'ok' }));
    await app.ready();

    const huge = 'x'.repeat(500);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { 'x-request-id': huge },
    });
    const id = String(res.headers['x-request-id']);
    assert.notEqual(id, huge);
    assert.match(id, /^[0-9a-f-]{36}$/);

    await app.close();
  });

  it('currentRequestId returns the id set by installRequestIdPlugin during a request', async () => {
    const app = Fastify({ logger: false });
    installRequestIdPlugin(app);
    let observed: string | undefined;
    app.get('/v1/whoami', async () => {
      observed = currentRequestId();
      return { id: observed };
    });
    await app.ready();

    const incoming = 'req_in_async_local_storage';
    const res = await app.inject({
      method: 'GET',
      url: '/v1/whoami',
      headers: { 'x-request-id': incoming },
    });
    assert.equal(res.json().id, incoming);
    assert.equal(observed, incoming);

    await app.close();
  });

  it('emit emits a structured JSON log line with the current request_id', async () => {
    const lines: string[] = [];
    const originalLog = console.log;
    // eslint-disable-next-line no-console
    console.log = (line: string) => {
      lines.push(line);
    };
    try {
      const app = Fastify({ logger: false });
      installRequestIdPlugin(app);
      app.get('/v1/emit', async () => {
        emit('test_event', { foo: 'bar' }, { service: 'sthyra-crm-test', level: 'info' });
        return { ok: true };
      });
      await app.ready();

      const incoming = 'req_log_test';
      await app.inject({
        method: 'GET',
        url: '/v1/emit',
        headers: { 'x-request-id': incoming },
      });

      await app.close();

      const matching = lines.filter((l) => l.includes('test_event'));
      assert.ok(matching.length >= 1);
      const parsed = JSON.parse(matching[matching.length - 1]!);
      assert.equal(parsed.service, 'sthyra-crm-test');
      assert.equal(parsed.request_id, incoming);
      assert.equal(parsed.level, 'info');
      assert.deepEqual(parsed.fields, { foo: 'bar' });
    } finally {
      // eslint-disable-next-line no-console
      console.log = originalLog;
    }
  });
});
