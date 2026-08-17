/**
 * InMemoryTrackRepository — Phase 8 MVP implementation.
 */

import type {
  TrackRepository, PaginationOptions, PaginatedResult,
} from './repository.js';
import type {
  Milestone, ProgressEntry, MilestoneStatus,
} from './types.js';

interface IdempotencyEntry { readonly value: unknown; readonly expiresAt: number; }

export class InMemoryTrackRepository implements TrackRepository {
  private readonly milestones = new Map<string, Milestone>();
  private readonly progress = new Map<string, ProgressEntry>();
  private readonly idem = new Map<string, IdempotencyEntry>();
  private readonly idCounter = { milestone: 0, progress: 0 };

  private mKey(orgId: string, id: string): string { return `m:${orgId}:${id}`; }
  private pKey(orgId: string, projectId: string, loggedAt: number, id: string): string { return `p:${orgId}:${projectId}:${loggedAt}:${id}`; }
  private idemKey(orgId: string, key: string): string { return `idem:${orgId}:${key}`; }

  async insertMilestone(m: Milestone): Promise<void> {
    this.milestones.set(this.mKey(m.orgId, m.id), m);
  }

  async findMilestone(orgId: string, id: string): Promise<Milestone | null> {
    return this.milestones.get(this.mKey(orgId, id)) ?? null;
  }

  async findMilestoneByName(orgId: string, projectId: string, name: string): Promise<Milestone | null> {
    for (const m of this.milestones.values()) {
      if (m.orgId === orgId && m.projectId === projectId && m.name === name && m.deletedAt === null) {
        return m;
      }
    }
    return null;
  }

  async listMilestones(orgId: string, projectId: string, filter?: { readonly status?: MilestoneStatus }): Promise<readonly Milestone[]> {
    const out: Milestone[] = [];
    for (const m of this.milestones.values()) {
      if (m.orgId !== orgId || m.projectId !== projectId) continue;
      if (m.deletedAt !== null) continue;
      if (filter?.status && m.status !== filter.status) continue;
      out.push(m);
    }
    return out.sort((a, b) => a.plannedDate.getTime() - b.plannedDate.getTime());
  }

  async updateMilestone(orgId: string, id: string, patch: Partial<Milestone>): Promise<Milestone> {
    const key = this.mKey(orgId, id);
    const cur = this.milestones.get(key);
    if (!cur) throw new Error('milestone not found: ' + id);
    if (cur.orgId !== orgId) throw new Error('cross-tenant probe');
    const next: Milestone = { ...cur, ...patch, updatedAt: new Date() };
    this.milestones.set(key, next);
    return next;
  }

  async softDeleteMilestone(orgId: string, id: string): Promise<void> {
    const key = this.mKey(orgId, id);
    const cur = this.milestones.get(key);
    if (!cur || cur.orgId !== orgId) return;
    this.milestones.set(key, { ...cur, deletedAt: new Date() });
  }

  nextMilestoneId(): number { this.idCounter.milestone += 1; return this.idCounter.milestone; }

  async insertProgress(p: ProgressEntry): Promise<void> {
    this.progress.set(this.pKey(p.orgId, p.projectId, p.loggedAt.getTime(), p.id), p);
  }

  async listProgress(orgId: string, projectId: string): Promise<readonly ProgressEntry[]> {
    const out: ProgressEntry[] = [];
    for (const p of this.progress.values()) {
      if (p.orgId === orgId && p.projectId === projectId) out.push(p);
    }
    return out.sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
  }

  nextProgressId(): number { this.idCounter.progress += 1; return this.idCounter.progress; }

  async insertIdempotencyKey(orgId: string, key: string, result: { readonly milestoneId?: string; readonly entryId?: string }, ttlSeconds?: number): Promise<void> {
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
