import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 initialState,
 transition,
 nextStage,
 isTerminal,
 type PipelineState,
 type Stage,
 type StageStatus,
 STAGES_IN_ORDER,
} from './state-machine.js';

/**
 * Pipeline state machine — pure function.
 *
 * State = stage name + per-stage status (idle | running | succeeded | failed | skipped).
 * Transition: given a state and an event, returns the next state.
 *
 * Invariants:
 *   - States are immutable. transition() returns a NEW state object.
 *   - Invalid transitions throw (e.g., 'succeeded' → 'running').
 *   - Stages run in fixed order: decode → sfm → mesh → segment → align.
 *   - Any stage's failure short-circuits to 'failed' (whole pipeline).
 */

describe('initialState', () => {
 it('starts every stage as idle', () => {
 const s = initialState();
 for (const stage of STAGES_IN_ORDER) {
 assert.equal(s.stages[stage].status, 'idle');
 }
 });

 it('has currentStage = decode (first stage)', () => {
 const s = initialState();
 assert.equal(s.currentStage, 'decode');
 });

 it('has pipelineStatus = pending', () => {
 const s = initialState();
 assert.equal(s.pipelineStatus, 'pending');
 });
});

describe('nextStage', () => {
 it('returns sfm after decode', () => {
 assert.equal(nextStage('decode'), 'sfm');
 });
 it('returns mesh after sfm', () => {
 assert.equal(nextStage('sfm'), 'mesh');
 });
 it('returns segment after mesh', () => {
 assert.equal(nextStage('mesh'), 'segment');
 });
 it('returns align after segment', () => {
 assert.equal(nextStage('segment'), 'align');
 });
 it('returns null after align (terminal stage)', () => {
 assert.equal(nextStage('align'), null);
 });
});

describe('isTerminal', () => {
 it('returns true when pipelineStatus = ready', () => {
 const s: PipelineState = { ...initialState(), pipelineStatus: 'ready' };
 assert.equal(isTerminal(s), true);
 });
 it('returns true when pipelineStatus = failed', () => {
 const s: PipelineState = { ...initialState(), pipelineStatus: 'failed' };
 assert.equal(isTerminal(s), true);
 });
 it('returns true when pipelineStatus = archived', () => {
 const s: PipelineState = { ...initialState(), pipelineStatus: 'archived' };
 assert.equal(isTerminal(s), true);
 });
 it('returns false when pipelineStatus = pending', () => {
 assert.equal(isTerminal(initialState()), false);
 });
 it('returns false when pipelineStatus = processing', () => {
 const s: PipelineState = { ...initialState(), pipelineStatus: 'processing' };
 assert.equal(isTerminal(s), false);
 });
});

describe('transition — happy path', () => {
 it('start moves decode from idle to running', () => {
 const s = initialState();
 const next = transition(s, { type: 'start' });
 assert.equal(next.stages.decode.status, 'running');
 assert.equal(next.pipelineStatus, 'processing');
 assert.equal(next.currentStage, 'decode');
 });

 it('stage-succeeded on decode advances currentStage to sfm', () => {
 const s: PipelineState = {
 ...initialState(),
 stages: { ...initialState().stages, decode: { status: 'running', attempt: 1, startedAt: new Date() } },
 pipelineStatus: 'processing',
 currentStage: 'decode',
 };
 const next = transition(s, { type: 'stage-succeeded', stage: 'decode' });
 assert.equal(next.stages.decode.status, 'succeeded');
 assert.equal(next.currentStage, 'sfm');
 assert.equal(next.pipelineStatus, 'processing');
 });

 it('stage-succeeded on align (final stage) → pipeline ready', () => {
 let s = initialState();
 s = { ...s, pipelineStatus: 'processing', currentStage: 'align', stages: { ...s.stages, align: { status: 'running', attempt: 1, startedAt: new Date() } } };
 const next = transition(s, { type: 'stage-succeeded', stage: 'align' });
 assert.equal(next.stages.align.status, 'succeeded');
 assert.equal(next.pipelineStatus, 'ready');
 assert.equal(next.currentStage, 'align'); // stays at the terminal stage
 });
});

describe('transition — failure path', () => {
 it('stage-failed short-circuits the pipeline to failed', () => {
 let s = initialState();
 s = { ...s, pipelineStatus: 'processing', currentStage: 'sfm', stages: { ...s.stages, sfm: { status: 'running', attempt: 1, startedAt: new Date() } } };
 const next = transition(s, { type: 'stage-failed', stage: 'sfm', error: 'GLOMAP exit 1' });
 assert.equal(next.stages.sfm.status, 'failed');
 assert.equal(next.stages.sfm.error, 'GLOMAP exit 1');
 assert.equal(next.pipelineStatus, 'failed');
 });

 it('stage-failed on align (final stage) → pipeline failed', () => {
 let s = initialState();
 s = { ...s, pipelineStatus: 'processing', currentStage: 'align', stages: { ...s.stages, align: { status: 'running', attempt: 1, startedAt: new Date() } } };
 const next = transition(s, { type: 'stage-failed', stage: 'align', error: 'ICP convergence' });
 assert.equal(next.pipelineStatus, 'failed');
 });
});

describe('transition — retry path', () => {
 it('stage-failed increments attempt and re-marks running (Constitution §retry policy)', () => {
 let s = initialState();
 s = { ...s, pipelineStatus: 'processing', currentStage: 'sfm', stages: { ...s.stages, sfm: { status: 'running', attempt: 1, startedAt: new Date() } } };
 const next = transition(s, { type: 'stage-failed', stage: 'sfm', error: 'transient', retry: true });
 assert.equal(next.stages.sfm.status, 'running'); // not failed — we retry
 assert.equal(next.stages.sfm.attempt, 2);
 assert.equal(next.pipelineStatus, 'processing'); // pipeline still running
 });

 it('stage-failed WITHOUT retry → short-circuit (per failure-path test)', () => {
 let s = initialState();
 s = { ...s, pipelineStatus: 'processing', currentStage: 'sfm', stages: { ...s.stages, sfm: { status: 'running', attempt: 3, startedAt: new Date() } } };
 const next = transition(s, { type: 'stage-failed', stage: 'sfm', error: 'exhausted' });
 assert.equal(next.stages.sfm.status, 'failed');
 assert.equal(next.pipelineStatus, 'failed');
 });
});

describe('transition — invalid events', () => {
 it('start twice throws', () => {
 const s = initialState();
 const started = transition(s, { type: 'start' });
 assert.throws(() => transition(started, { type: 'start' }), /invalid transition/i);
 });

 it('stage-succeeded on idle stage throws', () => {
 const s = initialState();
 assert.throws(() => transition(s, { type: 'stage-succeeded', stage: 'sfm' }), /not running/i);
 });

 it('stage-succeeded on wrong stage (not currentStage) throws', () => {
 let s = initialState();
 s = { ...s, pipelineStatus: 'processing', currentStage: 'decode', stages: { ...s.stages, decode: { status: 'running', attempt: 1, startedAt: new Date() } } };
 assert.throws(() => transition(s, { type: 'stage-succeeded', stage: 'mesh' }), /not current stage/i);
 });

 it('stage-failed on succeeded stage throws (cannot fail what is done)', () => {
 let s = initialState();
 s = { ...s, stages: { ...s.stages, decode: { status: 'succeeded', attempt: 1, startedAt: new Date(), finishedAt: new Date() } }, pipelineStatus: 'processing', currentStage: 'sfm' };
 assert.throws(() => transition(s, { type: 'stage-failed', stage: 'decode', error: 'late failure' }), /not running/i);
 });

 it('returns a NEW state object (immutability)', () => {
 const s = initialState();
 const next = transition(s, { type: 'start' });
 assert.notEqual(next, s);
 assert.notEqual(next.stages.decode, s.stages.decode);
 });
});

describe('STAGES_IN_ORDER — fixed execution order', () => {
 it('lists 5 stages in canonical order', () => {
 assert.deepEqual(STAGES_IN_ORDER, ['decode', 'sfm', 'mesh', 'segment', 'align']);
 });
});
