import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 evaluateTrigger, evaluateCondition, applyActions, runWorkflow,
} from './engine.js';
import type { EventContext, Action } from './types.js';

const NOW = new Date('2026-09-01T12:00:00Z');

const ctx = (eventType: string, payload: Record<string, unknown> = {}): EventContext => ({
 orgId: 'org_a',
 projectId: 'prj_1',
 eventType,
 payload,
 severity: 'critical',
 days_open: 10,
});

describe('evaluateTrigger', () => {
 it('event trigger matches', () => {
 assert.equal(evaluateTrigger({ type: 'event', eventType: 'capture.ready' }, ctx('capture.ready')), true);
 });
 it('event trigger does not match', () => {
 assert.equal(evaluateTrigger({ type: 'event', eventType: 'capture.ready' }, ctx('issue.created')), false);
 });
 it('schedule fires only on manual', () => {
 assert.equal(evaluateTrigger({ type: 'schedule', cron: '0 8 * * *' }, ctx('issue.created')), false);
 assert.equal(evaluateTrigger({ type: 'schedule', cron: '0 8 * * *' }, ctx('workflow.manual_run')), true);
 });
 it('threshold fires only on manual', () => {
 assert.equal(evaluateTrigger({ type: 'threshold', entity: 'issues', metric: 'days_open', op: '>', value: 7 }, ctx('issue.created')), false);
 });
});

describe('evaluateCondition', () => {
 it('null condition is always true', () => {
 assert.equal(evaluateCondition(null, ctx('x')), true);
 });
 it('equals matches', () => {
 assert.equal(evaluateCondition({ type: 'equals', field: 'severity', value: 'critical' }, ctx('x')), true);
 });
 it('equals does not match', () => {
 assert.equal(evaluateCondition({ type: 'equals', field: 'severity', value: 'low' }, ctx('x')), false);
 });
 it('in matches', () => {
 assert.equal(evaluateCondition({ type: 'in', field: 'severity', values: ['critical', 'high'] }, ctx('x')), true);
 });
 it('and evaluates all', () => {
 const c = { type: 'and' as const, conditions: [
 { type: 'equals' as const, field: 'severity', value: 'critical' },
 { type: 'equals' as const, field: 'orgId', value: 'org_a' },
 ] };
 assert.equal(evaluateCondition(c, ctx('x')), true);
 });
 it('and fails if any fails', () => {
 const c = { type: 'and' as const, conditions: [
 { type: 'equals' as const, field: 'severity', value: 'critical' },
 { type: 'equals' as const, field: 'severity', value: 'low' },
 ] };
 assert.equal(evaluateCondition(c, ctx('x')), false);
 });
});

describe('applyActions', () => {
 it('notify with 2 recipients applies 2', () => {
 const action: Action = { type: 'notify', recipients: ['a@b.com', 'c@d.com'], template: 'tmpl' };
 const result = applyActions([action], ctx('x'), 'wf_1', () => NOW);
 assert.equal(result.applied, 2);
 assert.equal(result.auditLog.length, 2);
 });
 it('assign applies 1', () => {
 const action: Action = { type: 'assign', assignee: 'user_1' };
 const result = applyActions([action], ctx('x'), 'wf_1', () => NOW);
 assert.equal(result.applied, 1);
 assert.equal(result.auditLog[0]!.target, 'user_1');
 });
 it('log applies 1', () => {
 const action: Action = { type: 'log', message: 'hi' };
 const result = applyActions([action], ctx('x'), 'wf_1', () => NOW);
 assert.equal(result.applied, 1);
 });
});

describe('runWorkflow', () => {
 it('runs full pipeline on matching event', () => {
 const trigger = { type: 'event' as const, eventType: 'issue.created' };
 const condition = { type: 'equals' as const, field: 'severity', value: 'critical' };
 const action: Action = { type: 'notify', recipients: ['pm@x.com'], template: 'tmpl' };
 const run = runWorkflow('wf_1', 'org_a', trigger, condition, action, ctx('issue.created'), () => NOW);
 assert.equal(run.status, 'completed');
 assert.equal(run.actionsApplied, 1);
 assert.equal(run.errors.length, 0);
 });
 it('returns failed when trigger does not match', () => {
 const trigger = { type: 'event' as const, eventType: 'milestone.overdue' };
 const action: Action = { type: 'notify', recipients: [], template: 't' };
 const run = runWorkflow('wf_1', 'org_a', trigger, null, action, ctx('issue.created'), () => NOW);
 assert.equal(run.status, 'failed');
 assert.ok(run.errors.some((e) => /trigger/.test(e)));
 });
 it('returns failed when condition does not match', () => {
 const trigger = { type: 'event' as const, eventType: 'issue.created' };
 const condition = { type: 'equals' as const, field: 'severity', value: 'low' };
 const action: Action = { type: 'notify', recipients: [], template: 't' };
 const run = runWorkflow('wf_1', 'org_a', trigger, condition, action, ctx('issue.created'), () => NOW);
 assert.equal(run.status, 'failed');
 });
});
