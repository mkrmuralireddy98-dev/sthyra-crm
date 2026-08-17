import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { CaptureService } from '../service.js';
import { InMemoryCaptureRepository, InMemoryIdempotencyStore } from '../repo-memory.js';
import { Orchestrator } from './orchestrator.js';
import { allStageRunners } from './stages/index.js';
import { InMemoryEventBus } from '../realtime/index.js';

/**
 * T-029 / T-030 — E2E tests for the full pipeline.
 *
 * T-029 (happy path):
 *   POST capture → finalize → orchestrator.run → ready
 *
 * T-030 (failure path):
 *   POST capture → finalize → orchestrator.run (sfm fails) → DLQ entry
 */

describe('E2E — full pipeline happy path (T-029)', () => {
 it('capture.create → finalize → orchestrator → ready', async () => {
 const repo = new InMemoryCaptureRepository();
 const idempotency = new InMemoryIdempotencyStore();
 const bus = new InMemoryEventBus();
 const events: string[] = [];
 const dlqEntries: { captureId: string; error: string }[] = [];

 const service = new CaptureService({
 repo,
 idempotency,
 onEvent: (e) => { events.push(e.type); void bus.publish(e); },
 });

 // 1. Create capture
 const create = await service.create('org_a', 'prj_1', 'idem-e2e-1', {
 orgId: 'org_a',
 projectId: 'prj_1',
 clientCaptureId: 'cli-e2e-1',
 kind: 'walkthrough_360',
 });
 const { capture, uploadSession } = create;
 assert.equal(capture.status, 'uploading');

 // 2. Finalize (sha256 verification)
 const finalized = await service.finalize('org_a', uploadSession.id, 'sha256-abc-xyz');
 assert.equal(finalized.status, 'processing');

 // 3. Run orchestrator
 const orchestrator = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: { record: async (_state, captureId) => { dlqEntries.push({ captureId, error: 'never' }); } },
 logger: () => {},
 dispatcher: async (state) => ({ type: 'stage-succeeded' as const, stage: state.currentStage! }),
 });
 const final = await orchestrator.run(service['initialStateForTest' as never] ?? (await import('./state-machine.js')).initialState(), capture.id, 'org_a', 'prj_1');

 assert.equal(final.pipelineStatus, 'ready');
 assert.equal(events.includes('capture.initiated'), true);
 assert.equal(events.includes('capture.uploaded'), true);
 assert.equal(dlqEntries.length, 0);
 });

 it('CaptureService exposes the create/finalize lifecycle end-to-end', async () => {
 const repo = new InMemoryCaptureRepository();
 const idempotency = new InMemoryIdempotencyStore();
 const service = new CaptureService({ repo, idempotency });

 const result = await service.create('org_a', 'prj_1', 'idem-e2e-2', {
 orgId: 'org_a', projectId: 'prj_1', clientCaptureId: 'cli-e2e-2', kind: 'walkthrough_360',
 });

 // Record some chunks
 await service.recordChunkReceived('org_a', result.uploadSession.id, 0);
 await service.recordChunkReceived('org_a', result.uploadSession.id, 1);
 await service.recordChunkReceived('org_a', result.uploadSession.id, 2);

 // Finalize
 const finalized = await service.finalize('org_a', result.uploadSession.id, 'sha256-final');
 assert.equal(finalized.status, 'processing');

 // Verify the capture transitioned
 const updated = await service.find('org_a', result.capture.id);
 assert.equal(updated?.status, 'processing');
 });
});

describe('E2E — failure path (T-030)', () => {
 it('failed pipeline writes a DLQ entry', async () => {
 const repo = new InMemoryCaptureRepository();
 const idempotency = new InMemoryIdempotencyStore();
 const bus = new InMemoryEventBus();
 const service = new CaptureService({
 repo,
 idempotency,
 onEvent: (e) => { void bus.publish(e); },
 });

 const create = await service.create('org_a', 'prj_1', 'idem-e2e-fail', {
 orgId: 'org_a', projectId: 'prj_1', clientCaptureId: 'cli-e2e-fail', kind: 'walkthrough_360',
 });
 await service.finalize('org_a', create.uploadSession.id, 'sha256');

 const dlqEntries: { captureId: string; stage: string; error: string }[] = [];
 const events: string[] = [];
 const orchestrator = new Orchestrator({
 runners: allStageRunners(),
 tracker: { record: async () => {} },
 dlq: {
 record: async (state, captureId) => {
 const stage = Object.entries(state.stages).find(([_k, v]) => v.status === 'failed')?.[0] ?? 'unknown';
 const err = Object.entries(state.stages).find(([_k, v]) => v.status === 'failed')?.[1].error ?? 'unknown';
 dlqEntries.push({ captureId, stage, error: err });
 },
 },
 logger: () => {},
 onEvent: (e) => { events.push(e.type); },
 dispatcher: async (state) => {
 if (state.currentStage === 'sfm') {
 throw Object.assign(new Error('GLOMAP out of memory'), { retryable: false });
 }
 return { type: 'stage-succeeded' as const, stage: state.currentStage! };
 },
 });
 const sm = await import('./state-machine.js');
 const final = await orchestrator.run(sm.initialState(), create.capture.id, 'org_a', 'prj_1');

 assert.equal(final.pipelineStatus, 'failed');
 assert.equal(dlqEntries.length, 1);
 assert.equal(dlqEntries[0]?.captureId, create.capture.id);
 assert.equal(dlqEntries[0]?.stage, 'sfm');
 assert.match(dlqEntries[0]?.error ?? '', /GLOMAP/);
 assert.ok(events.includes('capture.failed'));
 });
});
