/**
 * DLQ — Dead-letter queue for pipeline failures.
 *
 * Per tasks.md T-020 + spec-kit plan.md §DLQ:
 *   - Failed-after-retries → write DLQ entry + log error
 *   - The actual storage (SQS DLQ, Kafka dead-letter topic) is injected
 *     so tests can use a fake in-memory sink.
 *
 * The DLQ is a thin wrapper — the orchestrator (T-022) is what actually
 * calls it. This module only knows:
 *   - how to extract the failure context from a PipelineState
 *   - how to format it as a DLQ entry
 *   - how to ship it to the sink + log
 */

import type { PipelineState } from './state-machine.js';

export interface DLQEntry {
 readonly captureId: string;
 readonly orgId: string;
 readonly stage: string;
 readonly attempt: number;
 readonly error: string;
 readonly occurredAt: Date;
}

export interface DLQSink {
 (entry: DLQEntry): Promise<void>;
}

export interface LoggerSink {
 (level: 'error' | 'warn' | 'info', msg: string, fields: Record<string, unknown>): void;
}

export interface DLQDeps {
 readonly sink: DLQSink;
 readonly logger: LoggerSink;
}

export class DLQ {
 private readonly sink: DLQSink;
 private readonly logger: LoggerSink;

 constructor(deps: DLQDeps) {
 this.sink = deps.sink;
 this.logger = deps.logger;
 }

 /**
 * Records a DLQ entry for a failed pipeline state. The state must
 * have at least one failed stage (pipelineStatus='failed'). No-op
 * otherwise — defensive against accidental calls from healthy states.
 */
 async record(state: PipelineState, captureId: string, orgId: string): Promise<void> {
 if (state.pipelineStatus !== 'failed') {
 return;
 }
 // Find the failed stage.
 let failedStage: { stage: string; attempt: number; error: string | null } | null = null;
 for (const stageName of ['decode', 'sfm', 'mesh', 'segment', 'align'] as const) {
 const s = state.stages[stageName];
 if (s.status === 'failed') {
 failedStage = { stage: stageName, attempt: s.attempt, error: s.error };
 break;
 }
 }
 if (!failedStage) return;

 const entry: DLQEntry = {
 captureId,
 orgId,
 stage: failedStage.stage,
 attempt: failedStage.attempt,
 error: failedStage.error ?? 'unknown',
 occurredAt: new Date(),
 };

 this.logger('error', 'pipeline_dlq_entry', {
 captureId,
 orgId,
 stage: failedStage.stage,
 attempt: failedStage.attempt,
 error: failedStage.error,
 });

 await this.sink(entry);
 }
}
