/**
 * WorkflowService — domain layer.
 */

import { randomUUID } from 'node:crypto';
import { runWorkflow as engineRun, type AuditLogEntry } from './engine.js';
import type {
  Workflow, WorkflowRun, Trigger, Condition, Action, EventContext,
  CreateWorkflowInput, UpdateWorkflowInput,
} from './types.js';
import type { WorkflowRepository } from './repository.js';

export interface WorkflowServiceDeps {
  readonly repo: WorkflowRepository;
  readonly now?: () => Date;
}

export interface RunResult {
  readonly runId: string;
  readonly status: 'completed' | 'failed';
  readonly actionsApplied: number;
  readonly errors: readonly string[];
  readonly auditLog: readonly AuditLogEntry[];
}

export interface ReceiveEventResult {
  readonly delivered: number;
  readonly runs: readonly WorkflowRun[];
}

export class WorkflowService {
  private readonly repo: WorkflowRepository;
  private readonly now: () => Date;

  constructor(deps: WorkflowServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
  }

  // ─── FR-1: createWorkflow ──────────────────────────
  async createWorkflow(input: CreateWorkflowInput, idempotencyKey?: string): Promise<Workflow> {
    if (!input.orgId) throw new Error('orgId required');
    if (!input.name) throw new Error('name required');
    if (!input.trigger) throw new Error('trigger required');
    if (!input.action) throw new Error('action required');

    if (idempotencyKey) {
      const cached = await this.repo.getIdempotencyResult<{ workflowId?: string }>(input.orgId, idempotencyKey);
      if (cached?.workflowId) {
        const existing = await this.repo.findWorkflow(input.orgId, cached.workflowId);
        if (existing) return existing;
      }
    }

    const id = `wf_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
    const ts = this.now();
    const workflow: Workflow = {
      id, orgId: input.orgId,
      name: input.name,
      trigger: input.trigger,
      condition: input.condition ?? null,
      action: input.action,
      enabled: input.enabled ?? true,
      createdAt: ts, updatedAt: ts, deletedAt: null,
      lastRunAt: null, runCount: 0,
    };
    await this.repo.insertWorkflow(workflow);
    if (idempotencyKey) {
      await this.repo.insertIdempotencyKey(input.orgId, idempotencyKey, { workflowId: workflow.id });
    }
    return workflow;
  }

  // ─── FR-2: listWorkflows ───────────────────────────
  async listWorkflows(orgId: string): Promise<readonly Workflow[]> {
    return this.repo.listWorkflows(orgId);
  }

  // ─── FR-3: updateWorkflow ──────────────────────────
  async updateWorkflow(orgId: string, id: string, input: UpdateWorkflowInput): Promise<Workflow> {
    type Writable<T> = { -readonly [K in keyof T]: T[K] };
    const patch: Writable<Partial<Workflow>> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.trigger !== undefined) patch.trigger = input.trigger;
    if (input.condition !== undefined) patch.condition = input.condition;
    if (input.action !== undefined) patch.action = input.action;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    return this.repo.updateWorkflow(orgId, id, patch);
  }

  // ─── FR-4: deleteWorkflow ──────────────────────────
  async softDeleteWorkflow(orgId: string, id: string): Promise<void> {
    await this.repo.softDeleteWorkflow(orgId, id);
  }

  // ─── FR-5: runWorkflow ────────────────────────────
  async runWorkflow(orgId: string, id: string, context: Record<string, unknown>): Promise<RunResult> {
    const wf = await this.repo.findWorkflow(orgId, id);
    if (!wf) throw new Error('workflow not found: ' + id);
    if (wf.orgId !== orgId) throw new Error('workflow not found: ' + id);

    const eventCtx: EventContext = {
      orgId: wf.orgId,
      projectId: context.projectId as string | undefined,
      eventType: (context.eventType as string) ?? 'workflow.manual_run',
      payload: context,
    };
    const run = engineRun(wf.id, wf.orgId, wf.trigger, wf.condition, wf.action, eventCtx, this.now);

    // Audit log from the run — engine currently doesn't return it directly.
    // For now, persist the run with actions count.
    await this.repo.insertWorkflowRun(run);

    // Update workflow stats
    await this.repo.updateWorkflow(orgId, id, {
      lastRunAt: this.now(),
      runCount: wf.runCount + 1,
    });

    return {
      runId: run.id,
      status: run.status,
      actionsApplied: run.actionsApplied,
      errors: run.errors,
      auditLog: [],
    };
  }

  // ─── FR-6: listWorkflowRuns ────────────────────────
  async listWorkflowRuns(orgId: string, workflowId: string, limit: number = 20): Promise<readonly WorkflowRun[]> {
    return this.repo.listWorkflowRuns(orgId, workflowId, limit);
  }

  // ─── FR-7: receiveEvent ────────────────────────────
  async receiveEvent(orgId: string, eventType: string, payload: Record<string, unknown>): Promise<ReceiveEventResult> {
    const all = await this.repo.listWorkflows(orgId);
    const eventCtx: EventContext = { orgId, eventType, payload };
    const runs: WorkflowRun[] = [];
    for (const wf of all) {
      if (!wf.enabled) continue;
      const run = engineRun(wf.id, wf.orgId, wf.trigger, wf.condition, wf.action, eventCtx, this.now);
      await this.repo.insertWorkflowRun(run);
      await this.repo.updateWorkflow(orgId, wf.id, { lastRunAt: this.now(), runCount: wf.runCount + 1 });
      runs.push(run);
    }
    return { delivered: runs.filter((r) => r.status === 'completed').length, runs };
  }

  // ─── FR-8: listTemplates ──────────────────────────
  async listTemplates() {
    const { TEMPLATES } = await import('./templates.js');
    return TEMPLATES;
  }

  // ─── applyTemplate (helper for FR-1 with template) ──
  async createFromTemplate(orgId: string, templateId: string, overrides: Partial<CreateWorkflowInput> = {}, idempotencyKey?: string): Promise<Workflow> {
    const { findTemplate } = await import('./templates.js');
    const tpl = findTemplate(templateId);
    if (!tpl) throw new Error('template not found: ' + templateId);
    return this.createWorkflow({
      orgId,
      name: overrides.name ?? tpl.name,
      trigger: overrides.trigger ?? tpl.trigger,
      condition: overrides.condition ?? tpl.condition,
      action: overrides.action ?? tpl.action,
      enabled: overrides.enabled ?? true,
    }, idempotencyKey);
  }

  // Suppress unused-param warnings (Trigger/Condition/Action used in public API surface)
  private _apiTypes: (Trigger | Condition | Action)[] = [];
  private get unused(): (Trigger | Condition | Action)[] { return this._apiTypes; }
}
