import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAdminRepository } from './repo-memory.js';

test('seed data has 3 tenants', async () => {
 const repo = new InMemoryAdminRepository();
 const result = await repo.listTenants({}, { limit: 50 });
 assert.equal(result.items.length, 3);
});

test('create tenant returns new id and active status', async () => {
 const repo = new InMemoryAdminRepository();
 const t = await repo.createTenant({ name: 'New Co', region: 'ap-southeast', plan: 'pro' }, 'usr_admin');
 assert.match(t.id, /^org_/);
 assert.equal(t.status, 'active');
 assert.equal(t.userCount, 0);
});

test('suspend tenant toggles status', async () => {
 const repo = new InMemoryAdminRepository();
 const suspended = await repo.suspendTenant('org_a', 'non-payment', 'usr_admin');
 assert.equal(suspended?.status, 'suspended');
 const resumed = await repo.resumeTenant('org_a', 'paid', 'usr_admin');
 assert.equal(resumed?.status, 'active');
});

test('audit entries are listed in reverse order', async () => {
 const repo = new InMemoryAdminRepository();
 await repo.writeAudit({
 actorId: 'a', actionType: 'tenant.suspend', targetType: 'tenant',
 targetId: 't1', reason: 'r1', metadata: {},
 });
 await repo.writeAudit({
 actorId: 'b', actionType: 'tenant.resume', targetType: 'tenant',
 targetId: 't2', reason: 'r2', metadata: {},
 });
 const result = await repo.listAudit({}, { limit: 50 });
 assert.equal(result.items[0]?.actorId, 'b');
});

test('feature flag override persists', async () => {
 const repo = new InMemoryAdminRepository();
 const updated = await repo.setFeatureFlag('capture.gpu_acceleration', 'org_a', true, 'trial', 'usr_admin');
 assert.equal(updated?.overrides['org_a'], true);
});
