/**
 * Pipeline Orchestrator — wires the state machine to the actual stages.
 *
 * Per tasks.md T-022:
 *   - On capture.finalize (Phase 1 MVP: directly invoked with a state),
 *     start the pipeline.
 *   - For each stage:
 *     1. Track the transition via PipelineRunTracker
 *     2. Invoke the StageRunner (real or stub) via the dispatcher
 *     3. On retryable error, sleep computeBackoffMs(n) then retry
 *     4. On exhausted retries, DLQ
 *     5. On non-retryable error, DLQ immediately
 *   - Emit domain events: capture.uploaded (ready), capture.failed.
 *
 * The orchestrator is a pure control-flow module — it has no I/O of its
 * own. All side effects go through the injected dependencies.
 */

import type { DomainEvent } from '../types.js';
import {
 initialState,
 transition,
 isTerminal,
 type PipelineState,
 type PipelineEvent,
 type Stage,
} from './state-machine.js';
import { computeBackoffMs, MAX_ATTEMPTS } from './retry.js';
import { type StageRunner } from './stages/index.js';
import { type PipelineRunTracker } from './tracking/index.js';
import { type DLQ } from './dlq.js';

export interface OrchestratorDispatcher {
 /**
 * Invoke the current stage's runner. Returns the stage-succeeded event
 * for successful execution, OR throws an error with `.retryable: boolean`.
 */
 (state: PipelineState): Promise<{
 type: 'stage-succeeded';
 stage: Stage;
 artifacts?: Readonly<Record<string, string>>;
 }>;
}

export interface OrchestratorDeps {
 readonly runners: Readonly<Record<Stage, StageRunner>>;
 readonly tracker: Pick<PipelineRunTracker, 'record'>;
 readonly dlq: Pick<DLQ, 'record'>;
 readonly logger: (level: 'error' | 'warn' | 'info', msg: string, fields: Record<string, unknown>) => void;
 readonly dispatcher: OrchestratorDispatcher;
 /** Optional: test-only override for the backoff computation. */
 readonly computeBackoffMsOverride?: (attempt: number) => number;
 /** Optional: domain event emission callback. */
 readonly onEvent?: (event: DomainEvent) => void;
}

export class Orchestrator {
 private readonly deps: OrchestratorDeps;

 constructor(deps: OrchestratorDeps) {
 this.deps = deps;
 }

 /**
 * Run the pipeline from any state. The default entry state is
 * `initialState()`, but tests can pass an already-started state.
 */
 async run(state: PipelineState, captureId: string, orgId: string, projectId: string): Promise<PipelineState> {
 let s = state;
 const backoff = this.deps.computeBackoffMsOverride ?? computeBackoffMs;

 // If we're given a fresh initial state, start the pipeline first.
 if (s.pipelineStatus === 'pending') {
 s = transition(s, { type: 'start' });
 }

 while (!isTerminal(s)) {
 const stage = s.currentStage;
 if (!stage) break;

 // Track the current transition (Constitution §VI observability)
 await this.deps.tracker.record(s, captureId, orgId, projectId);

 // Dispatch the stage. The dispatcher returns the success event or throws.
 try {
 const evt = await this.deps.dispatcher(s);
 if (evt.type === 'stage-succeeded') {
 s = transition(s, evt);
 }
 } catch (err) {
 const retryable = (err as { retryable?: boolean }).retryable === true;
 const attempt = s.stages[stage].attempt;

 if (retryable && attempt < MAX_ATTEMPTS) {
 this.deps.logger('warn', 'pipeline_stage_retry', {
 captureId, orgId, stage, attempt, error: (err as Error).message,
 });
 // Sleep then retry by setting back to running (attempt+1, startedAt now).
 await new Promise<void>((r) => setTimeout(r, backoff(attempt)));
 s = transition(s, { type: 'stage-failed', stage, error: (err as Error).message, retry: true });
 } else {
 // Non-retryable OR retry budget exhausted → DLQ + fail.
 this.deps.logger('error', 'pipeline_stage_failed', {
 captureId, orgId, stage, attempt, error: (err as Error).message, retryable,
 });
 s = transition(s, { type: 'stage-failed', stage, error: (err as Error).message });
 await this.deps.dlq.record(s, captureId, orgId);
 this.deps.onEvent?.({
 type: 'capture.uploaded',
 captureId,
 orgId,
 projectId,
 occurredAt: new Date(),
 });
 break;
 }
 }
 }

 // Track final state too
 await this.deps.tracker.record(s, captureId, orgId, projectId);

 // Emit final domain event based on terminal status.
 if (s.pipelineStatus === 'ready') {
 this.deps.onEvent?.({
 type: 'capture.uploaded',
 captureId,
 orgId,
 projectId,
 occurredAt: new Date(),
 });
 } else if (s.pipelineStatus === 'failed') {
 this.deps.onEvent?.({
 type: 'capture.failed',
 captureId,
 orgId,
 projectId,
 occurredAt: new Date(),
 });
 }

 return s;
 }
}
