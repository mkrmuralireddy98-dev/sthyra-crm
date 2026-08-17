/**
 * InMemoryWorkflowRepository — Phase 10 MVP implementation.
 */

import type { WorkflowRepository } from './repository.js';
import type { Workflow, WorkflowRun } from './types.js';

interface IdempotencyEntry { readonly value: unknown; readonly expiresAt: number; }

const MAX_RUNS_PER_WORKFLOW = 100;

export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly workflows = new Map<string, Workflow>();
  private readonly runs = new Map<string, WorkflowRun>();
  private readonly idem = new Map<string, IdempotencyEntry>();
  private readonly idCounter = { workflow: 0 };

  private wKey(orgId: string, id: string): string { return `w:${orgId}:${id}`; }
  private rKey(orgId: string, workflowId: string, id: string): string { return `r:${orgId}:${workflowId}:${id}`; }
  private idemKey(orgId: string, key: string): string { return `idem:${orgId}:${key}`; }

  async insertWorkflow(w: Workflow): Promise<void> {
    this.workflows.set(this.wKey(w.orgId, w.id), w);
  }

  async findWorkflow(orgId: string, id: string): Promise<Workflow | null> {
    return this.workflows.get(this.wKey(orgId, id)) ?? null;
  }

  async listWorkflows(orgId: string): Promise<readonly Workflow[]> {
    const out: Workflow[] = [];
    for (const w of this.workflows.values()) {
      if (w.orgId === orgId && w.deletedAt === null) out.push(w);
    }
    return out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async updateWorkflow(orgId: string, id: string, patch: Partial<Workflow>): Promise<Workflow> {
    const key = this.wKey(orgId, id);
    const cur = this.workflows.get(key);
    if (!cur) throw new Error('workflow not found: ' + id);
    if (cur.orgId !== orgId) throw new Error('workflow not found: ' + id);
    const next: Workflow = { ...cur, ...patch, updatedAt: new Date() };
    this.workflows.set(key, next);
    return next;
  }

  async softDeleteWorkflow(orgId: string, id: string): Promise<void> {
    const key = this.wKey(orgId, id);
    const cur = this.workflows.get(key);
    if (!cur || cur.orgId !== orgId) return;
    this.workflows.set(key, { ...cur, deletedAt: new Date() });
  }

  nextWorkflowId(): number { this.idCounter.workflow += 1; return this.idCounter.workflow; }

  async insertWorkflowRun(run: WorkflowRun): Promise<void> {
    this.runs.set(this.rKey(run.orgId, run.workflowId, run.id), run);
    // Evict oldest runs over the cap
    const all = await this.listWorkflowRuns(run.orgId, run.workflowId, Infinity);
    if (all.length > MAX_RUNS_PER_WORKFLOW) {
      const sorted = [...all].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      const toEvict = sorted.slice(0, all.length - MAX_RUNS_PER_WORKFLOW);
      for (const r of toEvict) this.runs.delete(this.rKey(run.orgId, run.workflowId, r.id));
    }
  }

  async listWorkflowRuns(orgId: string, workflowId: string, limit: number = 20): Promise<readonly WorkflowRun[]> {
    const out: WorkflowRun[] = [];
    for (const r of this.runs.values()) {
      if (r.orgId === orgId && r.workflowId === workflowId) out.push(r);
    }
    out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return out.slice(0, limit);
  }

  async insertIdempotencyKey(orgId: string, key: string, result: { readonly workflowId?: string }, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? 24 * 3600;
    this.idem.set(this.idemKey(orgId, key), { value: result, expiresAt: Date.now() + ttl * 1000 });
  }

  async getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null> {
    const entry = this.idem.get(this.idemKey(orgId, key));
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.idem.delete(this.idemKey(orgId, key));
      return null;
    }
    return entry.value as T;
  }
}
