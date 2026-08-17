import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 initialBimState,
 transitionBim,
 canTransitionBim,
 BIM_MODEL_STATES,
 type BimModelState,
} from './state-machine.js';

describe('BimModelStatus state machine (T-008)', () => {
 it('initial state is new', () => {
 const s = initialBimState();
 assert.equal(s.state, 'new');
 assert.equal(s.attempt, 0);
 });

 it('new → uploading via start_upload', () => {
 const s = transitionBim(initialBimState(), { type: 'start_upload' });
 assert.equal(s.state, 'uploading');
 });

 it('uploading → validating via validate', () => {
 const s0 = transitionBim(initialBimState(), { type: 'start_upload' });
 const s1 = transitionBim(s0, { type: 'validate' });
 assert.equal(s1.state, 'validating');
 });

 it('validating → ready via ready', () => {
 const s0 = transitionBim(initialBimState(), { type: 'start_upload' });
 const s1 = transitionBim(s0, { type: 'validate' });
 const s2 = transitionBim(s1, { type: 'ready' });
 assert.equal(s2.state, 'ready');
 });

 it('ready → aligned via align', () => {
 let s = initialBimState();
 s = transitionBim(s, { type: 'start_upload' });
 s = transitionBim(s, { type: 'validate' });
 s = transitionBim(s, { type: 'ready' });
 s = transitionBim(s, { type: 'align' });
 assert.equal(s.state, 'aligned');
 });

 it('aligned → diffed via diff', () => {
 let s = initialBimState();
 s = transitionBim(s, { type: 'start_upload' });
 s = transitionBim(s, { type: 'validate' });
 s = transitionBim(s, { type: 'ready' });
 s = transitionBim(s, { type: 'align' });
 s = transitionBim(s, { type: 'diff' });
 assert.equal(s.state, 'diffed');
 });

 it('any state → failed via fail', () => {
 const s0 = transitionBim(initialBimState(), { type: 'start_upload' });
 const s1 = transitionBim(s0, { type: 'fail' });
 assert.equal(s1.state, 'failed');
 });

 it('diffed is terminal (no transitions out)', () => {
 const failedTransitions: BimModelState[] = ['new', 'uploading', 'validating', 'ready', 'aligned', 'diffed'];
 for (const t of failedTransitions) {
 assert.equal(canTransitionBim('diffed', t), false, `diffed should not transition to ${t}`);
 }
 });

 it('failed is terminal (no transitions out)', () => {
 for (const t of BIM_MODEL_STATES) {
 if (t === 'failed') continue;
 assert.equal(canTransitionBim('failed', t), false);
 }
 });

 it('transition is immutable (returns new state)', () => {
 const s0 = initialBimState();
 const before = JSON.stringify(s0);
 const s1 = transitionBim(s0, { type: 'start_upload' });
 assert.equal(JSON.stringify(s0), before);
 assert.notEqual(s0, s1);
 });

 it('attempt increments per transition', () => {
 let s = initialBimState();
 s = transitionBim(s, { type: 'start_upload' });
 assert.equal(s.attempt, 1);
 s = transitionBim(s, { type: 'validate' });
 assert.equal(s.attempt, 2);
 });

 it('throws on invalid transition (e.g., new → ready)', () => {
 assert.throws(
 () => transitionBim(initialBimState(), { type: 'ready' }),
 /invalid bim transition/,
 );
 });
});
