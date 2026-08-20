import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TenantSummary, UserSummary, AuditEntry, FeatureFlag, SystemHealth } from './types.js';

test('TenantSummary shape', () => {
  const t: TenantSummary = {
    id: 'org_test',
    name: 'Acme Construction',
    region: 'us-east',
    plan: 'pro',
    status: 'active',
    createdAt: new Date(),
    userCount: 5,
  };
  assert.equal(t.id, 'org_test');
  assert.equal(t.region, 'us-east');
});

test('UserSummary supports multi-tenant', () => {
  const u: UserSummary = {
    id: 'usr_test',
    email: 'a@b.com',
    name: 'Alice',
    role: 'admin',
    tenantIds: ['org_a', 'org_b'],
    lastLoginAt: null,
    status: 'active',
  };
  assert.equal(u.tenantIds.length, 2);
});

test('AuditEntry has required fields', () => {
  const a: AuditEntry = {
    id: 'aud_test',
    actorId: 'usr_admin',
    actionType: 'tenant.suspend',
    targetType: 'tenant',
    targetId: 'org_x',
    reason: 'non-payment',
    metadata: { ip: '1.2.3.4' },
    occurredAt: new Date(),
  };
  assert.equal(a.actionType, 'tenant.suspend');
});

test('FeatureFlag has overrides', () => {
  const f: FeatureFlag = {
    key: 'capture.gpu_acceleration',
    description: 'Enable GPU pipeline',
    defaultEnabled: false,
    overrides: { org_enterprise_a: true },
    updatedAt: new Date(),
    updatedBy: 'usr_admin',
  };
  assert.equal(f.overrides['org_enterprise_a'], true);
});

test('SystemHealth aggregates services', () => {
  const h: SystemHealth = {
    status: 'healthy',
    services: [
      { service: 'capture-service', status: 'healthy', latencyMs: 12, checkedAt: new Date(), error: null },
      { service: 'field-service', status: 'healthy', latencyMs: 8, checkedAt: new Date(), error: null },
    ],
    checkedAt: new Date(),
  };
  assert.equal(h.services.length, 2);
});
