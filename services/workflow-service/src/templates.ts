/**
 * Built-in workflow templates.
 */

import type { Template } from './types.js';

export const TEMPLATES: readonly Template[] = [
 {
 id: 'escalate_critical',
 name: 'Escalate critical issues after 7 days',
 description: 'Notify project manager when critical issues stay open > 7 days',
 trigger: { type: 'threshold', entity: 'issues', metric: 'days_open', op: '>', value: 7 },
 condition: { type: 'equals', field: 'severity', value: 'critical' },
 action: { type: 'notify', recipients: [], template: 'issue_escalation' },
 },
 {
 id: 'notify_capture_ready',
 name: 'Notify on capture ready',
 description: 'Notify inspector when a capture finishes processing',
 trigger: { type: 'event', eventType: 'capture.ready' },
 condition: null,
 action: { type: 'notify', recipients: [], template: 'capture_ready' },
 },
 {
 id: 'milestone_overdue',
 name: 'Notify on milestone overdue',
 description: 'Notify PM when a milestone is overdue',
 trigger: { type: 'event', eventType: 'milestone.overdue' },
 condition: null,
 action: { type: 'notify', recipients: [], template: 'milestone_overdue' },
 },
 {
 id: 'punch_completion',
 name: 'Notify on punch list completion',
 description: 'Notify PM when punch list reaches 100% completion',
 trigger: { type: 'event', eventType: 'punch.completed' },
 condition: null,
 action: { type: 'notify', recipients: [], template: 'punch_completed' },
 },
 {
 id: 'project_status_change',
 name: 'Log project status change',
 description: 'Audit-log every project status change',
 trigger: { type: 'event', eventType: 'project.status_changed' },
 condition: null,
 action: { type: 'log', message: 'Project status changed' },
 },
];

export function findTemplate(id: string): Template | null {
 return TEMPLATES.find((t) => t.id === id) ?? null;
}
