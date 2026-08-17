/**
 * InMemoryIntegrationRepository — Phase 11 MVP implementation.
 */

import type { IntegrationRepository } from './repository.js';
import type { Integration, Sync } from './types.js';

interface IdempotencyEntry { readonly value: unknown; readonly expiresAt: number; }

const MAX_SYNCS_PER_INTEGRATION = 100;

export class InMemoryIntegrationRepository implements IntegrationRepository {
  private readonly integrations = new Map<string, Integration>();
  private readonly syncs = new Map<string, Sync>();
  private readonly idem = new Map<string, IdempotencyEntry>();
  private readonly idCounter = { integration: 0, sync: 0 };

  private iKey(orgId: string, id: string): string { return `i:${orgId}:${id}`; }
  private sKey(orgId: string, integrationId: string, id: string): string { return `s:${orgId}:${integrationId}:${id}`; }
  private idemKey(orgId: string, key: string): string { return `idem:${orgId}:${key}`; }

  async insertIntegration(i: Integration): Promise<void> {
    this.integrations.set(this.iKey(i.orgId, i.id), i);
  }

  async findIntegration(orgId: string, id: string): Promise<Integration | null> {
    return this.integrations.get(this.iKey(orgId, id)) ?? null;
  }

  async listIntegrations(orgId: string): Promise<readonly Integration[]> {
    const out: Integration[] = [];
    for (const i of this.integrations.values()) {
      if (i.orgId === orgId && i.deletedAt === null) out.push(i);
    }
    return out.sort((a, b) => a.connectedAt.getTime() - b.connectedAt.getTime());
  }

  async updateIntegration(orgId: string, id: string, patch: Partial<Integration>): Promise<Integration> {
    const key = this.iKey(orgId, id);
    const cur = this.integrations.get(key);
    if (!cur) throw new Error('integration not found: ' + id);
    if (cur.orgId !== orgId) throw new Error('integration not found: ' + id);
    const next: Integration = { ...cur, ...patch };
    this.integrations.set(key, next);
    return next;
  }

  async softDeleteIntegration(orgId: string, id: string): Promise<void> {
    const key = this.iKey(orgId, id);
    const cur = this.integrations.get(key);
    if (!cur || cur.orgId !== orgId) return;
    this.integrations.set(key, { ...cur, deletedAt: new Date(), status: 'disconnected' });
  }

  nextIntegrationId(): number { this.idCounter.integration += 1; return this.idCounter.integration; }

  async insertSync(sync: Sync): Promise<void> {
    this.syncs.set(this.sKey(sync.orgId, sync.integrationId, sync.id), sync);
    const all = await this.listSyncs(sync.orgId, sync.integrationId, Infinity);
    if (all.length > MAX_SYNCS_PER_INTEGRATION) {
      const sorted = [...all].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      const toEvict = sorted.slice(0, all.length - MAX_SYNCS_PER_INTEGRATION);
      for (const s of toEvict) this.syncs.delete(this.sKey(sync.orgId, sync.integrationId, s.id));
    }
  }

  async listSyncs(orgId: string, integrationId: string, limit: number = 20): Promise<readonly Sync[]> {
    const out: Sync[] = [];
    for (const s of this.syncs.values()) {
      if (s.orgId === orgId && s.integrationId === integrationId) out.push(s);
    }
    out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return out.slice(0, limit);
  }

  nextSyncId(): number { this.idCounter.sync += 1; return this.idCounter.sync; }

  async insertIdempotencyKey(orgId: string, key: string, result: { readonly integrationId?: string }, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? 24 * 3600;
    this.idem.set(this.idemKey(orgId, key), { value: result, expiresAt: Date.now() + ttl * 1000 });
  }

  async getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null> {
    const entry = this.idem.get(this.idemKey(orgId, key));
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.idem.delete(this.idemKey(orgId, key));
      return null;
    }
    return entry.value as T;
  }
}
