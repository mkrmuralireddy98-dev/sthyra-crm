import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { Orchestrator } from './orchestrator.js';
import { initialState, transition, type PipelineState } from './state-machine.js';
import { computeBackoffMs } from './retry.js';
import { allStageRunners } from './stages/index.js';

describe('Orchestrator — wiring', () => {
 let dispatched: string[];
 let orchestrator: Orchestrator;

 beforeEach(() => {
 dispatched = [];
 orchestrator = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: () => {},
 // Track dispatch instead of actually awaiting the stage
 dispatcher: async (state) => {
 if (state.currentStage) dispatched.push(state.currentStage);
 // Immediately mark succeeded so the orchestrator advances.
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 });

 it('runs the full pipeline through all 5 stages', async () => {
 const final = await orchestrator.run(initialState(), 'cap_001', 'org_a', 'prj_1');
 assert.equal(final.pipelineStatus, 'ready');
 assert.deepEqual(dispatched, ['decode', 'sfm', 'mesh', 'segment', 'align']);
 });

 it('returns the final state on success', async () => {
 const final = await orchestrator.run(initialState(), 'cap_002', 'org_a', 'prj_1');
 assert.equal(final.pipelineStatus, 'ready');
 });

 it('stops on failure (does not dispatch subsequent stages)', async () => {
 const failOnSfm = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: () => {},
 dispatcher: async (state) => {
 if (state.currentStage) dispatched.push(state.currentStage);
 if (state.currentStage === 'sfm') {
 throw Object.assign(new Error('GLOMAP exit 1'), { retryable: false });
 }
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 const final = await failOnSfm.run(initialState(), 'cap_003', 'org_a', 'prj_1');
 assert.equal(final.pipelineStatus, 'failed');
 assert.deepEqual(dispatched, ['decode', 'sfm']); // mesh, segment, align NOT dispatched
 assert.equal(final.stages.sfm.error, 'GLOMAP exit 1');
 });

 it('retries on transient errors up to MAX_ATTEMPTS', async () => {
 let sfmAttempts = 0;
 const retrying = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: () => {},
 dispatcher: async (state) => {
 if (state.currentStage === 'sfm') {
 sfmAttempts++;
 if (sfmAttempts < 3) throw Object.assign(new Error('transient'), { retryable: true });
 return { type: 'stage-succeeded' as const, stage: 'sfm' };
 }
 if (state.currentStage) dispatched.push(state.currentStage);
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 const final = await retrying.run(initialState(), 'cap_004', 'org_a', 'prj_1');
 assert.equal(final.pipelineStatus, 'ready');
 assert.equal(sfmAttempts, 3); // 2 retries + 1 success
 });

 it('routes to DLQ after retry budget exhausted', async () => {
 let sfmAttempts = 0;
 const dlqEntries: string[] = [];
 const orchWithDlq = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async (state, captureId) => { dlqEntries.push(captureId); } },
 logger: () => {},
 dispatcher: async (state) => {
 if (state.currentStage === 'sfm') {
 sfmAttempts++;
 throw Object.assign(new Error('always fails'), { retryable: true });
 }
 if (state.currentStage) dispatched.push(state.currentStage);
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 const final = await orchWithDlq.run(initialState(), 'cap_005', 'org_a', 'prj_1');
 assert.equal(final.pipelineStatus, 'failed');
 assert.equal(sfmAttempts, 3); // retried MAX_ATTEMPTS times
 assert.deepEqual(dlqEntries, ['cap_005']);
 });

 it('respects the retry policy from retry.ts (3 attempts, exp backoff)', async () => {
 // Smoke test that the orchestrator's retry counter matches retry.MAX_ATTEMPTS
 let attempts = 0;
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: () => {},
 dispatcher: async (state) => {
 attempts++;
 throw Object.assign(new Error('boom'), { retryable: true });
 },
 });
 await orch.run(initialState(), 'cap_006', 'org_a', 'prj_1');
 assert.equal(attempts, 3);
 });

 it('honors backoff between retries (does not hammer)', async () => {
 const timestamps: number[] = [];
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: () => {},
 dispatcher: async (state) => {
 timestamps.push(Date.now());
 throw Object.assign(new Error('transient'), { retryable: true });
 },
 // Override the default computeBackoffMs to a deterministic value
 computeBackoffMsOverride: (attempt) => 50 * attempt,
 });
 await orch.run(initialState(), 'cap_007', 'org_a', 'prj_1');
 // Three attempts → at least two backoffs, each ≥ 50ms and 100ms.
 assert.equal(timestamps.length, 3);
 const gap1 = timestamps[1]! - timestamps[0]!;
 const gap2 = timestamps[2]! - timestamps[1]!;
 assert.ok(gap1 >= 40 && gap1 < 500, `gap1 = ${gap1}ms`);
 assert.ok(gap2 >= 80 && gap2 < 500, `gap2 = ${gap2}ms`);
 });

 it('emits capture.failed event when the pipeline fails', async () => {
 const events: string[] = [];
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: () => {},
 onEvent: (e) => events.push(e.type),
 dispatcher: async (state) => {
 if (state.currentStage === 'sfm') {
 throw Object.assign(new Error('boom'), { retryable: false });
 }
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 await orch.run(initialState(), 'cap_008', 'org_a', 'prj_1');
 assert.ok(events.includes('capture.failed'));
 });

 it('emits capture.uploaded event when the pipeline succeeds', async () => {
 const events: string[] = [];
 const orch = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async () => {} },
 logger: () => {},
 onEvent: (e) => events.push(e.type),
 dispatcher: async (state) => ({ type: 'stage-succeeded' as const, stage: state.currentStage! }),
 });
 await orch.run(initialState(), 'cap_009', 'org_a', 'prj_1');
 assert.ok(events.includes('capture.uploaded'));
 });
});
