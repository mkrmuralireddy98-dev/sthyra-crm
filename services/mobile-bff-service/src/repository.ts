/**
 * MobileRepository — tenant-scoped storage contract.
 */

import type {
 MobileSession, MobileChunk, MobileDeviceToken,
 CreateSessionInput, ChunkUploadInput,
} from './types.js';

export interface MobileRepository {
 insertSession(session: MobileSession): Promise<void>;
 findSession(orgId: string, id: string): Promise<MobileSession | null>;
 updateSession(orgId: string, id: string, patch: Partial<MobileSession>): Promise<void>;
 softDeleteSession(orgId: string, id: string): Promise<void>;
 insertChunk(chunk: MobileChunk): Promise<void>;
 findChunk(orgId: string, sessionId: string, chunkIndex: number): Promise<MobileChunk | null>;
 listChunks(orgId: string, sessionId: string): Promise<readonly MobileChunk[]>;
 countChunks(orgId: string, sessionId: string): Promise<number>;
 sumChunkSizes(orgId: string, sessionId: string): Promise<number>;
 insertDeviceToken(token: MobileDeviceToken): Promise<void>;
 findDeviceToken(orgId: string, deviceId: string): Promise<MobileDeviceToken | null>;
 deleteDeviceToken(orgId: string, deviceId: string): Promise<void>;
 nextId(): number;
}

// Re-export for compatibility with service.ts
export type { CreateSessionInput, ChunkUploadInput };
