/**
 * InMemoryCaptureRepository + InMemoryIdempotencyStore — Phase 1 MVP.
 *
 * These satisfy the contracts in repository.ts. Production will swap
 * CaptureRepository for PostgresCaptureRepository (Phase 1.b). The
 * service.ts code does not change at the storage boundary.
 */

import type { Capture, UploadSession } from './types.js';
import type { CaptureRepository, IdempotencyStore } from './repository.js';

const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export class InMemoryCaptureRepository implements CaptureRepository {
 private readonly captures = new Map<string, Capture>();
 private readonly uploads = new Map<string, UploadSession>();

 private ckey(orgId: string, id: string): string {
 return `capture:${orgId}:${id}`;
 }

 private ukey(orgId: string, id: string): string {
 return `upload:${orgId}:${id}`;
 }

 async insertCapture(capture: Capture): Promise<void> {
 for (const c of this.captures.values()) {
 if (
 c.orgId === capture.orgId &&
 c.projectId === capture.projectId &&
 c.clientCaptureId === capture.clientCaptureId
 ) {
 throw new Error(
 `duplicate (projectId, clientCaptureId): (${capture.projectId}, ${capture.clientCaptureId})`,
 );
 }
 }
 this.captures.set(this.ckey(capture.orgId, capture.id), capture);
 }

 async findCapture(orgId: string, id: string): Promise<Capture | null> {
 return this.captures.get(this.ckey(orgId, id)) ?? null;
 }

 async findCaptureByClientId(
 orgId: string,
 projectId: string,
 clientCaptureId: string,
 ): Promise<Capture | null> {
 for (const c of this.captures.values()) {
 if (c.orgId === orgId && c.projectId === projectId && c.clientCaptureId === clientCaptureId) {
 return c;
 }
 }
 return null;
 }

 async listCaptures(
 orgId: string,
 projectId: string,
 filter?: { status?: Capture['status'] },
 ): Promise<readonly Capture[]> {
 const out: Capture[] = [];
 for (const c of this.captures.values()) {
 if (c.orgId !== orgId || c.projectId !== projectId) continue;
 if (filter?.status && c.status !== filter.status) continue;
 out.push(c);
 }
 return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
 }

 async updateCaptureStatus(
 orgId: string,
 id: string,
 status: Capture['status'],
 extra?: { errorMessage?: string; finalizedAt?: Date; sha256?: string },
 ): Promise<void> {
 const cur = this.captures.get(this.ckey(orgId, id));
 if (!cur) throw new Error(`capture not found: ${id}`);
 const next: Capture = {
 ...cur,
 status,
 errorMessage: extra?.errorMessage ?? cur.errorMessage,
 finalizedAt: extra?.finalizedAt ?? cur.finalizedAt,
 sha256: extra?.sha256 ?? cur.sha256,
 updatedAt: new Date(),
 };
 this.captures.set(this.ckey(orgId, id), next);
 }

 async archiveCapture(orgId: string, id: string): Promise<void> {
 await this.updateCaptureStatus(orgId, id, 'archived');
 }

 async insertUploadSession(session: UploadSession): Promise<void> {
 this.uploads.set(this.ukey(session.orgId, session.id), session);
 }

 async findUploadSession(orgId: string, id: string): Promise<UploadSession | null> {
 return this.uploads.get(this.ukey(orgId, id)) ?? null;
 }

 async recordChunkReceived(orgId: string, uploadSessionId: string, chunkIndex: number): Promise<void> {
 const cur = this.uploads.get(this.ukey(orgId, uploadSessionId));
 if (!cur) throw new Error(`upload session not found: ${uploadSessionId}`);
 if (cur.receivedChunks.includes(chunkIndex)) return;
 const next: UploadSession = {
 ...cur,
 receivedChunks: [...cur.receivedChunks, chunkIndex].sort((a, b) => a - b),
 updatedAt: new Date(),
 };
 this.uploads.set(this.ukey(orgId, uploadSessionId), next);
 }

 async completeUploadSession(orgId: string, id: string): Promise<void> {
 const cur = this.uploads.get(this.ukey(orgId, id));
 if (!cur) throw new Error(`upload session not found: ${id}`);
 this.uploads.set(this.ukey(orgId, id), {
 ...cur,
 status: 'complete',
 updatedAt: new Date(),
 });
 }

 async updateUploadSessionStatus(
 orgId: string,
 id: string,
 status: UploadSession['status'],
 ): Promise<void> {
 const cur = this.uploads.get(this.ukey(orgId, id));
 if (!cur) throw new Error(`upload session not found: ${id}`);
 this.uploads.set(this.ukey(orgId, id), {
 ...cur,
 status,
 updatedAt: new Date(),
 });
 }
}

interface IdempotentEntry {
 value: unknown;
 expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
 private readonly store = new Map<string, IdempotentEntry>();

 async get<T>(key: string): Promise<T | null> {
 const entry = this.store.get(key);
 if (!entry) return null;
 if (entry.expiresAt < Date.now()) {
 this.store.delete(key);
 return null;
 }
 return entry.value as T;
 }

 async set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_IDEMPOTENCY_TTL_SECONDS): Promise<void> {
 this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
 }
}
