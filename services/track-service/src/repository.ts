/**
 * TrackRepository — tenant-scoped storage contract.
 */

import type { Milestone, ProgressEntry, MilestoneStatus, ProgressSource } from './types.js';

export interface PaginationOptions { readonly cursor?: string; readonly limit?: number; }
export interface PaginatedResult<T> { readonly items: readonly T[]; readonly nextCursor: string | null; }

export interface TrackRepository {
  insertMilestone(milestone: Milestone): Promise<void>;
  findMilestone(orgId: string, id: string): Promise<Milestone | null>;
  findMilestoneByName(orgId: string, projectId: string, name: string): Promise<Milestone | null>;
  listMilestones(orgId: string, projectId: string, filter?: { readonly status?: MilestoneStatus }): Promise<readonly Milestone[]>;
  updateMilestone(orgId: string, id: string, patch: Partial<Milestone>): Promise<Milestone>;
  softDeleteMilestone(orgId: string, id: string): Promise<void>;
  nextMilestoneId(): number;

  insertProgress(entry: ProgressEntry): Promise<void>;
  listProgress(orgId: string, projectId: string): Promise<readonly ProgressEntry[]>;
  nextProgressId(): number;

  insertIdempotencyKey(orgId: string, key: string, result: { readonly milestoneId?: string; readonly entryId?: string }, ttlSeconds?: number): Promise<void>;
  getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null>;
}

export const PROGRESS_SOURCE_VALUES: readonly ProgressSource[] = ['manual'];
