/**
 * Sthyra CRM Workflow Automation — domain types.
 */

export const TRIGGER_TYPES = ['event', 'schedule', 'threshold'] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export type Trigger =
  | { readonly type: 'event'; readonly eventType: string; readonly orgId?: string }
  | { readonly type: 'schedule'; readonly cron: string; readonly timezone?: string }
  | { readonly type: 'threshold'; readonly entity: 'issues'; readonly metric: 'days_open'; readonly op: '>' | '>=' | '<' | '<=' | '=='; readonly value: number };

export type Condition =
  | { readonly type: 'equals'; readonly field: string; readonly value: unknown }
  | { readonly type: 'in'; readonly field: string; readonly values: readonly unknown[] }
  | { readonly type: 'and'; readonly conditions: readonly Condition[] };

export type Action =
  | { readonly type: 'notify'; readonly recipients: readonly string[]; readonly template: string }
  | { readonly type: 'assign'; readonly assignee: string }
  | { readonly type: 'log'; readonly message: string };

export interface Workflow {
  readonly id: string;
  readonly orgId: string;
  readonly name: string;
  readonly trigger: Trigger;
  readonly condition: Condition | null;
  readonly action: Action;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly lastRunAt: Date | null;
  readonly runCount: number;
}

export interface WorkflowRun {
  readonly id: string;
  readonly orgId: string;
  readonly workflowId: string;
  readonly status: 'completed' | 'failed';
  readonly context: Readonly<Record<string, unknown>>;
  readonly actionsApplied: number;
  readonly errors: readonly string[];
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export interface Template {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: Trigger;
  readonly condition: Condition | null;
  readonly action: Action;
}

export interface EventContext {
  readonly orgId: string;
  readonly projectId?: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CreateWorkflowInput {
  readonly orgId: string;
  readonly name: string;
  readonly trigger: Trigger;
  readonly condition?: Condition | null;
  readonly action: Action;
  readonly enabled?: boolean;
}

export interface UpdateWorkflowInput {
  readonly name?: string;
  readonly trigger?: Trigger;
  readonly condition?: Condition | null;
  readonly action?: Action;
  readonly enabled?: boolean;
}
