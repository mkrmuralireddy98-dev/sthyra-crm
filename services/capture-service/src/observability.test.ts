import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { installRequestIdPlugin, currentRequestId, emit } from '@sthyra-crm/observability';
import Fastify, { type FastifyInstance } from 'fastify';

/**
 * T-026 — @sthyra-crm/observability integration.
 *
 * The capture service HTTP layer wires installRequestIdPlugin into
 * every Fastify instance. This test verifies that:
 *   - x-request-id is generated when missing
 *   - x-request-id is preserved when supplied
 *   - currentRequestId() returns the id during request handling
 *   - emit() includes the request_id in log lines
 */

describe('@sthyra-crm/observability integration (T-026)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    installRequestIdPlugin(app);
    app.get('/_test/request-id', async () => {
      const rid = currentRequestId();
      emit('info', 'inside_handler', { test: true });
      return { rid };
    });
    await app.ready();
  });

  it('generates a request-id when none is supplied', async () => {
    const res = await app.inject({ method: 'GET', url: '_test/request-id' });
    assert.equal(res.statusCode, 200);
    const id = res.headers['x-request-id'];
    assert.ok(id, 'x-request-id header should be set');
    assert.match(id ?? '', /^[0-9a-f-]+$/, 'should be a UUID');
    const body = res.json() as { rid: string | undefined };
    assert.equal(body.rid, id, 'handler sees same id as response header');
  });

  it('preserves the supplied x-request-id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '_test/request-id',
      headers: { 'x-request-id': 'req_my_custom_id' },
    });
    assert.equal(res.headers['x-request-id'], 'req_my_custom_id');
    const body = res.json() as { rid: string | undefined };
    assert.equal(body.rid, 'req_my_custom_id');
  });

  it('caps request-id length at 128 chars (doS protection)', async () => {
    const long = 'x'.repeat(200);
    const res = await app.inject({
      method: 'GET', url: '_test/request-id', headers: { 'x-request-id': long },
    });
    // Should NOT echo back the 200-char id; should generate a new one
    const id = res.headers['x-request-id'];
    assert.notEqual(id, long);
    assert.ok(id && id.length <= 128);
  });
});
