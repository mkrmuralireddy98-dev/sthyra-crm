import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { IntegrationService, redactIntegration } from './service.js';
import { InMemoryIntegrationRepository } from './repo-memory.js';
import type { Integration } from './types.js';

const NOW = new Date('2026-09-01T12:00:00Z');

let service: IntegrationService;
let repo: InMemoryIntegrationRepository;

beforeEach(() => {
  repo = new InMemoryIntegrationRepository();
  service = new IntegrationService({ repo, now: () => NOW });
});

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int_1', orgId: 'org_a',
    provider: 'procore',
    config: { apiKey: 'secret-123' },
    status: 'connected',
    lastError: null,
    lastTestedAt: null,
    connectedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

describe('redactIntegration', () => {
  it('redacts apiKey', () => {
    const i = makeIntegration();
    const r = redactIntegration(i);
    assert.equal((r.config as Record<string, unknown>).apiKey, '***');
  });

  it('redacts oauthToken', () => {
    const r = redactIntegration(makeIntegration({
      provider: 'bim360',
      config: { oauthToken: 'tok' },
    }));
    assert.equal((r.config as Record<string, unknown>).oauthToken, '***');
  });

  it('preserves webhookUrl', () => {
    const r = redactIntegration(makeIntegration({
      provider: 'webhook',
      config: { webhookUrl: 'https://x.com/hook' },
    }));
    assert.equal((r.config as Record<string, unknown>).webhookUrl, 'https://x.com/hook');
  });
});

describe('IntegrationService.createIntegration (FR-1)', () => {
  it('creates with valid provider', async () => {
    const i = await service.createIntegration({
      orgId: 'org_a',
      provider: 'procore',
      config: { apiKey: 'k1' },
    });
    assert.ok(i.id.startsWith('int_'));
    assert.equal(i.status, 'connected');
  });

  it('throws on missing provider', async () => {
    await assert.rejects(
      () => service.createIntegration({ orgId: 'org_a', provider: '' as never, config: {} }),
      /provider required/,
    );
  });

  it('idempotent on same key', async () => {
    const input = { orgId: 'org_a', provider: 'procore' as const, config: { apiKey: 'k1' } };
    const a = await service.createIntegration(input, 'i1');
    const b = await service.createIntegration(input, 'i1');
    assert.equal(a.id, b.id);
  });
});

describe('IntegrationService.listIntegrations (FR-2)', () => {
  it('lists integrations with redacted config', async () => {
    await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    const list = await service.listIntegrations('org_a');
    assert.equal(list.length, 1);
    assert.equal((list[0]!.config as Record<string, unknown>).apiKey, '***');
  });

  it('isolates by tenant', async () => {
    await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    const list = await service.listIntegrations('org_b');
    assert.equal(list.length, 0);
  });
});

describe('IntegrationService.disconnect (FR-3)', () => {
  it('removes from list', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    await service.disconnect('org_a', i.id);
    const list = await service.listIntegrations('org_a');
    assert.equal(list.length, 0);
  });
});

describe('IntegrationService.triggerSync (FR-4)', () => {
  it('pulls RFIs from Procore', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    const result = await service.triggerSync('org_a', i.id, 'pull', ['rfi']);
    assert.equal(result.status, 'completed');
    assert.equal(result.itemsProcessed, 2);
  });

  it('returns completed for unknown entityType', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    const result = await service.triggerSync('org_a', i.id, 'pull', ['unknown']);
    assert.equal(result.status, 'completed');
    assert.equal(result.itemsProcessed, 0);
  });

  it('dryRun returns itemsProcessed=0', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    const result = await service.triggerSync('org_a', i.id, 'pull', ['rfi'], true);
    assert.equal(result.itemsProcessed, 0);
  });

  it('throws on cross-tenant', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    await assert.rejects(
      () => service.triggerSync('org_b', i.id, 'pull', ['rfi']),
      /not found/,
    );
  });
});

describe('IntegrationService.listSyncs (FR-5)', () => {
  it('lists syncs for an integration', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    await service.triggerSync('org_a', i.id, 'pull', ['rfi']);
    await service.triggerSync('org_a', i.id, 'pull', ['rfi']);
    const syncs = await service.listSyncs('org_a', i.id);
    assert.equal(syncs.length, 2);
  });
});

describe('IntegrationService.receiveWebhook (FR-6)', () => {
  it('accepts valid webhook token', async () => {
    const i = await service.createIntegration({
      orgId: 'org_a',
      provider: 'webhook',
      config: { webhookUrl: 'https://x.com/h', webhookToken: 'tok-123' },
    });
    const result = await service.receiveWebhook('org_a', i.id, 'tok-123', { eventType: 'x' });
    assert.equal(result.received, true);
    assert.equal(result.processed, true);
  });

  it('rejects invalid webhook token', async () => {
    const i = await service.createIntegration({
      orgId: 'org_a',
      provider: 'webhook',
      config: { webhookUrl: 'https://x.com/h', webhookToken: 'tok-123' },
    });
    const result = await service.receiveWebhook('org_a', i.id, 'wrong', {});
    assert.equal(result.received, false);
  });
});

describe('IntegrationService.testConnection (FR-8)', () => {
  it('succeeds with valid apiKey', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: { apiKey: 'k1' } });
    const result = await service.testConnection('org_a', i.id);
    assert.equal(result.ok, true);
  });

  it('fails with missing apiKey', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: {} });
    const result = await service.testConnection('org_a', i.id);
    assert.equal(result.ok, false);
    assert.match(result.error!, /apiKey/);
  });

  it('updates lastError on failure', async () => {
    const i = await service.createIntegration({ orgId: 'org_a', provider: 'procore', config: {} });
    await service.testConnection('org_a', i.id);
    const updated = await repo.findIntegration('org_a', i.id);
    assert.ok(updated!.lastError);
  });
});
