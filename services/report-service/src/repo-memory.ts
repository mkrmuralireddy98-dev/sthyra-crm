/**
 * InMemoryReportRepository — Phase 9 MVP implementation.
 */

import type { ReportRepository } from './repository.js';
import type { Schedule } from './types.js';

interface IdempotencyEntry { readonly value: unknown; readonly expiresAt: number; }

export class InMemoryReportRepository implements ReportRepository {
 private readonly schedules = new Map<string, Schedule>();
 private readonly idem = new Map<string, IdempotencyEntry>();
 private readonly idCounter = { schedule: 0 };

 private sKey(orgId: string, id: string): string { return `s:${orgId}:${id}`; }
 private idemKey(orgId: string, key: string): string { return `idem:${orgId}:${key}`; }

 async insertSchedule(s: Schedule): Promise<void> {
 this.schedules.set(this.sKey(s.orgId, s.id), s);
 }

 async findSchedule(orgId: string, id: string): Promise<Schedule | null> {
 return this.schedules.get(this.sKey(orgId, id)) ?? null;
 }

 async listSchedules(orgId: string, projectId: string): Promise<readonly Schedule[]> {
 const out: Schedule[] = [];
 for (const s of this.schedules.values()) {
 if (s.orgId === orgId && s.projectId === projectId) out.push(s);
 }
 return out.sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());
 }

 async cancelSchedule(orgId: string, id: string): Promise<void> {
 const k = this.sKey(orgId, id);
 const cur = this.schedules.get(k);
 if (!cur || cur.orgId !== orgId) return;
 this.schedules.delete(k);
 }

 nextScheduleId(): number { this.idCounter.schedule += 1; return this.idCounter.schedule; }

 async insertIdempotencyKey(orgId: string, key: string, result: { readonly scheduleId?: string }, ttlSeconds?: number): Promise<void> {
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
