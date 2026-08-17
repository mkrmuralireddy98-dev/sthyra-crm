import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { computeVariance } from './variance.js';
import type { Milestone } from './types.js';

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

describe('computeVariance', () => {
 it('returns zeros for empty input', () => {
 const r = computeVariance([], NOW);
 assert.equal(r.plannedEndDate, null);
 assert.equal(r.varianceDays, 0);
 assert.equal(r.overdueMilestones.length, 0);
 });

 it('plannedEndDate = max plannedDate', () => {
 const ms = [mkMilestone('m1', 'pending', 10), mkMilestone('m2', 'pending', 30)];
 const r = computeVariance(ms, NOW);
 assert.ok(r.plannedEndDate);
 assert.equal(r.plannedEndDate!.getTime(), ms[1]!.plannedDate.getTime());
 });

 it('overdueMilestones: pending past plannedDate', () => {
 const ms = [mkMilestone('m1', 'pending', -5), mkMilestone('m2', 'pending', 10)];
 const r = computeVariance(ms, NOW);
 assert.equal(r.overdueMilestones.length, 1);
 assert.equal(r.overdueMilestones[0]!.id, 'm1');
 assert.equal(r.delayedCount, 1);
 });

 it('overdue excludes completed/skipped milestones', () => {
 const ms = [mkMilestone('m1', 'completed', -5), mkMilestone('m2', 'skipped', -3)];
 const r = computeVariance(ms, NOW);
 assert.equal(r.overdueMilestones.length, 0);
 });

 it('atRiskCount: in_progress with low pct and upcoming deadline', () => {
 const ms = [mkMilestone('m1', 'in_progress', 5, 10)];
 const r = computeVariance(ms, NOW);
 assert.equal(r.atRiskCount, 1);
 });

 it('ignores deleted milestones', () => {
 const ms = [{ ...mkMilestone('m1', 'pending', -5), deletedAt: NOW }];
 const r = computeVariance(ms, NOW);
 assert.equal(r.overdueMilestones.length, 0);
 });
});
