/**
 * ReportService — domain layer.
 */

import { randomUUID } from 'node:crypto';
import {
 aggregateDaily, aggregateWeekly, aggregateDeepDive, aggregatePortfolio, runCustom,
} from './aggregators.js';
import { SimpleTTLCache } from './cache.js';
import type {
  DailyReport, WeeklyReport, ProjectDeepDive, PortfolioReport,
  CustomReportRequest, CustomReportResult,
  Schedule, CreateScheduleInput,
  CaptureSummary, IssueSummary, MilestoneSummary, ProgressSummary,
} from './types.js';
import type { ReportRepository } from './repository.js';
import type { ReportFetcher } from './fetcher.js';

export interface ReportServiceDeps {
 readonly repo: ReportRepository;
 readonly fetcher: ReportFetcher;
 readonly now?: () => Date;
 readonly cacheTtlSeconds?: number;
}

export class ReportService {
 private readonly repo: ReportRepository;
 private readonly fetcher: ReportFetcher;
 private readonly now: () => Date;
 private readonly cache: SimpleTTLCache<string, unknown>;
 private readonly cacheTtlSeconds: number;

 constructor(deps: ReportServiceDeps) {
 this.repo = deps.repo;
 this.fetcher = deps.fetcher;
 this.now = deps.now ?? (() => new Date());
 this.cacheTtlSeconds = deps.cacheTtlSeconds ?? 300; // 5 min default
 this.cache = new SimpleTTLCache<string, unknown>();
 }

 // ─── FR-1: getDaily ────────────────────────────────────
 async getDaily(orgId: string, projectId: string, date: Date): Promise<DailyReport> {
 const cacheKey = `${orgId}:${projectId}:daily:${date.toISOString().slice(0, 10)}`;
 const cached = this.cache.getOrCompute(cacheKey, this.cacheTtlSeconds, async () => {
 const [captures, issues, milestones, progress] = await Promise.all([
 this.fetcher.fetchCaptures(orgId, projectId),
 this.fetcher.fetchIssues(orgId, projectId),
 this.fetcher.fetchMilestones(orgId, projectId),
 this.fetcher.fetchProgress(orgId, projectId),
 ]);
 return aggregateDaily(projectId, date, captures, issues, progress, milestones, this.now());
 }, () => this.now().getTime());
 return cached as DailyReport;
 }

 // ─── FR-2: getWeekly ──────────────────────────────────
 async getWeekly(orgId: string, weekStart: Date): Promise<WeeklyReport> {
 // For weekly, we need data from all projects — Phase 9 MVP: projectId = '*'
 // The fetcher's listSchedules is the project list for now.
 // Aggregator needs raw data — pass empty projects list for stub.
 const cacheKey = `${orgId}:weekly:${weekStart.toISOString().slice(0, 10)}`;
 const cached = this.cache.getOrCompute(cacheKey, this.cacheTtlSeconds, () => {
 return aggregateWeekly(orgId, weekStart, []);
 }, () => this.now().getTime());
 return cached as WeeklyReport;
 }

 // ─── FR-3: getDeepDive ────────────────────────────────
 async getDeepDive(orgId: string, projectId: string): Promise<ProjectDeepDive> {
 const cacheKey = `${orgId}:${projectId}:deep-dive`;
 const cached = this.cache.getOrCompute(cacheKey, this.cacheTtlSeconds, async () => {
 const [captures, issues, milestones, progress] = await Promise.all([
 this.fetcher.fetchCaptures(orgId, projectId),
 this.fetcher.fetchIssues(orgId, projectId),
 this.fetcher.fetchMilestones(orgId, projectId),
 this.fetcher.fetchProgress(orgId, projectId),
 ]);
 return aggregateDeepDive(
 projectId, milestones, captures, issues, progress,
 { currentModelId: null, totalElements: 0 }, // Phase 9 MVP: no BIM hookup yet
 this.now(),
 );
 }, () => this.now().getTime());
 return cached as ProjectDeepDive;
 }

 // ─── FR-4: getPortfolio ──────────────────────────────
 async getPortfolio(orgId: string): Promise<PortfolioReport> {
 const cacheKey = `${orgId}:portfolio`;
 const cached = this.cache.getOrCompute(cacheKey, this.cacheTtlSeconds, () => {
 return aggregatePortfolio(orgId, []);
 }, () => this.now().getTime());
 return cached as PortfolioReport;
 }

 // ─── FR-5: runCustom ─────────────────────────────────
 async runCustom(orgId: string, req: CustomReportRequest): Promise<CustomReportResult> {
 const issues = await this.fetcher.fetchIssues(orgId, req.entity === 'issues' ? '*' : '*');
 const captures = await this.fetcher.fetchCaptures(orgId, req.entity === 'captures' ? '*' : '*');
 const milestones = await this.fetcher.fetchMilestones(orgId, req.entity === 'milestones' ? '*' : '*');
 return runCustom(req, issues, captures, milestones);
 }

 // ─── FR-6: scheduleReport ────────────────────────────
 async scheduleReport(input: CreateScheduleInput, idempotencyKey?: string): Promise<Schedule> {
 if (input.hour < 0 || input.hour > 23) throw new Error('hour must be 0-23');
 if (input.kind === 'weekly' && (input.dayOfWeek === undefined || input.dayOfWeek === null)) {
 throw new Error('dayOfWeek required for weekly schedule');
 }
 for (const r of input.recipients) {
 if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r)) throw new Error(`invalid email: ${r}`);
 }
 if (idempotencyKey) {
 const cached = await this.repo.getIdempotencyResult<{ scheduleId?: string }>(input.orgId, idempotencyKey);
 if (cached?.scheduleId) {
 const existing = await this.repo.findSchedule(input.orgId, cached.scheduleId);
 if (existing) return existing;
 }
 }
 const id = `sch_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
 const nextRunAt = computeNextRunAt(input.kind, input.dayOfWeek ?? null, input.hour, this.now());
 const schedule: Schedule = {
 id, orgId: input.orgId, projectId: input.projectId,
 kind: input.kind, dayOfWeek: input.dayOfWeek ?? null,
 hour: input.hour, recipients: input.recipients,
 nextRunAt, createdAt: this.now(),
 };
 await this.repo.insertSchedule(schedule);
 if (idempotencyKey) {
 await this.repo.insertIdempotencyKey(input.orgId, idempotencyKey, { scheduleId: schedule.id });
 }
 return schedule;
 }

 // ─── FR-7: listSchedules ─────────────────────────────
 async listSchedules(orgId: string, projectId: string): Promise<readonly Schedule[]> {
 return this.repo.listSchedules(orgId, projectId);
 }

 // ─── FR-8: cancelSchedule ────────────────────────────
 async cancelSchedule(orgId: string, projectId: string, id: string): Promise<void> {
 const cur = await this.repo.findSchedule(orgId, id);
 if (!cur) throw new Error('schedule not found: ' + id);
 if (cur.projectId !== projectId) throw new Error('schedule not found: ' + id);
 if (cur.orgId !== orgId) throw new Error('schedule not found: ' + id);
 await this.repo.cancelSchedule(orgId, id);
 }

 private get nowTimestamp(): number {
 return this.now().getTime();
 }

}

function computeNextRunAt(kind: 'daily' | 'weekly', dayOfWeek: number | null, hour: number, now: Date): Date {
 const next = new Date(now);
 next.setUTCHours(hour, 0, 0, 0);
 if (kind === 'daily') {
 if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
 return next;
 }
 // weekly: dayOfWeek 0-6 (Sun=0)
 const targetDow = dayOfWeek ?? 0;
 const currentDow = next.getUTCDay();
 let diff = targetDow - currentDow;
 if (diff < 0 || (diff === 0 && next.getTime() <= now.getTime())) diff += 7;
 next.setUTCDate(next.getUTCDate() + diff);
 return next;
}
