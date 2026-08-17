/**
 * computeVariance — schedule variance per project.
 * Pure function. Used by GET /v1/projects/:id/variance (FR-5).
 */

import type { Milestone, VarianceReport } from './types.js';

export function computeVariance(
  milestones: readonly Milestone[],
  now: Date,
): VarianceReport {
  const notDeleted = milestones.filter((m) => m.deletedAt === null);
  if (notDeleted.length === 0) {
    return {
      plannedEndDate: null,
      currentEndDate: null,
      varianceDays: 0,
      atRiskCount: 0,
      delayedCount: 0,
      overdueMilestones: [],
    };
  }
  const plannedEndDate = notDeleted.reduce(
    (max, m) => (m.plannedDate.getTime() > max.getTime() ? m.plannedDate : max),
    notDeleted[0]!.plannedDate,
  );
  const overdueMilestones = notDeleted.filter(
    (m) => m.plannedDate.getTime() < now.getTime() && m.status !== 'completed' && m.status !== 'skipped',
  );
  const delayedCount = overdueMilestones.length;
  const atRiskCount = notDeleted.filter(
    (m) => m.status === 'in_progress' && m.progressPct < 50 && m.plannedDate.getTime() - now.getTime() < 7 * 86_400_000,
  ).length;
  const currentEndDate = overdueMilestones.length > 0
    ? overdueMilestones.reduce((max, m) => (m.plannedDate.getTime() > max.getTime() ? m.plannedDate : max), plannedEndDate)
    : plannedEndDate;
  const varianceDays = (currentEndDate.getTime() - plannedEndDate.getTime()) / 86_400_000;
  return {
    plannedEndDate,
    currentEndDate,
    varianceDays: Math.round(varianceDays * 10) / 10,
    atRiskCount,
    delayedCount,
    overdueMilestones,
  };
}
