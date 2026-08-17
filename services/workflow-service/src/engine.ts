/**
 * Workflow engine — pure functions.
 *
 * evaluateTrigger / evaluateCondition / applyActions.
 * No I/O. Tested in isolation.
 */

import type {
  Trigger, Condition, Action, EventContext, WorkflowRun,
} from './types.js';

export interface ApplyResult {
 readonly applied: number;
 readonly errors: readonly string[];
 readonly auditLog: readonly AuditLogEntry[];
}

export interface AuditLogEntry {
 readonly workflowId: string;
 readonly actionType: string;
 readonly target: string;
 readonly message: string;
 readonly timestamp: Date;
}

export function evaluateTrigger(trigger: Trigger, context: EventContext): boolean {
 switch (trigger.type) {
 case 'event':
 return context.eventType === trigger.eventType;
 case 'schedule':
 // Phase 10 MVP: schedules always fire on manual run
 return context.eventType === 'workflow.manual_run';
 case 'threshold':
 // Phase 10 MVP: thresholds always fire on manual run
 return context.eventType === 'workflow.manual_run';
 }
}

export function evaluateCondition(condition: Condition | null | undefined, context: EventContext): boolean {
 if (!condition) return true;
 switch (condition.type) {
 case 'equals':
 return getField(context, condition.field) === condition.value;
 case 'in': {
 const val = getField(context, condition.field);
 return val !== undefined && condition.values.includes(val);
 }
 case 'and':
 return condition.conditions.every((c) => evaluateCondition(c, context));
 }
}

function getField(obj: Record<string, unknown>, path: string): unknown {
 const parts = path.split('.');
 let cur: unknown = obj;
 for (const p of parts) {
 if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
 cur = (cur as Record<string, unknown>)[p];
 }
 return cur;
}

export function applyActions(
 actions: readonly Action[],
 context: EventContext,
 workflowId: string,
 now: () => Date = () => new Date(),
): ApplyResult {
 const ts = now();
 const auditLog: AuditLogEntry[] = [];
 const errors: string[] = [];
 let applied = 0;

 for (const action of actions) {
 switch (action.type) {
 case 'notify':
 for (const r of action.recipients) {
 auditLog.push({ workflowId, actionType: 'notify', target: r, message: `notify:${action.template}`, timestamp: ts });
 applied++;
 }
 break;
 case 'assign':
 auditLog.push({ workflowId, actionType: 'assign', target: action.assignee, message: 'assigned', timestamp: ts });
 applied++;
 break;
 case 'log':
 auditLog.push({ workflowId, actionType: 'log', target: 'system', message: action.message, timestamp: ts });
 applied++;
 break;
 }
 }

 return { applied, errors, auditLog };
}

/**
 * Run a workflow synchronously: evaluate trigger, condition, apply actions.
 * Returns a WorkflowRun snapshot.
 */
export function runWorkflow(
 workflowId: string,
 orgId: string,
 trigger: Trigger,
 condition: Condition | null,
 action: Action,
 context: EventContext,
 now: () => Date = () => new Date(),
): WorkflowRun {
 const ts = now();
 const triggerMatch = evaluateTrigger(trigger, context);
 const conditionMatch = evaluateCondition(condition, context);
 const errors: string[] = [];
 let actionsApplied = 0;
 if (!triggerMatch) {
 errors.push('trigger did not match');
 }
 if (!conditionMatch) {
 errors.push('condition did not match');
 }
 let status: WorkflowRun['status'] = 'completed';
 if (!triggerMatch || !conditionMatch) {
 status = 'failed';
 } else {
 const result = applyActions([action], context, workflowId, now);
 actionsApplied = result.applied;
 if (result.errors.length > 0) {
 errors.push(...result.errors);
 status = 'failed';
 }
 }
 return {
 id: `run_${ts.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
 orgId,
 workflowId,
 status,
 context,
 actionsApplied,
 errors,
 startedAt: ts,
 completedAt: status === 'completed' ? ts : null,
 };
}
