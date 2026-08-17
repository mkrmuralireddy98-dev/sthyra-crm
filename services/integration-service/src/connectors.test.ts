import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { getConnector } from './connectors.js';

describe('connectors', () => {
  it('procore testConnection requires apiKey', async () => {
    const conn = getConnector('procore');
    const ok = await conn.testConnection({});
    assert.equal(ok.ok, false);
    assert.match(ok.error!, /apiKey/);
  });

  it('procore testConnection succeeds with apiKey', async () => {
    const conn = getConnector('procore');
    const ok = await conn.testConnection({ apiKey: 'abc' });
    assert.equal(ok.ok, true);
  });

  it('procore pull rfi returns 2 stub items', async () => {
    const conn = getConnector('procore');
    const items = await conn.pull('rfi', {});
    assert.equal(items.length, 2);
  });

  it('bim360 pull issue returns 1 stub item', async () => {
    const conn = getConnector('bim360');
    const items = await conn.pull('issue', {});
    assert.equal(items.length, 1);
  });

  it('plangrid pull punch_list returns 1 stub item', async () => {
    const conn = getConnector('plangrid');
    const items = await conn.pull('punch_list', {});
    assert.equal(items.length, 1);
  });

  it('webhook testConnection requires webhookUrl', async () => {
    const conn = getConnector('webhook');
    const ok = await conn.testConnection({});
    assert.equal(ok.ok, false);
  });

  it('push returns written count', async () => {
    const conn = getConnector('procore');
    const result = await conn.push('rfi', [{ id: '1' }, { id: '2' }], {});
    assert.equal(result.written, 2);
  });

  it('pull for unknown entityType returns empty', async () => {
    const conn = getConnector('procore');
    const items = await conn.pull('unknown', {});
    assert.equal(items.length, 0);
  });
});
