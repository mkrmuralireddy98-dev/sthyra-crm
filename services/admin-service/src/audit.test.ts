import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogger } from './audit.js';
import { InMemoryAdminRepository } from './repo-memory.js';

test('audit write returns entry with id and occurredAt', async () => {
 const repo = new InMemoryAdminRepository();
 const logger = new AuditLogger(repo);
 const entry = await logger.write({
 actorId: 'usr_admin',
 actionType: 'tenant.suspend',
 targetType: 'tenant',
 targetId: 'org_a',
 reason: 'non-payment',
 });
 assert.equal(entry.actorId, 'usr_admin');
 assert.match(entry.id, /^aud_\d+$/);
 assert.ok(entry.occurredAt instanceof Date);
});

test('audit write supports all action types', async () => {
 const repo = new InMemoryAdminRepository();
 const logger = new AuditLogger(repo);
 const types: any[] = [
 'tenant.create', 'tenant.suspend', 'tenant.resume',
 'user.logout', 'user.reset_password', 'feature_flag.toggle',
 ];
 for (const actionType of types) {
 const e = await logger.write({
 actorId: 'usr_admin',
 actionType,
 targetType: 'tenant',
 targetId: 'x',
 reason: 'test',
 });
 assert.equal(e.actionType, actionType);
 }
});

test('audit metadata is preserved', async () => {
 const repo = new InMemoryAdminRepository();
 const logger = new AuditLogger(repo);
 const e = await logger.write({
 actorId: 'usr_admin',
 actionType: 'user.logout',
 targetType: 'user',
 targetId: 'usr_x',
 reason: 'compromised credentials',
 metadata: { ip: '1.2.3.4', userAgent: 'curl/8' },
 });
 assert.deepEqual(e.metadata, { ip: '1.2.3.4', userAgent: 'curl/8' });
});
