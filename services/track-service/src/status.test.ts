import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { computeProjectStatus, computeProjectStatusReport } from './status.js';
import type { Milestone, ProgressEntry } from './types.js';

const NOW = new Date('2026-09-01T00:00:00Z');

function mkMilestone(id: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped', days: number, pct: number = 0): Milestone {
 return {
 id, orgId: 'org_a', projectId: 'prj_1',
 name: id, description: null,
 plannedDate: new Date(NOW.getTime() + days * 86_400_000),
 actualDate: null, status, progressPct: pct,
 dependsOn: [], createdAt: NOW, updatedAt: NOW, deletedAt: null,
 };
}

function mkProgress(pct: number, milestoneId: string | null = null): ProgressEntry {
 return {
 id: 'p_' + pct, orgId: 'org_a', projectId: 'prj_1',
 milestoneId, progressPct: pct, note: null, source: 'manual', loggedAt: NOW,
 };
}

describe('computeProjectStatus', () => {
 it('planning when no milestones', () => {
 assert.equal(computeProjectStatus([], [], NOW), 'planning');
 });

 it('planning when all pending (no progress)', () => {
 const ms = [mkMilestone('m1', 'pending', 10), mkMilestone('m2', 'pending', 20)];
 assert.equal(computeProjectStatus(ms, [], NOW), 'planning');
 });

 it('active when at least one in_progress and progress sufficient', () => {
 const ms = [mkMilestone('m1', 'in_progress', 100), mkMilestone('m2', 'pending', 200)];
 assert.equal(computeProjectStatus(ms, [mkProgress(50)], NOW), 'active');
 });

 it('completed when all completed or skipped', () => {
 const ms = [mkMilestone('m1', 'completed', 0), mkMilestone('m2', 'skipped', 0)];
 assert.equal(computeProjectStatus(ms, [mkProgress(100)], NOW), 'completed');
 });

 it('delayed when overdue and progress < 50%', () => {
 const ms = [mkMilestone('m1', 'pending', -10)];
 assert.equal(computeProjectStatus(ms, [mkProgress(30)], NOW), 'delayed');
 });

 it('at_risk when progress < elapsed * 0.95', () => {
 const ms = [mkMilestone('m1', 'in_progress', 100)];
 assert.equal(computeProjectStatus(ms, [mkProgress(20)], NOW), 'at_risk');
 });

 it('active when progress >= elapsed * 0.95', () => {
 const ms = [mkMilestone('m1', 'in_progress', 100)];
 assert.equal(computeProjectStatus(ms, [mkProgress(95)], NOW), 'active');
 });
});

describe('computeProjectStatusReport', () => {
 it('returns total/completed/pending counts', () => {
 const ms = [
 mkMilestone('m1', 'completed', 0),
 mkMilestone('m2', 'pending', 10),
 mkMilestone('m3', 'in_progress', 20),
 ];
 const report = computeProjectStatusReport(ms, [mkProgress(50)], NOW);
 assert.equal(report.milestones.total, 3);
 assert.equal(report.milestones.completed, 1);
 assert.equal(report.milestones.pending, 1);
 });

 it('counts blocked (pending with incomplete deps)', () => {
 const m1 = mkMilestone('m1', 'pending', 10);
 const m2 = { ...mkMilestone('m2', 'pending', 20), dependsOn: ['m1'] };
 const report = computeProjectStatusReport([m1, m2], [], NOW);
 assert.equal(report.milestones.blocked, 1);
 });

 it('progressPct = max of entries', () => {
 const entries = [mkProgress(20), mkProgress(50), mkProgress(80)];
 const ms = [mkMilestone('m1', 'in_progress', 100)];
 const report = computeProjectStatusReport(ms, entries, NOW);
 assert.equal(report.progressPct, 80);
 });

 it('scheduleVarianceDays = mean of (actual - planned)', () => {
 const m1 = { ...mkMilestone('m1', 'completed', 0), actualDate: new Date(NOW.getTime() + 2 * 86_400_000) };
 const m2 = { ...mkMilestone('m2', 'completed', 0), actualDate: new Date(NOW.getTime() + 4 * 86_400_000) };
 const report = computeProjectStatusReport([m1, m2], [], NOW);
 assert.equal(report.scheduleVarianceDays, 3);
 });

 it('handles empty inputs', () => {
 const report = computeProjectStatusReport([], [], NOW);
 assert.equal(report.milestones.total, 0);
 assert.equal(report.scheduleVarianceDays, 0);
 assert.equal(report.progressPct, 0);
 });
});
