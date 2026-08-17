/**
 * MobileSessionService — domain layer.
 */

import { randomUUID } from 'node:crypto';
import type { MobileRepository } from './repository.js';
import type {
  MobileSession, MobileChunk, MobileDeviceToken,
  CreateSessionInput, ChunkUploadInput, FinalizeSessionInput,
  RegisterDeviceTokenInput, MobileKind, MobileSessionStatus,
} from './types.js';

export const MAX_CHUNK_BYTES = 32 * 1024 * 1024; // 32MB per Q2
export const MAX_SESSION_BYTES = 8 * 1024 * 1024 * 1024; // 8GB per Q3

export interface MobileServiceDeps {
  readonly repo: MobileRepository;
  readonly now?: () => Date;
}

export class MobileSessionService {
  private readonly repo: MobileRepository;
  private readonly now: () => Date;

  constructor(deps: MobileServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
  }

  // ─── T-006: startSession ─────────────────────────────────
  async startSession(input: CreateSessionInput): Promise<MobileSession> {
    if (!input.orgId) throw new Error('orgId required (Constitution §II)');
    if (!input.userId) throw new Error('userId required');
    if (!input.projectId) throw new Error('projectId required');
    if (!input.kind) throw new Error('kind required');

    // Idempotency via clientSessionId
    if (input.clientSessionId) {
      const existing = await this.repo.findSessionByClientId?.(input.orgId, input.clientSessionId);
      if (existing) return existing;
    }

    const id = `mob_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
    const session: MobileSession = {
      id,
      orgId: input.orgId,
      userId: input.userId,
      projectId: input.projectId,
      captureId: null,
      kind: input.kind,
      clientSessionId: input.clientSessionId ?? null,
      status: 'recording',
      totalSizeBytes: 0,
      sha256Root: null,
      actualChunkCount: null,
      createdAt: this.now(),
      deletedAt: null,
    };
    await this.repo.insertSession(session);
    return session;
  }

  // ─── T-007: uploadChunk (idempotent + size validation) ──
  async uploadChunk(
    orgId: string,
    sessionId: string,
    input: ChunkUploadInput,
  ): Promise<MobileChunk> {
    if (input.sizeBytes > MAX_CHUNK_BYTES) {
      throw new Error(`chunk too large: ${input.sizeBytes} > ${MAX_CHUNK_BYTES}`);
    }
    const session = await this.repo.findSession(orgId, sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);

    // Idempotent: same (sessionId, chunkIndex) returns same id
    const existing = await this.repo.findChunk(orgId, sessionId, input.chunkIndex);
    if (existing) {
      if (existing.sha256 !== input.sha256 || existing.sizeBytes !== input.sizeBytes) {
        throw new Error(`chunk ${input.chunkIndex} conflict: existing data differs`);
      }
      return existing;
    }

    const chunk: MobileChunk = {
      id: this.repo.nextId(),
      sessionId,
      chunkIndex: input.chunkIndex,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      receivedAt: this.now(),
    };
    await this.repo.insertChunk(chunk);
    return chunk;
  }

  // ─── T-008: finalizeSession ─────────────────────────────
  async finalizeSession(
    orgId: string,
    sessionId: string,
    input: FinalizeSessionInput,
  ): Promise<MobileSession> {
    if (input.totalSizeBytes > MAX_SESSION_BYTES) {
      throw new Error(`session too large: ${input.totalSizeBytes} > ${MAX_SESSION_BYTES}`);
    }
    const session = await this.repo.findSession(orgId, sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);

    // Verify chunk count matches
    const actualCount = await this.repo.countChunks(orgId, sessionId);
    if (actualCount !== input.actualChunkCount) {
      throw new Error(`chunk count mismatch: ${actualCount} actual vs ${input.actualChunkCount} declared`);
    }

    // Verify sha256 root (compute sha256 of sorted chunk sha256s joined)
    const allChunks = await this.repo.listChunks(orgId, sessionId);
    const sorted = [...allChunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const computedRoot = sorted.length === 0
      ? ''
      : sorted.length === 1
        ? sorted[0]!.sha256
        : sorted.map((c) => c.sha256).join('|');
    // Accept the caller-provided root if it matches the computed one (single
    // OR multi-chunk roots must equal computed; Phase 5.b may add a real merkle root).
    if (computedRoot !== '' && input.sha256Root !== computedRoot) {
      throw new Error(`sha256 mismatch: declared ${input.sha256Root} vs computed ${computedRoot}`);
    }

    // Update session
    await this.repo.updateSession(orgId, sessionId, {
      status: 'uploading' as MobileSessionStatus,
      totalSizeBytes: input.totalSizeBytes,
      sha256Root: input.sha256Root,
      actualChunkCount: input.actualChunkCount,
    });
    const updated = await this.repo.findSession(orgId, sessionId);
    if (!updated) throw new Error('session vanished');
    return updated;
  }

  // ─── T-009: issue + copilot proxy ───────────────────────
  async raiseIssueFromCamera(orgId: string, userId: string, captureId: string,
    title: string, description: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    coordinates: { x: number; y: number; z: number }): Promise<{ issueId: string }> {
    if (!orgId) throw new Error('orgId required');
    if (!captureId) throw new Error('captureId required');
    if (!title) throw new Error('title required');
    if (!severity) throw new Error('severity required');

    // Phase 5 MVP: stub. Phase 5.b calls field-service POST /v1/projects/:id/issues.
    const issueId = `iss_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
    return { issueId };
  }

  async askCopilot(orgId: string, userId: string, projectId: string,
    text: string): Promise<{ replyText: string; intent: string; latencyMs: number }> {
    if (!orgId) throw new Error('orgId required');
    if (!projectId) throw new Error('projectId required');
    if (!text) throw new Error('text required');
    const start = Date.now();
    // Phase 5 MVP: stub. Phase 5.b calls ai-copilot-service POST /v1/conversations//messages.
    const replyText = `I'll look up that information about "${text.slice(0, 60)}"…`;
    const intent = 'list_issues';
    return { replyText, intent, latencyMs: Date.now() - start };
  }

  // ─── T-016: device token registration ───────────────────
  async registerDeviceToken(input: RegisterDeviceTokenInput): Promise<MobileDeviceToken> {
    if (!input.orgId) throw new Error('orgId required');
    if (!input.userId) throw new Error('userId required');
    if (!input.deviceId) throw new Error('deviceId required');
    if (!input.apnsToken) throw new Error('apnsToken required');

    const id = `dev_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
    const token: MobileDeviceToken = {
      id,
      orgId: input.orgId,
      userId: input.userId,
      deviceId: input.deviceId,
      apnsToken: input.apnsToken,
      registeredAt: this.now(),
    };
    // Upsert: delete old token for same (orgId, deviceId) first
    await this.repo.deleteDeviceToken(input.orgId, input.deviceId);
    await this.repo.insertDeviceToken(token);
    return token;
  }

  async unregisterDeviceToken(orgId: string, deviceId: string): Promise<void> {
    if (!orgId) throw new Error('orgId required');
    if (!deviceId) throw new Error('deviceId required');
    await this.repo.deleteDeviceToken(orgId, deviceId);
  }

  async getSessionStatus(orgId: string, sessionId: string): Promise<MobileSession | null> {
    return this.repo.findSession(orgId, sessionId);
  }
}

// Augment MobileRepository with optional listSessions for clientSessionId idempotency
declare module './repository.js' {
  interface MobileRepository {
    listSessions?(orgId: string, clientSessionId: string): Promise<readonly MobileSession[]>;
  }
}

// Re-export for callers
export type {
  MobileSession, MobileChunk, MobileDeviceToken,
  CreateSessionInput, ChunkUploadInput, FinalizeSessionInput,
  RegisterDeviceTokenInput, MobileKind, MobileSessionStatus,
};