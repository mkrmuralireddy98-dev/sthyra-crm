/**
 * Aggregators — pure functions that turn raw summaries into report shapes.
 * Used by ReportService (slice 3) and tested in isolation.
 */

import type {
  CaptureSummary, IssueSummary, MilestoneSummary, ProgressSummary,
  DailyReport, WeeklyReport, ProjectDeepDive, PortfolioReport,
  CustomReportRequest, CustomReportResult, CustomEntity,
} from './types.js';

function dateOnly(d: Date): string {
 return d.toISOString().slice(0, 10);
}

export function aggregateDaily(
 projectId: string,
 date: Date,
 captures: readonly CaptureSummary[],
 issues: readonly IssueSummary[],
 progress: readonly ProgressSummary[],
 milestones: readonly MilestoneSummary[],
 now: Date,
): DailyReport {
 const dayStr = dateOnly(date);
 const dayMs = date.getTime();
 const dayStart = new Date(dayMs);
 dayStart.setUTCHours(0, 0, 0, 0);
 const dayEnd = new Date(dayStart.getTime() + 86_400_000);

 const dayCaptures = captures.filter((c) => c.createdAt.getTime() >= dayStart.getTime() && c.createdAt.getTime() < dayEnd.getTime());
 const dayIssues = issues.filter((i) => i.createdAt.getTime() >= dayStart.getTime() && i.createdAt.getTime() < dayEnd.getTime());
 const dayResolved = issues.filter((i) => i.resolvedAt !== null && i.resolvedAt.getTime() >= dayStart.getTime() && i.resolvedAt.getTime() < dayEnd.getTime());

 const punchIssues = issues.filter((i) => i.kind === 'punch');
 const punchClosed = punchIssues.filter((i) => i.status === 'closed').length;
 const punchCompletionPct = punchIssues.length === 0 ? 100 : Math.round((punchClosed / punchIssues.length) * 100);

 const projectProgressPct = progress.length === 0 ? 0 : Math.max(...progress.map((p) => p.progressPct));
 const milestonesCompleted = milestones.filter((m) => m.status === 'completed' && m.actualDate !== null && dateOnly(m.actualDate) === dayStr).length;
 const overdueMilestones = milestones.filter((m) => m.status !== 'completed' && m.status !== 'skipped' && m.plannedDate.getTime() < now.getTime()).length;

 return {
 date: dayStr,
 projectId,
 captures: { total: dayCaptures.length, processed: dayCaptures.filter((c) => c.status === 'ready').length, failed: dayCaptures.filter((c) => c.status === 'failed').length },
 issues: { opened: dayIssues.length, resolved: dayResolved.length, open: issues.filter((i) => i.status === 'open' || i.status === 'in_progress').length },
 progress: { punchCompletionPct, projectProgressPct },
 milestones: { completed: milestonesCompleted, overdue: overdueMilestones },
 };
}

export function aggregateWeekly(
 orgId: string,
 weekStart: Date,
 projects: ReadonlyArray<{ projectId: string; status: string; totalCaptures: number; issuesResolved: number; topBlocker: string | null; topWin: string | null; progressPct: number }>,
): WeeklyReport {
 const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
 const counts = { total: projects.length, active: 0, at_risk: 0, delayed: 0, completed: 0 };
 const blockers: string[] = [];
 const wins: string[] = [];
 let totalCaptures = 0;
 let totalIssuesResolved = 0;
 const progressPcts: number[] = [];
 for (const p of projects) {
 if (p.status === 'active') counts.active++;
 if (p.status === 'at_risk') counts.at_risk++;
 if (p.status === 'delayed') counts.delayed++;
 if (p.status === 'completed') counts.completed++;
 if (p.topBlocker) blockers.push(p.topBlocker);
 if (p.topWin) wins.push(p.topWin);
 totalCaptures += p.totalCaptures;
 totalIssuesResolved += p.issuesResolved;
 progressPcts.push(p.progressPct);
 }
 const totalProgressPct = progressPcts.length === 0 ? 0 : Math.round(mean(progressPcts) * 10) / 10;
 return {
 weekStart: dateOnly(weekStart),
 weekEnd: dateOnly(weekEnd),
 orgId,
 projects: counts,
 topBlockers: blockers.slice(0, 3),
 topWins: wins.slice(0, 3),
 totalCaptures,
 totalIssuesResolved,
 totalProgressPct,
 };
}

function mean(arr: readonly number[]): number {
 if (arr.length === 0) return 0;
 return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function aggregateDeepDive(
 projectId: string,
 milestones: readonly MilestoneSummary[],
 captures: readonly CaptureSummary[],
 issues: readonly IssueSummary[],
 progress: readonly ProgressSummary[],
 bim: { currentModelId: string | null; totalElements: number },
 now: Date,
): ProjectDeepDive {
 const completedMilestones = milestones.filter((m) => m.status === 'completed' || m.status === 'skipped').length;
 const pendingMilestones = milestones.filter((m) => m.status === 'pending').length;
 const blocked = milestones.filter(
 (m) => m.status === 'pending' && m.plannedDate.getTime() < now.getTime(),
 ).length;

 const readyCaptures = captures.filter((c) => c.status === 'ready').length;
 const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'in_progress').length;
 const resolvedIssues = issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;

 const punchIssues = issues.filter((i) => i.kind === 'punch');
 const punchClosed = punchIssues.filter((i) => i.status === 'closed').length;
 const punchCompletionPct = punchIssues.length === 0 ? 100 : Math.round((punchClosed / punchIssues.length) * 100);
 const tradeCounts: Record<string, number> = {};
 for (const i of punchIssues) {
 const t = i.trade ?? 'other';
 tradeCounts[t] = (tradeCounts[t] ?? 0) + 1;
 }

 const projectProgressPct = progress.length === 0 ? 0 : Math.max(...progress.map((p) => p.progressPct));
 const varianceDays = mean(
 milestones
 .filter((m) => m.actualDate !== null)
 .map((m) => (m.actualDate!.getTime() - m.plannedDate.getTime()) / 86_400_000),
 );

 // Status derivation (replicated from track-service)
 let status: ProjectDeepDive['status'] = 'planning';
 if (milestones.length === 0) status = 'planning';
 else if (completedMilestones === milestones.length) status = 'completed';
 else if (milestones.some((m) => m.status === 'in_progress') && projectProgressPct >= 0) status = 'active';

 return {
 projectId,
 status,
 milestones: { total: milestones.length, completed: completedMilestones, pending: pendingMilestones, blocked },
 captures: { total: captures.length, ready: readyCaptures },
 issues: { total: issues.length, open: openIssues, resolved: resolvedIssues },
 bim,
 punch: { completionPct: punchCompletionPct, trade: tradeCounts },
 progress: { progressPct: projectProgressPct, scheduleVarianceDays: Math.round(varianceDays * 10) / 10 },
 };
}

export function aggregatePortfolio(
 orgId: string,
 projects: ReadonlyArray<{ projectId: string; status: string; progressPct: number }>,
): PortfolioReport {
 const byStatus: Record<string, number> = {};
 const byCompletion: Record<string, number> = {
 '0-25%': 0,
 '25-50%': 0,
 '50-75%': 0,
 '75-100%': 0,
 };
 for (const p of projects) {
 byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
 const bucket =
 p.progressPct < 25 ? '0-25%'
 : p.progressPct < 50 ? '25-50%'
 : p.progressPct < 75 ? '50-75%'
 : '75-100%';
 byCompletion[bucket]++;
 }
 return { orgId, totalProjects: projects.length, byStatus, byCompletion };
}

export function runCustom(
 req: CustomReportRequest,
 issues: readonly IssueSummary[],
 captures: readonly CaptureSummary[],
 milestones: readonly MilestoneSummary[],
): CustomReportResult {
 const data: readonly Record<string, unknown>[] = req.entity === 'issues' ? issues as unknown as readonly Record<string, unknown>[]
 : req.entity === 'captures' ? captures as unknown as readonly Record<string, unknown>[]
 : milestones as unknown as readonly Record<string, unknown>[];

 const filtered = data.filter((row) => {
 for (const [key, expected] of Object.entries(req.filter)) {
 if ((row as Record<string, unknown>)[key] !== expected) return false;
 }
 return true;
 });

 const groups = req.groupBy
 ? filtered.reduce<Record<string, number>>((acc, row) => {
 const g = String((row as Record<string, unknown>)[req.groupBy!] ?? 'unknown');
 acc[g] = (acc[g] ?? 0) + 1;
 return acc;
 }, {})
 : undefined;

 return { entity: req.entity as CustomEntity, rows: filtered, groups, totalRows: filtered.length };
}
