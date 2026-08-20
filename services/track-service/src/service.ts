/**
 * TrackService — domain layer.
 */

import { randomUUID } from 'node:crypto';
import { detectCycleOnAdd } from './graph.js';
import type {
  Milestone, ProgressEntry, MilestoneStatus,
  CreateMilestoneInput, UpdateMilestoneInput, LogProgressInput,
} from './types.js';
import type { TrackRepository } from './repository.js';

export interface TrackEvent {
  readonly type: 'milestone.created' | 'milestone.updated' | 'milestone.completed' | 'progress.logged' | 'project.status_changed';
  readonly orgId: string;
  readonly projectId: string;
  readonly milestoneId?: string;
  readonly entryId?: string;
  readonly status?: MilestoneStatus;
  readonly occurredAt: Date;
}

export interface TrackServiceDeps {
  readonly repo: TrackRepository;
  readonly onEvent?: (e: TrackEvent) => void;
  readonly now?: () => Date;
}

export interface IdempotencyStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly map = new Map<string, { value: unknown; expiresAt: number }>();
  async get<T>(key: string): Promise<T | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e.value as T;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? 24 * 3600;
    this.map.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }
}

const VALID_TRANSITIONS: Readonly<Record<MilestoneStatus, readonly MilestoneStatus[]>> = {
  pending: ['in_progress', 'skipped'],
  in_progress: ['completed', 'skipped'],
  completed: [],
  skipped: [],
};

function isValidTransition(from: MilestoneStatus, to: MilestoneStatus): boolean {
  if (from === to) return false;
  return VALID_TRANSITIONS[from].includes(to);
}

export class TrackService {
  private readonly repo: TrackRepository;
  private readonly onEvent: (e: TrackEvent) => void;
  private readonly now: () => Date;
  private readonly idem = new InMemoryIdempotencyStore();

  constructor(deps: TrackServiceDeps) {
    this.repo = deps.repo;
    this.onEvent = deps.onEvent ?? (() => {});
    this.now = deps.now ?? (() => new Date());
  }

  // ─── createMilestone (FR-1) ──────────────────────────
  async createMilestone(input: CreateMilestoneInput, idempotencyKey?: string): Promise<Milestone> {
    if (!input.orgId) throw new Error('orgId required');
    if (!input.projectId) throw new Error('projectId required');
    if (!input.name) throw new Error('name required');
    if (!input.plannedDate) throw new Error('plannedDate required');

    if (idempotencyKey) {
      const existing = await this.repo.findMilestoneByName(input.orgId, input.projectId, input.name);
      if (existing) return existing;
    }

    // Cycle detection on dependsOn
    const dependsOn = input.dependsOn ?? [];
    const candidateId = `ms_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
    const existing = await this.repo.listMilestones(input.orgId, input.projectId);
    if (detectCycleOnAdd(existing, candidateId, dependsOn)) {
      throw new Error('cycle detected in dependencies');
    }

    const milestone: Milestone = {
      id: candidateId,
      orgId: input.orgId,
      projectId: input.projectId,
      name: input.name,
      description: input.description ?? null,
      plannedDate: input.plannedDate,
      actualDate: null,
      status: 'pending',
      progressPct: 0,
      dependsOn,
      createdAt: this.now(),
      updatedAt: this.now(),
      deletedAt: null,
    };
    await this.repo.insertMilestone(milestone);
    this.onEvent({
      type: 'milestone.created',
      orgId: input.orgId,
      projectId: input.projectId,
      milestoneId: milestone.id,
      status: 'pending',
      occurredAt: this.now(),
    });
    if (idempotencyKey) {
      await this.repo.insertIdempotencyKey(input.orgId, idempotencyKey, { milestoneId: milestone.id });
    }
    return milestone;
  }

  // ─── updateMilestone (FR-2) ──────────────────────────
  async updateMilestone(orgId: string, id: string, input: UpdateMilestoneInput): Promise<Milestone> {
    if (!input.actorId) throw new Error('actorId required');
    const cur = await this.repo.findMilestone(orgId, id);
    if (!cur) throw new Error('milestone not found: ' + id);
    if (cur.orgId !== orgId) throw new Error('milestone not found: ' + id);

    type Writable<T> = { -readonly [K in keyof T]: T[K] };
    const patch: Writable<Partial<Milestone>> = {};
    if (input.status !== undefined) {
      if (!isValidTransition(cur.status, input.status)) {
        throw new Error(`invalid transition: ${cur.status} → ${input.status}`);
      }
      patch.status = input.status;
    }
    if (input.actualDate !== undefined) patch.actualDate = input.actualDate;
    if (input.progressPct !== undefined) {
      if (input.progressPct < 0 || input.progressPct > 100) {
        throw new Error('progressPct must be 0-100');
      }
      patch.progressPct = input.progressPct;
    }

    const updated = await this.repo.updateMilestone(orgId, id, patch);
    const eventType = updated.status === 'completed' ? 'milestone.completed' : 'milestone.updated';
    this.onEvent({
      type: eventType,
      orgId,
      projectId: updated.projectId,
      milestoneId: updated.id,
      status: updated.status,
      occurredAt: this.now(),
    });
    return updated;
  }

  // ─── logProgress (FR-3) ──────────────────────────────
  async logProgress(input: LogProgressInput, idempotencyKey?: string): Promise<ProgressEntry> {
    if (!input.orgId) throw new Error('orgId required');
    if (!input.projectId) throw new Error('projectId required');
    if (input.progressPct < 0 || input.progressPct > 100) {
      throw new Error('progressPct must be 0-100');
    }
    if (input.source !== 'manual') {
      throw new Error('source must be "manual" (auto sources reserved for server-side hooks)');
    }

    const entry: ProgressEntry = {
      id: `pg_${randomUUID().replace(/-/g, '').slice(0, 22)}`,
      orgId: input.orgId,
      projectId: input.projectId,
      milestoneId: input.milestoneId ?? null,
      progressPct: input.progressPct,
      note: input.note ?? null,
      source: input.source,
      loggedAt: this.now(),
    };
    await this.repo.insertProgress(entry);
    this.onEvent({
      type: 'progress.logged',
      orgId: input.orgId,
      projectId: input.projectId,
      entryId: entry.id,
      milestoneId: input.milestoneId ?? undefined,
      occurredAt: this.now(),
    });
    if (idempotencyKey) {
      await this.repo.insertIdempotencyKey(input.orgId, idempotencyKey, { entryId: entry.id });
    }
    return entry;
  }

  // ─── listMilestones (FR-7) ───────────────────────────
  async listMilestones(orgId: string, projectId: string, filter?: { readonly status?: MilestoneStatus }): Promise<readonly Milestone[]> {
    return this.repo.listMilestones(orgId, projectId, filter);
  }

  // ─── softDeleteMilestone (NFR-7) ─────────────────────
  async softDeleteMilestone(orgId: string, id: string): Promise<void> {
    await this.repo.softDeleteMilestone(orgId, id);
  }

}
