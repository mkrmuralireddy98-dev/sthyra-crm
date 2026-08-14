/**
 * Pipeline stages — Phase 1 MVP stubs.
 *
 * Per tasks.md T-017 + T-018:
 *   - decode: demux mp4 → per-frame images
 *   - sfm: structure-from-motion (COLMAP / GLOMAP)
 *   - mesh: dense mesh reconstruction
 *   - segment: semantic segmentation of the mesh
 *   - align: ICP alignment to BIM (if available)
 *
 * For Phase 1 MVP all stages are stubs that:
 *   1. Sleep for ~30ms (so the state machine is observable)
 *   2. Emit a structured log line
 *   3. Return artifacts = {} (real impls produce DICOM / OBJ / GLB / gITF)
 *
 * Phase 1.b drops in real implementations: each stage becomes a
 * StageRunner that wraps the actual GPU/CPU job + handles status
 * transitions + retryable errors. The state machine + orchestrator
 * don't change.
 */

import { STAGES_IN_ORDER } from '../state-machine.js';
import type { Stage, StageState } from '../state-machine.js';

export { STAGES_IN_ORDER };

export interface StageInput {
 readonly orgId: string;
 readonly projectId: string;
 readonly captureId: string;
 readonly stage: Stage;
 readonly attempt: number;
}

export interface StageResult {
 readonly artifacts: Readonly<Record<string, string>>;
 readonly startedAt: Date;
 readonly finishedAt: Date;
}

export interface StageRunner {
 run(input: StageInput): Promise<StageResult>;
 describe(): { name: string; timeoutSeconds: number };
}

const STUB_LATENCY_MS = 30;

export function makeStubStageRunner(
 stage: Stage,
 options?: { latencyMs?: number },
): StageRunner {
 return {
 async run(input: StageInput): Promise<StageResult> {
 const startedAt = new Date();
 const latency = options?.latencyMs ?? STUB_LATENCY_MS;
 await new Promise<void>((resolve) => setTimeout(resolve, latency));
 const finishedAt = new Date();
 // In production this would call ffmpeg / COLMAP / OpenMVS / etc.
 return {
 artifacts: {},
 startedAt,
 finishedAt,
 };
 },
 describe() {
 return {
 name: `${stage}-stub`,
 // Mirror the ASL timeouts (decode=1800, sfm=3600, mesh=3600, segment=1800, align=1200).
 timeoutSeconds:
 stage === 'sfm' || stage === 'mesh' ? 3600
 : stage === 'decode' || stage === 'segment' ? 1800
 : 1200, // align
 };
 },
 };
}

export function allStageRunners(): Readonly<Record<Stage, StageRunner>> {
 return {
 decode: makeStubStageRunner('decode'),
 sfm: makeStubStageRunner('sfm'),
 mesh: makeStubStageRunner('mesh'),
 segment: makeStubStageRunner('segment'),
 align: makeStubStageRunner('align'),
 };
}

/**
 * Creates a StageState with attempt tracking. Pure — no I/O.
 */
export function newStageState(attempt = 0, status: StageState['status'] = 'idle'): StageState {
 return {
 status,
 attempt,
 startedAt: null,
 finishedAt: null,
 error: null,
 artifacts: null,
 };
}
