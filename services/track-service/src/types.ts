/**
 * Sthyra CRM Track — domain types.
 */

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const PROJECT_STATUSES = ['planning', 'active', 'at_risk', 'delayed', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROGRESS_SOURCES = ['manual'] as const;
export type ProgressSource = (typeof PROGRESS_SOURCES)[number];

export interface Milestone {
  readonly id: string;
  readonly orgId: string;
  readonly projectId: string;
  readonly name: string;
  readonly description: string | null;
  readonly plannedDate: Date;
  readonly actualDate: Date | null;
  readonly status: MilestoneStatus;
  readonly progressPct: number;
  readonly dependsOn: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface ProgressEntry {
  readonly id: string;
  readonly orgId: string;
  readonly projectId: string;
  readonly milestoneId: string | null;
  readonly progressPct: number;
  readonly note: string | null;
  readonly source: ProgressSource;
  readonly loggedAt: Date;
}

export interface ProjectStatusReport {
  readonly projectId: string;
  readonly status: ProjectStatus;
  readonly milestones: { total: number; completed: number; pending: number; blocked: number };
  readonly scheduleVarianceDays: number;
  readonly progressPct: number;
  readonly lastUpdated: Date;
}

export interface VarianceReport {
  readonly plannedEndDate: Date | null;
  readonly currentEndDate: Date | null;
  readonly varianceDays: number;
  readonly atRiskCount: number;
  readonly delayedCount: number;
  readonly overdueMilestones: readonly Milestone[];
}

export interface CreateMilestoneInput {
  readonly orgId: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly plannedDate: Date;
  readonly dependsOn?: readonly string[];
}

export interface UpdateMilestoneInput {
  readonly status?: MilestoneStatus;
  readonly actualDate?: Date | null;
  readonly progressPct?: number;
  readonly actorId: string;
}

export interface LogProgressInput {
  readonly orgId: string;
  readonly projectId: string;
  readonly milestoneId?: string | null;
  readonly progressPct: number;
  readonly note?: string | null;
  readonly source: ProgressSource;
}
