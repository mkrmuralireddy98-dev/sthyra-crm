import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { ReportService } from './service.js';
import { StubReportFetcher } from './fetcher.js';
import { InMemoryReportRepository } from './repo-memory.js';
import type {
  CaptureSummary, IssueSummary, MilestoneSummary, ProgressSummary,
} from './types.js';

const NOW = new Date('2026-09-01T12:00:00Z');

let service: ReportService;
let fetcher: StubReportFetcher;
let repo: InMemoryReportRepository;

beforeEach(() => {
 fetcher = new StubReportFetcher();
 repo = new InMemoryReportRepository();
 service = new ReportService({
 repo, fetcher,
 now: () => NOW,
 cacheTtlSeconds: 60,
 });
});

function seedProject(projectId: string, opts: {
 captures?: CaptureSummary[];
 issues?: IssueSummary[];
 milestones?: MilestoneSummary[];
 progress?: ProgressSummary[];
}): void {
 if (opts.captures) fetcher.capturesByProject.set(projectId, opts.captures);
 if (opts.issues) fetcher.issuesByProject.set(projectId, opts.issues);
 if (opts.milestones) fetcher.milestonesByProject.set(projectId, opts.milestones);
 if (opts.progress) fetcher.progressByProject.set(projectId, opts.progress);
}

describe('ReportService.getDaily (FR-1)', () => {
 it('returns daily rollup', async () => {
 seedProject('prj_1', {
 captures: [{ id: 'c1', projectId: 'prj_1', status: 'ready', createdAt: NOW }],
 issues: [{ id: 'i1', projectId: 'prj_1', status: 'open', kind: 'standard', trade: null, severity: 'medium', createdAt: NOW, resolvedAt: null }],
 });
 const report = await service.getDaily('org_a', 'prj_1', NOW);
 assert.equal(report.projectId, 'prj_1');
 assert.equal(report.captures.total, 1);
 });

 it('caches result on second call', async () => {
 let calls = 0;
 fetcher.fetchCaptures = async () => { calls++; return []; };
 await service.getDaily('org_a', 'prj_1', NOW);
 await service.getDaily('org_a', 'prj_1', NOW);
 assert.equal(calls, 1);
 });
});

describe('ReportService.getDeepDive (FR-3)', () => {
 it('returns deep dive', async () => {
 seedProject('prj_1', {
 milestones: [{ id: 'm1', projectId: 'prj_1', name: 'm1', status: 'completed', plannedDate: NOW, actualDate: NOW }],
 captures: [],
 issues: [],
 });
 const dive = await service.getDeepDive('org_a', 'prj_1');
 assert.equal(dive.projectId, 'prj_1');
 assert.equal(dive.milestones.completed, 1);
 });
});

describe('ReportService.runCustom (FR-5)', () => {
 it('filters and groups issues', async () => {
 seedProject('*', {
 issues: [
 { id: 'i1', projectId: 'prj_1', status: 'open', kind: 'punch', trade: 'plumbing', severity: 'medium', createdAt: NOW, resolvedAt: null },
 { id: 'i2', projectId: 'prj_1', status: 'closed', kind: 'punch', trade: 'electrical', severity: 'medium', createdAt: NOW, resolvedAt: NOW },
 ],
 });
 const result = await service.runCustom('org_a', {
 entity: 'issues',
 filter: { kind: 'punch' },
 groupBy: 'trade',
 });
 assert.equal(result.totalRows, 2);
 assert.equal(result.groups?.['plumbing'], 1);
 assert.equal(result.groups?.['electrical'], 1);
 });
});

describe('ReportService.scheduleReport (FR-6)', () => {
 it('creates a daily schedule', async () => {
 const s = await service.scheduleReport({
 orgId: 'org_a',
 projectId: 'prj_1',
 kind: 'daily',
 hour: 8,
 recipients: ['pm@example.com'],
 });
 assert.ok(s.id.startsWith('sch_'));
 assert.equal(s.kind, 'daily');
 });

 it('creates a weekly schedule with dayOfWeek', async () => {
 const s = await service.scheduleReport({
 orgId: 'org_a',
 projectId: 'prj_1',
 kind: 'weekly',
 hour: 9,
 dayOfWeek: 1,
 recipients: ['exec@example.com'],
 });
 assert.equal(s.dayOfWeek, 1);
 });

 it('rejects invalid email', async () => {
 await assert.rejects(
 () => service.scheduleReport({
 orgId: 'org_a', projectId: 'prj_1',
 kind: 'daily', hour: 8, recipients: ['not-an-email'],
 }),
 /invalid email/,
 );
 });

 it('rejects invalid hour', async () => {
 await assert.rejects(
 () => service.scheduleReport({
 orgId: 'org_a', projectId: 'prj_1',
 kind: 'daily', hour: 99, recipients: ['a@b.com'],
 }),
 /hour must be/,
 );
 });

 it('weekly schedule requires dayOfWeek', async () => {
 await assert.rejects(
 () => service.scheduleReport({
 orgId: 'org_a', projectId: 'prj_1',
 kind: 'weekly', hour: 9, recipients: ['a@b.com'],
 }),
 /dayOfWeek required/,
 );
 });

 it('idempotent on same idempotencyKey (same id returned)', async () => {
 const input = {
 orgId: 'org_a', projectId: 'prj_1',
 kind: 'daily' as const, hour: 8,
 recipients: ['a@b.com'],
 };
 const a = await service.scheduleReport(input, 'idem-1');
 const b = await service.scheduleReport(input, 'idem-1');
 assert.equal(a.id, b.id);
 });
});

describe('ReportService.listSchedules (FR-7)', () => {
 it('lists schedules for a project', async () => {
 await service.scheduleReport({ orgId: 'org_a', projectId: 'prj_1', kind: 'daily', hour: 8, recipients: ['a@b.com'] });
 await service.scheduleReport({ orgId: 'org_a', projectId: 'prj_1', kind: 'daily', hour: 17, recipients: ['b@b.com'] });
 const list = await service.listSchedules('org_a', 'prj_1');
 assert.equal(list.length, 2);
 });

 it('isolates by tenant', async () => {
 await service.scheduleReport({ orgId: 'org_a', projectId: 'prj_1', kind: 'daily', hour: 8, recipients: ['a@b.com'] });
 const list = await service.listSchedules('org_b', 'prj_1');
 assert.equal(list.length, 0);
 });
});

describe('ReportService.cancelSchedule (FR-8)', () => {
 it('cancels a schedule', async () => {
 const s = await service.scheduleReport({ orgId: 'org_a', projectId: 'prj_1', kind: 'daily', hour: 8, recipients: ['a@b.com'] });
 await service.cancelSchedule('org_a', 'prj_1', s.id);
 const list = await service.listSchedules('org_a', 'prj_1');
 assert.equal(list.length, 0);
 });

 it('throws on cross-tenant cancel', async () => {
 const s = await service.scheduleReport({ orgId: 'org_a', projectId: 'prj_1', kind: 'daily', hour: 8, recipients: ['a@b.com'] });
 await assert.rejects(
 () => service.cancelSchedule('org_b', 'prj_1', s.id),
 /not found/,
 );
 });
});
