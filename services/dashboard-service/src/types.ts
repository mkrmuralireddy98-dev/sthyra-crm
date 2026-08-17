/**
 * Sthyra CRM Dashboard — types.
 */

export interface ProjectSummary {
  readonly id: string;
  readonly orgId: string;
  readonly name: string;
  readonly status: 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';
  readonly progressPct: number;
}

export interface IssueSummary {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
  readonly kind: 'standard' | 'punch';
  readonly trade: string | null;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly createdAt: Date;
}

export interface CaptureSummary {
  readonly id: string;
  readonly projectId: string;
  readonly status: string;
  readonly createdAt: Date;
}

export interface MilestoneSummary {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly status: string;
  readonly plannedDate: Date;
  readonly actualDate: Date | null;
}

export interface ProgressSummary {
  readonly id: string;
  readonly projectId: string;
  readonly progressPct: number;
  readonly loggedAt: Date;
}

export interface DailyReport {
  readonly date: string;
  readonly projectId: string;
  readonly captures: { total: number; processed: number; failed: number };
  readonly issues: { opened: number; resolved: number; open: number };
  readonly progress: { punchCompletionPct: number; projectProgressPct: number };
  readonly milestones: { completed: number; overdue: number };
}

export interface StatusHistoryEntry {
  readonly id: number;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly actorId: string;
  readonly reason: string;
  readonly occurredAt: Date;
}

export interface Comment {
  readonly id: string;
  readonly issueId: string;
  readonly authorId: string;
  readonly text: string;
  readonly createdAt: Date;
}

export interface WorkflowSummary {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly runCount: number;
  readonly lastRunAt: Date | null;
}

export interface IntegrationSummary {
  readonly id: string;
  readonly provider: string;
  readonly status: string;
  readonly connectedAt: Date;
}

export interface ProjectPageData {
  readonly project: ProjectSummary;
  readonly milestones: { total: number; completed: number; blocked: number };
  readonly captures: { total: number; ready: number };
  readonly issues: { total: number; open: number; resolved: number };
  readonly punch: { completionPct: number };
  readonly progress: { progressPct: number };
}

export interface HomePageData {
  readonly projects: readonly ProjectSummary[];
}
