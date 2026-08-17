import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  aggregateDaily, aggregateWeekly, aggregateDeepDive, aggregatePortfolio, runCustom,
} from './aggregators.js';
import type {
  CaptureSummary, IssueSummary, MilestoneSummary, ProgressSummary,
} from './types.js';

const NOW = new Date('2026-09-01T12:00:00Z');
const DAY = new Date('2026-09-01T00:00:00Z');

function mkCapture(id: string, status: 'recording' | 'uploading' | 'processing' | 'ready' | 'failed', createdAt: Date): CaptureSummary {
 return { id, projectId: 'prj_1', status, createdAt };
}

function mkIssue(id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix', kind: 'standard' | 'punch' = 'standard', trade: string | null = null): IssueSummary {
 return {
 id, projectId: 'prj_1',
 status, kind, trade, severity: 'medium',
 createdAt: NOW, resolvedAt: status === 'resolved' || status === 'closed' ? NOW : null,
 };
}

function mkMilestone(id: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped', plannedDate: Date, actualDate: Date | null = null): MilestoneSummary {
 return { id, projectId: 'prj_1', name: id, status, plannedDate, actualDate };
}

function mkProgress(pct: number, loggedAt: Date = NOW): ProgressSummary {
 return { id: 'p_' + pct, projectId: 'prj_1', progressPct: pct, loggedAt };
}

describe('aggregateDaily', () => {
 it('counts captures and issues for the day', () => {
 const captures = [mkCapture('c1', 'ready', DAY), mkCapture('c2', 'failed', DAY)];
 const issues = [mkIssue('i1', 'open'), mkIssue('i2', 'resolved')];
 const milestones: MilestoneSummary[] = [];
 const progress: ProgressSummary[] = [];
 const report = aggregateDaily('prj_1', DAY, captures, issues, progress, milestones, NOW);
 assert.equal(report.captures.total, 2);
 assert.equal(report.captures.processed, 1);
 assert.equal(report.captures.failed, 1);
 assert.equal(report.issues.opened, 2);
 });

 it('counts overdue milestones', () => {
 const milestones = [
 mkMilestone('m1', 'pending', new Date('2026-08-01T00:00:00Z')),
 mkMilestone('m2', 'completed', new Date('2026-08-01T00:00:00Z'), new Date('2026-08-02T00:00:00Z')),
 ];
 const report = aggregateDaily('prj_1', DAY, [], [], [], milestones, NOW);
 assert.equal(report.milestones.overdue, 1);
 });

 it('punchCompletionPct = closed / total punch * 100', () => {
 const issues = [
 mkIssue('i1', 'closed', 'punch'),
 mkIssue('i2', 'closed', 'punch'),
 mkIssue('i3', 'open', 'punch'),
 ];
 const report = aggregateDaily('prj_1', DAY, [], issues, [], [], NOW);
 assert.equal(report.progress.punchCompletionPct, 67);
 });
});

describe('aggregateWeekly', () => {
 it('counts projects by status', () => {
 const projects = [
 { projectId: 'p1', status: 'active', totalCaptures: 10, issuesResolved: 5, topBlocker: null, topWin: null, progressPct: 50 },
 { projectId: 'p2', status: 'at_risk', totalCaptures: 8, issuesResolved: 3, topBlocker: 'Bim alignment', topWin: null, progressPct: 30 },
 ];
 const report = aggregateWeekly('org_a', NOW, projects);
 assert.equal(report.projects.total, 2);
 assert.equal(report.projects.active, 1);
 assert.equal(report.projects.at_risk, 1);
 assert.equal(report.totalCaptures, 18);
 assert.deepEqual(report.topBlockers, ['Bim alignment']);
 });
});

describe('aggregateDeepDive', () => {
 it('returns milestone counts', () => {
 const milestones = [
 mkMilestone('m1', 'completed', DAY, DAY),
 mkMilestone('m2', 'pending', DAY),
 mkMilestone('m3', 'in_progress', DAY),
 ];
 const report = aggregateDeepDive('prj_1', milestones, [], [], [], { currentModelId: 'bim_1', totalElements: 5000 }, NOW);
 assert.equal(report.milestones.total, 3);
 assert.equal(report.milestones.completed, 1);
 assert.equal(report.milestones.pending, 1);
 });

 it('punch completion counts punch items only', () => {
 const issues = [
 mkIssue('i1', 'closed', 'punch', 'plumbing'),
 mkIssue('i2', 'open', 'punch', 'plumbing'),
 mkIssue('i3', 'open', 'standard'),
 ];
 const report = aggregateDeepDive('prj_1', [], [], issues, [], { currentModelId: null, totalElements: 0 }, NOW);
 assert.equal(report.punch.completionPct, 50);
 assert.equal(report.punch.trade['plumbing'], 2);
 });

 it('handles empty inputs', () => {
 const report = aggregateDeepDive('prj_1', [], [], [], [], { currentModelId: null, totalElements: 0 }, NOW);
 assert.equal(report.status, 'planning');
 assert.equal(report.captures.total, 0);
 });
});

describe('aggregatePortfolio', () => {
 it('counts by status and bucket', () => {
 const projects = [
 { projectId: 'p1', status: 'active', progressPct: 20 },
 { projectId: 'p2', status: 'at_risk', progressPct: 45 },
 { projectId: 'p3', status: 'completed', progressPct: 100 },
 ];
 const report = aggregatePortfolio('org_a', projects);
 assert.equal(report.totalProjects, 3);
 assert.equal(report.byStatus['active'], 1);
 assert.equal(report.byCompletion['0-25%'], 1);
 assert.equal(report.byCompletion['25-50%'], 1);
 assert.equal(report.byCompletion['75-100%'], 1);
 });
});

describe('runCustom', () => {
 it('filters by status=open', () => {
 const issues = [mkIssue('i1', 'open'), mkIssue('i2', 'closed')];
 const result = runCustom({ entity: 'issues', filter: { status: 'open' } }, issues, [], []);
 assert.equal(result.totalRows, 1);
 assert.equal(result.rows[0]!.id, 'i1');
 });

 it('groups by trade', () => {
 const issues = [
 mkIssue('i1', 'open', 'punch', 'plumbing'),
 mkIssue('i2', 'open', 'punch', 'electrical'),
 mkIssue('i3', 'open', 'punch', 'plumbing'),
 ];
 const result = runCustom({ entity: 'issues', filter: { kind: 'punch' }, groupBy: 'trade' }, issues, [], []);
 assert.equal(result.groups?.['plumbing'], 2);
 assert.equal(result.groups?.['electrical'], 1);
 });
});
