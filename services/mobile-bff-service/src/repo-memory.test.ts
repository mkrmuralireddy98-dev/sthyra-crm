import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { InMemoryMobileRepository } from './repo-memory.js';
import type { MobileSession, MobileChunk, MobileDeviceToken } from './types.js';

const makeSession = (overrides: Partial<MobileSession> = {}): MobileSession => ({
  id: 'mob_001',
  orgId: 'org_a',
  userId: 'user_1',
  projectId: 'prj_1',
  captureId: null,
  clientSessionId: null,
  kind: 'walkthrough_360',
  status: 'recording',
  totalSizeBytes: 0,
  sha256Root: null,
  actualChunkCount: null,
  createdAt: new Date('2026-08-14T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

describe('InMemoryMobileRepository', () => {
  it('insert + find round-trip', async () => {
    const repo = new InMemoryMobileRepository();
    const s = makeSession();
    await repo.insertSession(s);
    const found = await repo.findSession('org_a', 'mob_001');
    assert.deepEqual(found, s);
  });

  it('findSession returns null cross-tenant', async () => {
    const repo = new InMemoryMobileRepository();
    await repo.insertSession(makeSession({ orgId: 'org_a' }));
    const cross = await repo.findSession('org_b', 'mob_001');
    assert.equal(cross, null);
  });

  it('findSessionByClientId matches by clientSessionId', async () => {
    const repo = new InMemoryMobileRepository();
    await repo.insertSession(makeSession({ clientSessionId: 'cli-001', id: 'mob_a' }));
    await repo.insertSession(makeSession({ clientSessionId: 'cli-002', id: 'mob_b' }));
    const a = await repo.findSessionByClientId('org_a', 'cli-001');
    const b = await repo.findSessionByClientId('org_a', 'cli-002');
    assert.equal(a?.id, 'mob_a');
    assert.equal(b?.id, 'mob_b');
  });

  it('findSessionByClientId returns null cross-tenant', async () => {
    const repo = new InMemoryMobileRepository();
    await repo.insertSession(makeSession({ clientSessionId: 'cli-001', orgId: 'org_a' }));
    const cross = await repo.findSessionByClientId('org_b', 'cli-001');
    assert.equal(cross, null);
  });

  it('insertChunk + findChunk idempotency', async () => {
    const repo = new InMemoryMobileRepository();
    await repo.insertSession(makeSession());
    const c: MobileChunk = {
      id: 1, sessionId: 'mob_001', chunkIndex: 0, sha256: 'a', sizeBytes: 1024, receivedAt: new Date(),
    };
    await repo.insertChunk(c);
    const found = await repo.findChunk('org_a', 'mob_001', 0);
    assert.equal(found?.sha256, 'a');
  });

  it('countChunks and sumChunkSizes', async () => {
    const repo = new InMemoryMobileRepository();
    await repo.insertSession(makeSession());
    await repo.insertChunk({ id: 1, sessionId: 'mob_001', chunkIndex: 0, sha256: 'a', sizeBytes: 100, receivedAt: new Date() });
    await repo.insertChunk({ id: 2, sessionId: 'mob_001', chunkIndex: 1, sha256: 'b', sizeBytes: 200, receivedAt: new Date() });
    assert.equal(await repo.countChunks('org_a', 'mob_001'), 2);
    assert.equal(await repo.sumChunkSizes('org_a', 'mob_001'), 300);
  });

  it('insertDeviceToken + findDeviceToken', async () => {
    const repo = new InMemoryMobileRepository();
    const t: MobileDeviceToken = {
      id: 'dev_001', orgId: 'org_a', userId: 'user_1',
      deviceId: 'iPhone-XYZ', apnsToken: 'apns-token-abc', registeredAt: new Date(),
    };
    await repo.insertDeviceToken(t);
    const found = await repo.findDeviceToken('org_a', 'iPhone-XYZ');
    assert.equal(found?.apnsToken, 'apns-token-abc');
  });

  it('deleteDeviceToken removes', async () => {
    const repo = new InMemoryMobileRepository();
    await repo.insertDeviceToken({
      id: 'dev_001', orgId: 'org_a', userId: 'user_1',
      deviceId: 'iPhone-XYZ', apnsToken: 't', registeredAt: new Date(),
    });
    await repo.deleteDeviceToken('org_a', 'iPhone-XYZ');
    const found = await repo.findDeviceToken('org_a', 'iPhone-XYZ');
    assert.equal(found, null);
  });
});