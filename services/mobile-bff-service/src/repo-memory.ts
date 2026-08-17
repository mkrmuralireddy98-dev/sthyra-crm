/**
 * InMemoryMobileRepository — Phase 5 MVP implementation.
 */

import type { MobileRepository } from './repository.js';
import type { MobileSession, MobileChunk, MobileDeviceToken } from './types.js';

export class InMemoryMobileRepository implements MobileRepository {
  private readonly sessions = new Map<string, MobileSession>();
  private readonly chunks = new Map<string, MobileChunk[]>(); // keyed by sessionId
  private readonly devices = new Map<string, MobileDeviceToken>(); // keyed by orgId+deviceId
  private idCounter = { chunk: 0 };

  private sessionKey(orgId: string, id: string): string {
    return `sess:${orgId}:${id}`;
  }

  private deviceKey(orgId: string, deviceId: string): string {
    return `dev:${orgId}:${deviceId}`;
  }

  async insertSession(session: MobileSession): Promise<void> {
    this.sessions.set(this.sessionKey(session.orgId, session.id), session);
  }

  async findSession(orgId: string, id: string): Promise<MobileSession | null> {
    return this.sessions.get(this.sessionKey(orgId, id)) ?? null;
  }

  async findSessionByClientId(orgId: string, clientSessionId: string): Promise<MobileSession | null> {
    for (const s of this.sessions.values()) {
      if (s.orgId === orgId && s.clientSessionId === clientSessionId) {
        return s;
      }
    }
    return null;
  }

  async updateSession(orgId: string, id: string, patch: Partial<MobileSession>): Promise<void> {
    const cur = this.sessions.get(this.sessionKey(orgId, id));
    if (!cur) return;
    this.sessions.set(this.sessionKey(orgId, id), { ...cur, ...patch });
  }

  async softDeleteSession(orgId: string, id: string): Promise<void> {
    const cur = this.sessions.get(this.sessionKey(orgId, id));
    if (!cur) return;
    this.sessions.set(this.sessionKey(orgId, id), { ...cur, deletedAt: new Date() });
  }

  async insertChunk(chunk: MobileChunk): Promise<void> {
    const list = this.chunks.get(chunk.sessionId) ?? [];
    list.push(chunk);
    this.chunks.set(chunk.sessionId, list);
  }

  async findChunk(_orgId: string, sessionId: string, chunkIndex: number): Promise<MobileChunk | null> {
    const list = this.chunks.get(sessionId) ?? [];
    return list.find((c) => c.chunkIndex === chunkIndex) ?? null;
  }

  async listChunks(_orgId: string, sessionId: string): Promise<readonly MobileChunk[]> {
    return [...(this.chunks.get(sessionId) ?? [])];
  }

  async countChunks(_orgId: string, sessionId: string): Promise<number> {
    return (this.chunks.get(sessionId) ?? []).length;
  }

  async sumChunkSizes(_orgId: string, sessionId: string): Promise<number> {
    const list = this.chunks.get(sessionId) ?? [];
    return list.reduce((sum, c) => sum + c.sizeBytes, 0);
  }

  async insertDeviceToken(token: MobileDeviceToken): Promise<void> {
    this.devices.set(this.deviceKey(token.orgId, token.deviceId), token);
  }

  async findDeviceToken(orgId: string, deviceId: string): Promise<MobileDeviceToken | null> {
    return this.devices.get(this.deviceKey(orgId, deviceId)) ?? null;
  }

  async deleteDeviceToken(orgId: string, deviceId: string): Promise<void> {
    this.devices.delete(this.deviceKey(orgId, deviceId));
  }

  nextId(): number {
    this.idCounter.chunk += 1;
    return this.idCounter.chunk;
  }
}