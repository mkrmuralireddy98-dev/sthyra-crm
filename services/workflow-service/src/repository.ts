/**
 * WorkflowRepository — tenant-scoped storage contract.
 */

import type { Workflow, WorkflowRun } from './types.js';

export interface WorkflowRepository {
  insertWorkflow(w: Workflow): Promise<void>;
  findWorkflow(orgId: string, id: string): Promise<Workflow | null>;
  listWorkflows(orgId: string): Promise<readonly Workflow[]>;
  updateWorkflow(orgId: string, id: string, patch: Partial<Workflow>): Promise<Workflow>;
  softDeleteWorkflow(orgId: string, id: string): Promise<void>;
  nextWorkflowId(): number;

  insertWorkflowRun(run: WorkflowRun): Promise<void>;
  listWorkflowRuns(orgId: string, workflowId: string, limit?: number): Promise<readonly WorkflowRun[]>;

  insertIdempotencyKey(orgId: string, key: string, result: { readonly workflowId?: string }, ttlSeconds?: number): Promise<void>;
  getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null>;
}
