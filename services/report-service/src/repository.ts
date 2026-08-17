/**
 * ReportRepository — tenant-scoped storage contract.
 *
 * Reports are read-only aggregations over the execution services;
 * the only writable surface is the Schedule table (Phase 9.b cron).
 */

import type { Schedule, CreateScheduleInput } from './types.js';

export interface TrackService {
  // Reserved for future cross-service hooks
}

export interface ReportRepository {
 insertSchedule(schedule: Schedule): Promise<void>;
 findSchedule(orgId: string, id: string): Promise<Schedule | null>;
 listSchedules(orgId: string, projectId: string): Promise<readonly Schedule[]>;
 cancelSchedule(orgId: string, id: string): Promise<void>;
 nextScheduleId(): number;
 insertIdempotencyKey(orgId: string, key: string, result: { readonly scheduleId?: string }, ttlSeconds?: number): Promise<void>;
 getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null>;
}
