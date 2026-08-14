/**
 * Pipeline state machine — pure functional core.
 *
 * The capture service has 5 spatial-AI pipeline stages per spec:
 *   decode → sfm → mesh → segment → align
 *
 * For Phase 1 MVP, all stages are stubs. The state machine itself is
 * real — when the actual GPU stages drop in (Phase 1.b), no state-machine
 * changes are needed.
 *
 * Invariants enforced:
 *   - State is immutable. transition() returns a new state.
 *   - Stages run in fixed order. Skipping ahead throws.
 *   - Any failure short-circuits the pipeline (unless retry=true, which
 *     increments attempt and re-runs the same stage).
 *   - Terminal states: ready, failed, archived.
 *
 * The state machine is pure — no I/O, no Date.now(). The caller (the
 * orchestrator) provides startedAt/finishedAt timestamps.
 */

export const STAGES_IN_ORDER = ['decode', 'sfm', 'mesh', 'segment', 'align'] as const;
export type Stage = (typeof STAGES_IN_ORDER)[number];

export type StageStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type PipelineStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'archived';

export interface StageState {
 readonly status: StageStatus;
 readonly attempt: number;
 readonly startedAt: Date | null;
 readonly finishedAt: Date | null;
 readonly error: string | null;
 readonly artifacts: Readonly<Record<string, string>> | null;
}

export interface PipelineState {
 readonly currentStage: Stage | null; // null when terminal
 readonly pipelineStatus: PipelineStatus;
 readonly stages: Readonly<Record<Stage, StageState>>;
}

function emptyStage(): StageState {
 return {
 status: 'idle',
 attempt: 0,
 startedAt: null,
 finishedAt: null,
 error: null,
 artifacts: null,
 };
}

export function initialState(): PipelineState {
 const stages = {} as Record<Stage, StageState>;
 for (const stage of STAGES_IN_ORDER) {
 stages[stage] = emptyStage();
 }
 return {
 currentStage: STAGES_IN_ORDER[0],
 pipelineStatus: 'pending',
 stages,
 };
}

/**
 * Returns the next stage in the canonical order, or null if `stage` is
 * the terminal stage (align).
 */
export function nextStage(stage: Stage): Stage | null {
 const idx = STAGES_IN_ORDER.indexOf(stage);
 if (idx < 0 || idx >= STAGES_IN_ORDER.length - 1) return null;
 return STAGES_IN_ORDER[idx + 1] ?? null;
}

/**
 * Returns true if the pipeline has reached a terminal state (ready,
 * failed, archived). The orchestrator stops dispatching when this is
 * true.
 */
export function isTerminal(state: PipelineState): boolean {
 return state.pipelineStatus === 'ready'
 || state.pipelineStatus === 'failed'
 || state.pipelineStatus === 'archived';
}

// ────────────────────────────────────────────────────────────────
// Events
// ────────────────────────────────────────────────────────────────
export type PipelineEvent =
 | { readonly type: 'start' }
 | { readonly type: 'stage-succeeded'; readonly stage: Stage; readonly artifacts?: Readonly<Record<string, string>> }
 | { readonly type: 'stage-failed'; readonly stage: Stage; readonly error: string; readonly retry?: boolean };

// ────────────────────────────────────────────────────────────────
// Transition (the heart of the machine)
// ────────────────────────────────────────────────────────────────
export function transition(state: PipelineState, event: PipelineEvent): PipelineState {
 switch (event.type) {
 case 'start': {
 if (state.pipelineStatus !== 'pending') {
 throw new Error(`invalid transition: start requires pending state, got ${state.pipelineStatus}`);
 }
 const stage = state.currentStage;
 if (!stage) throw new Error('invalid transition: no current stage in pending state');
 return {
 ...state,
 pipelineStatus: 'processing',
 stages: {
 ...state.stages,
 [stage]: { ...state.stages[stage], status: 'running', attempt: 1, startedAt: new Date() },
 },
 };
 }

 case 'stage-succeeded': {
 const stage = state.stages[event.stage];
 const wrongStage = event.stage !== state.currentStage;
 const notRunning = stage.status !== 'running';
 if (wrongStage || notRunning) {
 throw new Error(
 `invalid transition: stage-succeeded on ${event.stage}: ` +
 (wrongStage ? `not current stage (current is ${state.currentStage}) ` : '') +
 (notRunning ? `status is ${stage.status}, not running` : ''),
 );
 }
 const next = nextStage(event.stage);
 // currentStage stays at the just-succeeded stage when pipeline completes
 // (align). When the pipeline is mid-flight, currentStage advances to
 // the next pending stage so the orchestrator knows what to run next.
 const updated: PipelineState = {
 ...state,
 stages: {
 ...state.stages,
 [event.stage]: {
 ...stage,
 status: 'succeeded',
 finishedAt: new Date(),
 artifacts: event.artifacts ?? stage.artifacts,
 },
 },
 currentStage: next ?? event.stage, // align success → stay at 'align'
 pipelineStatus: next === null ? 'ready' : 'processing',
 };
 return updated;
 }

 case 'stage-failed': {
 const stage = state.stages[event.stage];
 const wrongStage = event.stage !== state.currentStage;
 const notRunning = stage.status !== 'running';
 if (wrongStage || notRunning) {
 throw new Error(
 `invalid transition: stage-failed on ${event.stage}: ` +
 (wrongStage ? `not current stage (current is ${state.currentStage}) ` : '') +
 (notRunning ? `status is ${stage.status}, not running` : ''),
 );
 }

 // Retry path: increment attempt, re-mark running. Pipeline stays in
 // 'processing'. This is the "exponential backoff then retry" branch.
 if (event.retry === true) {
 return {
 ...state,
 stages: {
 ...state.stages,
 [event.stage]: {
 ...stage,
 status: 'running',
 attempt: stage.attempt + 1,
 startedAt: new Date(),
 error: event.error,
 },
 },
 };
 }

 // Non-retry path: short-circuit the pipeline. The orchestrator will
 // also write a pipeline_runs row with status='failed' and route to
 // the DLQ (per tasks.md T-020).
 return {
 ...state,
 stages: {
 ...state.stages,
 [event.stage]: {
 ...stage,
 status: 'failed',
 finishedAt: new Date(),
 error: event.error,
 },
 },
 pipelineStatus: 'failed',
 };
 }
 }
}

// Type re-export for callers.
export type { Stage as _StageAlias };
