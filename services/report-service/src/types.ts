/**
 * Sthyra CRM Reports — domain types.
 */

export const REPORT_KINDS = ['daily', 'weekly'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const CUSTOM_ENTITIES = ['issues', 'captures', 'milestones'] as const;
export type CustomEntity = (typeof CUSTOM_ENTITIES)[number];

export interface CaptureSummary {
 readonly id: string;
 readonly projectId: string;
 readonly status: 'recording' | 'uploading' | 'processing' | 'ready' | 'failed';
 readonly createdAt: Date;
}

export interface IssueSummary {
 readonly id: string;
 readonly projectId: string;
 readonly status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
 readonly kind: 'standard' | 'punch';
 readonly trade: string | null;
 readonly severity: 'low' | 'medium' | 'high' | 'critical';
 readonly createdAt: Date;
 readonly resolvedAt: Date | null;
}

export interface MilestoneSummary {
 readonly id: string;
 readonly projectId: string;
 readonly name: string;
 readonly status: 'pending' | 'in_progress' | 'completed' | 'skipped';
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

export interface WeeklyReport {
 readonly weekStart: string;
 readonly weekEnd: string;
 readonly orgId: string;
 readonly projects: { total: number; active: number; at_risk: number; delayed: number; completed: number };
 readonly topBlockers: readonly string[];
 readonly topWins: readonly string[];
 readonly totalCaptures: number;
 readonly totalIssuesResolved: number;
 readonly totalProgressPct: number;
}

export interface ProjectDeepDive {
 readonly projectId: string;
 readonly status: 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';
 readonly milestones: { total: number; completed: number; pending: number; blocked: number };
 readonly captures: { total: number; ready: number };
 readonly issues: { total: number; open: number; resolved: number };
 readonly bim: { currentModelId: string | null; totalElements: number };
 readonly punch: { completionPct: number; trade: Record<string, number> };
 readonly progress: { progressPct: number; scheduleVarianceDays: number };
}

export interface PortfolioReport {
 readonly orgId: string;
 readonly totalProjects: number;
 readonly byStatus: Record<string, number>;
 readonly byCompletion: Record<string, number>;
}

export interface CustomReportRequest {
 readonly entity: CustomEntity;
 readonly filter: Readonly<Record<string, unknown>>;
 readonly groupBy?: string;
 readonly dateRange?: { from: string; to: string };
}

export interface CustomReportResult {
 readonly entity: CustomEntity;
 readonly rows: readonly Record<string, unknown>[];
 readonly groups?: Record<string, number>;
 readonly totalRows: number;
}

export interface Schedule {
 readonly id: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly kind: ReportKind;
 readonly dayOfWeek: number | null;
 readonly hour: number;
 readonly recipients: readonly string[];
 readonly nextRunAt: Date;
 readonly createdAt: Date;
}

export interface CreateScheduleInput {
 readonly orgId: string;
 readonly projectId: string;
 readonly kind: ReportKind;
 readonly dayOfWeek?: number | null;
 readonly hour: number;
 readonly recipients: readonly string[];
}
