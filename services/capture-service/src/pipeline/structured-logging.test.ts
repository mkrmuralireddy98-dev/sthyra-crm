import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Orchestrator } from './orchestrator.js';
import { initialState } from './state-machine.js';
import { allStageRunners } from './stages/index.js';

interface Logged {
 level: string;
 msg: string;
 fields: Record<string, unknown>;
}

/**
 * T-027 — Structured logging at every state transition.
 *
 * The orchestrator emits:
 *   - pipeline_stage_retry (warn) — transient error with retry=true
 *   - pipeline_stage_failed (error) — terminal failure (exhausted or non-retryable)
 *
 * The PipelineRunTracker emits:
 *   - pipeline_ready (info) — happy path terminal
 *   - pipeline_failed (error) — failure terminal
 */

describe('T-027 — Structured logging at state transitions', () => {
 it('does not log pipeline_stage_failed on happy path', async () => {
 const logged: Logged[] = [];
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: (level, msg, fields) => logged.push({ level, msg, fields }),
 dispatcher: async (state) => ({ type: 'stage-succeeded' as const, stage: state.currentStage! }),
 });
 await orch.run(initialState(), 'cap_001', 'org_a', 'prj_1');
 const failures = logged.filter((l) => l.msg === 'pipeline_stage_failed');
 assert.equal(failures.length, 0);
 });

 it('logs pipeline_stage_failed on terminal failure with full context', async () => {
 const logged: Logged[] = [];
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: (level, msg, fields) => logged.push({ level, msg, fields }),
 dispatcher: async (state) => {
 if (state.currentStage === 'sfm') {
 throw Object.assign(new Error('GLOMAP crash'), { retryable: false });
 }
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 await orch.run(initialState(), 'cap_002', 'org_a', 'prj_1');
 const failed = logged.find((l) => l.msg === 'pipeline_stage_failed');
 assert.ok(failed, 'pipeline_stage_failed log line expected');
 assert.equal(failed?.level, 'error');
 assert.equal(failed?.fields['captureId'], 'cap_002');
 assert.equal(failed?.fields['stage'], 'sfm');
 assert.match(failed?.fields['error']?.toString() ?? '', /GLOMAP/);
 });

 it('logs pipeline_stage_retry on transient errors', async () => {
 const logged: Logged[] = [];
 let sfmAttempts = 0;
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: (level, msg, fields) => logged.push({ level, msg, fields }),
 dispatcher: async (state) => {
 if (state.currentStage === 'sfm') {
 sfmAttempts++;
 if (sfmAttempts < 2) throw Object.assign(new Error('flaky'), { retryable: true });
 return { type: 'stage-succeeded' as const, stage: 'sfm' };
 }
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 computeBackoffMsOverride: () => 1,
 });
 await orch.run(initialState(), 'cap_003', 'org_a', 'prj_1');
 const retries = logged.filter((l) => l.msg === 'pipeline_stage_retry');
 assert.equal(retries.length, 1);
 assert.equal(retries[0]?.level, 'warn');
 assert.equal(retries[0]?.fields['stage'], 'sfm');
 });

 it('every orchestrator log entry has captureId field (Constitution §VI)', async () => {
 const logged: Logged[] = [];
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: (level, msg, fields) => logged.push({ level, msg, fields }),
 dispatcher: async (state) => {
 if (state.currentStage === 'sfm') {
 throw Object.assign(new Error('flaky'), { retryable: false });
 }
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 await orch.run(initialState(), 'cap_004', 'org_a', 'prj_1');
 for (const l of logged) {
 if (l.msg === 'pipeline_stage_failed' || l.msg === 'pipeline_stage_retry') {
 assert.ok(l.fields['captureId'], `${l.msg} must include captureId`);
 assert.ok(l.fields['orgId'], `${l.msg} must include orgId`);
 }
 }
 });
});
