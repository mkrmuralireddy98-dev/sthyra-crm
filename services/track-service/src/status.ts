/**
 * computeProjectStatus — derive project status from milestones + progress.
 * Pure function. Used by GET /v1/projects/:id/status (FR-4).
 */

import type { Milestone, ProgressEntry, ProjectStatus } from './types.js';

function mean(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function maxProgressFromEntries(progress: readonly ProgressEntry[]): number {
  if (progress.length === 0) return 0;
  return Math.max(...progress.map((p) => p.progressPct));
}

function timeElapsedPct(milestones: readonly Milestone[], now: Date): number {
  if (milestones.length === 0) return 0;
  const earliest = Math.min(...milestones.map((m) => m.plannedDate.getTime()));
  const latest = Math.max(...milestones.map((m) => m.plannedDate.getTime()));
  if (latest === earliest) return 100;
  const elapsed = Math.max(0, Math.min(1, (now.getTime() - earliest) / (latest - earliest)));
  return elapsed * 100;
}

export function computeProjectStatus(
  milestones: readonly Milestone[],
  progress: readonly ProgressEntry[],
  now: Date,
): ProjectStatus {
  const active = milestones.filter((m) => m.status === 'in_progress');
  const completed = milestones.filter((m) => m.status === 'completed' || m.status === 'skipped');
  const overdue = milestones.filter(
    (m) => m.plannedDate.getTime() < now.getTime() && m.status !== 'completed' && m.status !== 'skipped' && m.deletedAt === null,
  );

  if (milestones.length === 0) return 'planning';
  if (completed.length === milestones.length) return 'completed';
  if (overdue.length > 0 && maxProgressFromEntries(progress) < 50) return 'delayed';

  const totalProgress = maxProgressFromEntries(progress);
  const elapsed = timeElapsedPct(milestones, now);
  if (totalProgress < elapsed * 0.95) return 'at_risk';

  if (active.length > 0) return 'active';
  return 'planning';
}

export function computeProjectStatusReport(
  milestones: readonly Milestone[],
  progress: readonly ProgressEntry[],
  now: Date,
): {
  projectId: string;
  status: ProjectStatus;
  milestones: { total: number; completed: number; pending: number; blocked: number };
  scheduleVarianceDays: number;
  progressPct: number;
  lastUpdated: Date;
} {
  const projectId = milestones[0]?.projectId ?? progress[0]?.projectId ?? '';
  const status = computeProjectStatus(milestones, progress, now);
  const completed = milestones.filter((m) => m.status === 'completed' || m.status === 'skipped').length;
  const pending = milestones.filter((m) => m.status === 'pending').length;
  const blocked = milestones.filter(
    (m) => m.status === 'pending' && m.dependsOn.some((depId) => {
      const dep = milestones.find((dm) => dm.id === depId);
      return dep && dep.status !== 'completed' && dep.status !== 'skipped';
    }),
  ).length;
  const varianceDays = mean(
    milestones
      .filter((m) => m.actualDate !== null)
      .map((m) => (m.actualDate!.getTime() - m.plannedDate.getTime()) / 86_400_000),
  );
  return {
    projectId,
    status,
    milestones: { total: milestones.length, completed, pending, blocked },
    scheduleVarianceDays: Math.round(varianceDays * 10) / 10,
    progressPct: maxProgressFromEntries(progress),
    lastUpdated: now,
  };
}
