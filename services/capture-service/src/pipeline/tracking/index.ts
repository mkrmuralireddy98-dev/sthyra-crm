/**
 * PipelineRunTracker — writes pipeline_runs rows for state transitions.
 *
 * Per tasks.md T-021:
 *   - Every transition produces a row capturing
 *     capture_id, org_id, project_id, stage, status, attempt, error_message,
 *     pipeline_status, started_at, finished_at, artifacts (jsonb).
 *   - When the pipeline becomes terminal (ready/failed/archived), emit
 *     a structured log so observability tools can pick it up.
 *
 * The sink is injected — production will use PostgresCaptureRepository's
 * pipeline_runs insert; tests use a fake in-memory array.
 */

import type { PipelineState, Stage } from '../state-machine.js';

export interface PipelineRunRow {
 readonly captureId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly stage: Stage;
 readonly status: 'running' | 'succeeded' | 'failed';
 readonly attempt: number;
 readonly errorMessage: string | null;
 readonly pipelineStatus: string;
 readonly startedAt: Date | null;
 readonly finishedAt: Date | null;
 readonly artifacts: Readonly<Record<string, string>> | null;
}

export interface PipelineRunSink {
 (row: PipelineRunRow): Promise<void>;
}

export interface PipelineRunLogger {
 (level: 'error' | 'warn' | 'info', msg: string, fields: Record<string, unknown>): void;
}

export interface PipelineRunTrackerDeps {
 readonly sink: PipelineRunSink;
 readonly logger: PipelineRunLogger;
}

export class PipelineRunTracker {
 private readonly sink: PipelineRunSink;
 private readonly logger: PipelineRunLogger;

 constructor(deps: PipelineRunTrackerDeps) {
 this.sink = deps.sink;
 this.logger = deps.logger;
 }

 /**
 * Record the current state's current stage as a row. The row captures
 * the *current* stage (which is the one just started/succeeded/failed),
 * not the pipeline as a whole.
 */
 async record(state: PipelineState, captureId: string, orgId: string, projectId: string): Promise<void> {
 const stage = state.currentStage;
 if (!stage) return;
 const stageState = state.stages[stage];

 const row: PipelineRunRow = {
 captureId,
 orgId,
 projectId,
 stage,
 status: stageState.status === 'idle' || stageState.status === 'skipped' ? 'running' : stageState.status,
 attempt: stageState.attempt,
 errorMessage: stageState.error,
 pipelineStatus: state.pipelineStatus,
 startedAt: stageState.startedAt,
 finishedAt: stageState.finishedAt,
 artifacts: stageState.artifacts,
 };

 await this.sink(row);

 if (state.pipelineStatus === 'ready') {
 this.logger('info', 'pipeline_ready', {
 captureId,
 orgId,
 projectId,
 totalAttempts: stageState.attempt,
 });
 } else if (state.pipelineStatus === 'failed') {
 this.logger('error', 'pipeline_failed', {
 captureId,
 orgId,
 projectId,
 failedStage: stage,
 attempts: stageState.attempt,
 error: stageState.error,
 });
 }
 }
}
