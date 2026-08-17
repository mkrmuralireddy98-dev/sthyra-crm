import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { WorkflowService } from './service.js';
import { InMemoryWorkflowRepository } from './repo-memory.js';
import type { Trigger, Condition, Action } from './types.js';

const NOW = new Date('2026-09-01T12:00:00Z');

let service: WorkflowService;
let repo: InMemoryWorkflowRepository;

beforeEach(() => {
  repo = new InMemoryWorkflowRepository();
  service = new WorkflowService({ repo, now: () => NOW });
});

const eventTrigger: Trigger = { type: 'event', eventType: 'capture.ready' };
const notifyAction: Action = { type: 'notify', recipients: ['a@b.com'], template: 'capture_ready' };

describe('WorkflowService.createWorkflow (FR-1)', () => {
  it('creates a workflow', async () => {
    const w = await service.createWorkflow({
      orgId: 'org_a',
      name: 'notify on capture ready',
      trigger: eventTrigger,
      action: notifyAction,
    });
    assert.ok(w.id.startsWith('wf_'));
    assert.equal(w.enabled, true);
  });

  it('idempotent on same idempotencyKey', async () => {
    const input = { orgId: 'org_a', name: 'w1', trigger: eventTrigger, action: notifyAction };
    const a = await service.createWorkflow(input, 'i1');
    const b = await service.createWorkflow(input, 'i1');
    assert.equal(a.id, b.id);
  });

  it('throws on missing name', async () => {
    await assert.rejects(
      () => service.createWorkflow({ orgId: 'org_a', name: '', trigger: eventTrigger, action: notifyAction }),
      /name required/,
    );
  });
});

describe('WorkflowService.listWorkflows (FR-2)', () => {
  it('lists workflows for tenant', async () => {
    await service.createWorkflow({ orgId: 'org_a', name: 'a', trigger: eventTrigger, action: notifyAction });
    await service.createWorkflow({ orgId: 'org_a', name: 'b', trigger: eventTrigger, action: notifyAction });
    const list = await service.listWorkflows('org_a');
    assert.equal(list.length, 2);
  });

  it('isolates by tenant', async () => {
    await service.createWorkflow({ orgId: 'org_a', name: 'a', trigger: eventTrigger, action: notifyAction });
    const list = await service.listWorkflows('org_b');
    assert.equal(list.length, 0);
  });
});

describe('WorkflowService.updateWorkflow (FR-3)', () => {
  it('updates enabled flag', async () => {
    const w = await service.createWorkflow({ orgId: 'org_a', name: 'w', trigger: eventTrigger, action: notifyAction });
    const updated = await service.updateWorkflow('org_a', w.id, { enabled: false });
    assert.equal(updated.enabled, false);
  });

  it('throws on cross-tenant', async () => {
    const w = await service.createWorkflow({ orgId: 'org_a', name: 'w', trigger: eventTrigger, action: notifyAction });
    await assert.rejects(
      () => service.updateWorkflow('org_b', w.id, { enabled: false }),
      /not found/,
    );
  });
});

describe('WorkflowService.softDeleteWorkflow (FR-4)', () => {
  it('removes from list', async () => {
    const w = await service.createWorkflow({ orgId: 'org_a', name: 'w', trigger: eventTrigger, action: notifyAction });
    await service.softDeleteWorkflow('org_a', w.id);
    const list = await service.listWorkflows('org_a');
    assert.equal(list.length, 0);
  });
});

describe('WorkflowService.runWorkflow (FR-5)', () => {
  it('runs with matching context', async () => {
    const w = await service.createWorkflow({
      orgId: 'org_a', name: 'w',
      trigger: eventTrigger,
      action: notifyAction,
    });
    const result = await service.runWorkflow('org_a', w.id, { eventType: 'capture.ready' });
    assert.equal(result.status, 'completed');
    assert.equal(result.actionsApplied, 1);
  });

  it('returns failed when trigger does not match', async () => {
    const w = await service.createWorkflow({ orgId: 'org_a', name: 'w', trigger: eventTrigger, action: notifyAction });
    const result = await service.runWorkflow('org_a', w.id, { eventType: 'wrong.event' });
    assert.equal(result.status, 'failed');
  });

  it('updates lastRunAt + runCount', async () => {
    const w = await service.createWorkflow({ orgId: 'org_a', name: 'w', trigger: eventTrigger, action: notifyAction });
    await service.runWorkflow('org_a', w.id, { eventType: 'capture.ready' });
    const updated = await repo.findWorkflow('org_a', w.id);
    assert.equal(updated!.runCount, 1);
    assert.ok(updated!.lastRunAt);
  });
});

describe('WorkflowService.listWorkflowRuns (FR-6)', () => {
  it('lists runs for a workflow', async () => {
    const w = await service.createWorkflow({ orgId: 'org_a', name: 'w', trigger: eventTrigger, action: notifyAction });
    await service.runWorkflow('org_a', w.id, { eventType: 'capture.ready' });
    await service.runWorkflow('org_a', w.id, { eventType: 'capture.ready' });
    const runs = await service.listWorkflowRuns('org_a', w.id);
    assert.equal(runs.length, 2);
  });
});

describe('WorkflowService.receiveEvent (FR-7)', () => {
  it('delivers to matching enabled workflows', async () => {
    await service.createWorkflow({ orgId: 'org_a', name: 'a', trigger: eventTrigger, action: notifyAction });
    const result = await service.receiveEvent('org_a', 'capture.ready', { captureId: 'cap_1' });
    assert.equal(result.delivered, 1);
  });

  it('skips disabled workflows', async () => {
    const w = await service.createWorkflow({ orgId: 'org_a', name: 'a', trigger: eventTrigger, action: notifyAction });
    await service.updateWorkflow('org_a', w.id, { enabled: false });
    const result = await service.receiveEvent('org_a', 'capture.ready', {});
    assert.equal(result.delivered, 0);
  });

  it('isolates by tenant', async () => {
    await service.createWorkflow({ orgId: 'org_a', name: 'a', trigger: eventTrigger, action: notifyAction });
    const result = await service.receiveEvent('org_b', 'capture.ready', {});
    assert.equal(result.delivered, 0);
  });
});

describe('WorkflowService.createFromTemplate (helper)', () => {
  it('creates workflow from escalate_critical template', async () => {
    const w = await service.createFromTemplate('org_a', 'escalate_critical', {
      name: 'Escalate critical (custom)',
      action: { type: 'notify', recipients: ['pm@x.com'], template: 'issue_escalation' },
    });
    assert.equal(w.trigger.type, 'threshold');
    assert.equal(w.condition?.type, 'equals');
  });

  it('throws on missing template', async () => {
    await assert.rejects(
      () => service.createFromTemplate('org_a', 'nonexistent'),
      /template not found/,
    );
  });
});
