/**
 * CaptureRepository — tenant-scoped storage contract (Constitution §II).
 *
 * Every method takes `orgId` as the first argument. The in-memory
 * implementation lives in repo-memory.ts. The Postgres implementation
 * (Phase 1.b) will live in repo-postgres.ts and satisfy the same
 * interface so service.ts is unchanged at the storage boundary.
 *
 * Tenant boundary is enforced by the keying strategy (per-tenant Map)
 * in the in-memory impl, and by `WHERE org_id = $1 AND ...` clauses
 * in every query in the Postgres impl.
 */

import type {
 Capture,
 CaptureStatus,
 UploadSession,
 UploadSessionStatus,
} from './types.js';

export interface CaptureRepository {
 insertCapture(capture: Capture): Promise<void>;
 findCapture(orgId: string, id: string): Promise<Capture | null>;
 findCaptureByClientId(orgId: string, projectId: string, clientCaptureId: string): Promise<Capture | null>;
 listCaptures(
 orgId: string,
 projectId: string,
 filter?: { status?: CaptureStatus },
 ): Promise<readonly Capture[]>;
 updateCaptureStatus(
 orgId: string,
 id: string,
 status: CaptureStatus,
 extra?: { errorMessage?: string; finalizedAt?: Date; sha256?: string },
 ): Promise<void>;
 archiveCapture(orgId: string, id: string): Promise<void>;

 insertUploadSession(session: UploadSession): Promise<void>;
 findUploadSession(orgId: string, id: string): Promise<UploadSession | null>;
 recordChunkReceived(orgId: string, uploadSessionId: string, chunkIndex: number): Promise<void>;
 completeUploadSession(orgId: string, id: string): Promise<void>;
 updateUploadSessionStatus(orgId: string, id: string, status: UploadSessionStatus): Promise<void>;
}

/**
 * IdempotencyStore — first-class dependency. Same contract whether
 * in-memory (Phase 1 MVP) or Redis-backed (Phase 1.b).
 */
export interface IdempotencyStore {
 get<T>(key: string): Promise<T | null>;
 set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}
