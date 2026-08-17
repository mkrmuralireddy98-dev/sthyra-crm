import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { MobileSessionService, type MobileServiceDeps } from './service.js';
import type { MobileRepository } from './repository.js';
import type {
  MobileSession, MobileChunk, MobileDeviceToken,
  CreateSessionInput, MobileKind, MobileSessionStatus,
} from './types.js';

let sessions: MobileSession[] = [];
let chunks: MobileChunk[] = [];
let devices: MobileDeviceToken[] = [];
let counter = 0;

function makeRepo(): MobileRepository {
  return {
    insertSession: async (s) => { sessions.push(s); },
    findSession: async (orgId, id) => sessions.find((s) => s.orgId === orgId && s.id === id) ?? null,
    findSessionByClientId: async (orgId, clientSessionId) =>
      sessions.find((s) => s.orgId === orgId && s.clientSessionId === clientSessionId) ?? null,
    updateSession: async (orgId, id, patch) => {
      const s = sessions.find((x) => x.orgId === orgId && x.id === id);
      if (s) Object.assign(s, patch);
    },
    softDeleteSession: async (orgId, id) => {
      const s = sessions.find((x) => x.orgId === orgId && x.id === id);
      if (s) s.deletedAt = new Date();
    },
    insertChunk: async (c) => { chunks.push(c); },
    findChunk: async (_orgId, sessionId, idx) =>
      chunks.find((c) => c.sessionId === sessionId && c.chunkIndex === idx) ?? null,
    listChunks: async (_orgId, sessionId) => chunks.filter((c) => c.sessionId === sessionId),
    countChunks: async (_orgId, sessionId) => chunks.filter((c) => c.sessionId === sessionId).length,
    sumChunkSizes: async (_orgId, sessionId) =>
      chunks.filter((c) => c.sessionId === sessionId).reduce((sum, c) => sum + c.sizeBytes, 0),
    insertDeviceToken: async (d) => { devices.push(d); },
    findDeviceToken: async (orgId, deviceId) =>
      devices.find((d) => d.orgId === orgId && d.deviceId === deviceId) ?? null,
    deleteDeviceToken: async (orgId, deviceId) => {
      devices = devices.filter((d) => !(d.orgId === orgId && d.deviceId === deviceId));
    },
    nextId: () => ++counter,
  };
}

let service: MobileSessionService;

beforeEach(() => {
  sessions = [];
  chunks = [];
  devices = [];
  counter = 0;
  service = new MobileSessionService({ repo: makeRepo() });
});

describe('MobileSessionService — startSession (T-006)', () => {
  it('returns a new session with server-assigned id', async () => {
    const result = await service.startSession({
      orgId: 'org_a', userId: 'user_1', projectId: 'prj_1', kind: 'walkthrough_360',
    });
    assert.ok(result.id.startsWith('mob_'));
    assert.equal(result.status, 'recording');
  });

  it('persists session in repo', async () => {
    const result = await service.startSession({
      orgId: 'org_a', userId: 'user_1', projectId: 'prj_1', kind: 'walkthrough_360',
    });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.id, result.id);
  });

  it('duplicate clientSessionId returns the original (idempotent)', async () => {
    const input: CreateSessionInput = {
      orgId: 'org_a', userId: 'user_1', projectId: 'prj_1', kind: 'walkthrough_360', clientSessionId: 'cli-1',
    };
    const a = await service.startSession(input);
    const b = await service.startSession(input);
    assert.equal(a.id, b.id);
    assert.equal(sessions.length, 1);
  });

  it('throws on missing orgId', async () => {
    await assert.rejects(
      service.startSession({ orgId: '', userId: 'u', projectId: 'p', kind: 'walkthrough_360' }),
      /orgId required/,
    );
  });

  it('throws on missing userId', async () => {
    await assert.rejects(
      service.startSession({ orgId: 'o', userId: '', projectId: 'p', kind: 'walkthrough_360' }),
      /userId required/,
    );
  });

  it('throws on missing projectId', async () => {
    await assert.rejects(
      service.startSession({ orgId: 'o', userId: 'u', projectId: '', kind: 'walkthrough_360' }),
      /projectId required/,
    );
  });

  it('records all 4 kinds correctly', async () => {
    for (const kind of ['walkthrough_360', 'preconstruction', 'postconstruction', 'incident'] as MobileKind[]) {
      const r = await service.startSession({ orgId: 'o', userId: 'u', projectId: 'p', kind });
      assert.equal(r.kind, kind);
    }
  });
});

describe('MobileSessionService — uploadChunk (T-007)', () => {
  it('records a new chunk', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    const result = await service.uploadChunk('o', session.id, {
      sessionId: session.id,
      chunkIndex: 0,
      sha256: 'abc123',
      sizeBytes: 32 * 1024 * 1024, // 32MB exactly
    });
    assert.ok(result.id > 0);
    assert.equal(result.chunkIndex, 0);
  });

  it('idempotent upload: same chunk returns same id', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    const input = { sessionId: session.id, chunkIndex: 0, sha256: 'abc', sizeBytes: 1024 };
    const a = await service.uploadChunk('o', session.id, input);
    const b = await service.uploadChunk('o', session.id, input);
    assert.equal(a.id, b.id);
    assert.equal(chunks.length, 1);
  });

  it('rejects chunk > 32MB with size error (NFR-8)', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    await assert.rejects(
      service.uploadChunk('o', session.id, {
        sessionId: session.id,
        chunkIndex: 0,
        sha256: 'abc',
        sizeBytes: 33 * 1024 * 1024, // 33MB > 32MB
      }),
      /chunk too large/i,
    );
  });

  it('accepts out-of-order chunks (Q6 permissive ordering)', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    await service.uploadChunk('o', session.id, {
      sessionId: session.id, chunkIndex: 5, sha256: 'c5', sizeBytes: 1024,
    });
    await service.uploadChunk('o', session.id, {
      sessionId: session.id, chunkIndex: 2, sha256: 'c2', sizeBytes: 1024,
    });
    assert.equal(chunks.length, 2);
  });

  it('rejects upload to non-existent session (cross-tenant 404)', async () => {
    await assert.rejects(
      service.uploadChunk('o', 'mob_nonexistent', {
        sessionId: 'mob_nonexistent',
        chunkIndex: 0,
        sha256: 'a',
        sizeBytes: 1024,
      }),
      /session not found/i,
    );
  });
});

describe('MobileSessionService — finalizeSession (T-008)', () => {
  it('throws when chunk count mismatches', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    await service.uploadChunk('o', session.id, {
      sessionId: session.id, chunkIndex: 0, sha256: 'a', sizeBytes: 1024,
    });
    await assert.rejects(
      service.finalizeSession('o', session.id, {
        sessionId: session.id, actualChunkCount: 5, totalSizeBytes: 1024, sha256Root: 'root',
      }),
      /chunk count mismatch/i,
    );
  });

  it('throws when sha256Root mismatches', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    await service.uploadChunk('o', session.id, {
      sessionId: session.id, chunkIndex: 0, sha256: 'a', sizeBytes: 1024,
    });
    await assert.rejects(
      service.finalizeSession('o', session.id, {
        sessionId: session.id, actualChunkCount: 1, totalSizeBytes: 1024, sha256Root: 'wrong',
      }),
      /sha256 mismatch/i,
    );
  });

  it('transitions session to uploading on success', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    await service.uploadChunk('o', session.id, {
      sessionId: session.id, chunkIndex: 0, sha256: 'a', sizeBytes: 1024,
    });
    const finalized = await service.finalizeSession('o', session.id, {
      sessionId: session.id, actualChunkCount: 1, totalSizeBytes: 1024, sha256Root: 'a',
    });
    assert.equal(finalized.status, 'uploading');
  });

  it('throws when session totalSizeBytes > 8GB (NFR-8)', async () => {
    const session = await service.startSession({
      orgId: 'o', userId: 'u', projectId: 'p', kind: 'walkthrough_360',
    });
    await service.uploadChunk('o', session.id, {
      sessionId: session.id, chunkIndex: 0, sha256: 'a', sizeBytes: 1024,
    });
    await assert.rejects(
      service.finalizeSession('o', session.id, {
        sessionId: session.id, actualChunkCount: 1, totalSizeBytes: 9 * 1024 * 1024 * 1024, sha256Root: 'a',
      }),
      /session too large/i,
    );
  });
});

// Silence unused-import warnings
void (0 as unknown as MobileSessionStatus);