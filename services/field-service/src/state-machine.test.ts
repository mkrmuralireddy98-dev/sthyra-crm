import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 initialStatusState,
 transitionStatus,
 canTransition,
 ISSUE_STATUSES,
 type IssueStatus,
 type StatusEvent,
} from './state-machine.js';

describe('IssueStatus — initial state', () => {
 it('starts every issue in the open status', () => {
 const s = initialStatusState();
 assert.equal(s.status, 'open');
 assert.equal(s.attempt, 0);
 });
});

describe('canTransition — pure validity check', () => {
 it('open → in_progress is allowed', () => {
 assert.equal(canTransition('open', 'in_progress'), true);
 });
 it('open → resolved is allowed', () => {
 assert.equal(canTransition('open', 'resolved'), true);
 });
 it('open → wont_fix is allowed', () => {
 assert.equal(canTransition('open', 'wont_fix'), true);
 });
 it('in_progress → resolved is allowed', () => {
 assert.equal(canTransition('in_progress', 'resolved'), true);
 });
 it('in_progress → wont_fix is allowed', () => {
 assert.equal(canTransition('in_progress', 'wont_fix'), true);
 });
 it('in_progress → open is NOT allowed (must go via resolve+reopen)', () => {
 assert.equal(canTransition('in_progress', 'open'), false);
 });
 it('resolved → open is allowed (reopen)', () => {
 assert.equal(canTransition('resolved', 'open'), true);
 });
 it('wont_fix → open is allowed (reopen)', () => {
 assert.equal(canTransition('wont_fix', 'open'), true);
 });
 it('resolved → in_progress is NOT allowed (no going back to in_progress)', () => {
 assert.equal(canTransition('resolved', 'in_progress'), false);
 });
 it('wont_fix → in_progress is NOT allowed', () => {
 assert.equal(canTransition('wont_fix', 'in_progress'), false);
 });
 it('every status transition to itself is rejected (use no-op or reopen)', () => {
 for (const s of ISSUE_STATUSES) {
 assert.equal(canTransition(s, s), false, `self-transition ${s} should be rejected`);
 }
 });
});

describe('transitionStatus — happy paths', () => {
 it('open → in_progress: claim sets actorId and attempt', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'claim', actorId: 'user_1' });
 assert.equal(s1.status, 'in_progress');
 assert.equal(s1.actorId, 'user_1');
 assert.equal(s1.attempt, 1);
 });

 it('open → resolved: resolve sets resolvedAt + reason', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'resolve', actorId: 'user_1', reason: 'fixed' });
 assert.equal(s1.status, 'resolved');
 assert.equal(s1.actorId, 'user_1');
 assert.equal(s1.reason, 'fixed');
 assert.ok(s1.resolvedAt instanceof Date);
 });

 it('in_progress → resolved transitions correctly', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'claim', actorId: 'u' });
 const s2 = transitionStatus(s1, { type: 'resolve', actorId: 'u', reason: 'done' });
 assert.equal(s2.status, 'resolved');
 });

 it('resolved → open via reopen clears resolvedAt', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'resolve', actorId: 'u', reason: 'fixed' });
 const s2 = transitionStatus(s1, { type: 'reopen', actorId: 'u', reason: 'reopened for QA' });
 assert.equal(s2.status, 'open');
 assert.equal(s2.resolvedAt, null);
 assert.equal(s2.reason, 'reopened for QA');
 });

 it('wont_fix → open via reopen', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'wont_fix', actorId: 'u', reason: 'out of scope' });
 const s2 = transitionStatus(s1, { type: 'reopen', actorId: 'u', reason: 'second look' });
 assert.equal(s2.status, 'open');
 });
});

describe('transitionStatus — invalid transitions throw', () => {
 it('self-transition throws (e.g. already in_progress + claim)', () => {
 // Get to in_progress first (valid transition)
 const s0 = transitionStatus(initialStatusState(), { type: 'claim', actorId: 'u' });
 // Now try claim again — in_progress + claim = in_progress (self-transition)
 assert.throws(() => transitionStatus(s0, { type: 'claim', actorId: 'u' }));
 });

 it('resolved → resolved throws (no idempotent self-transition)', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'resolve', actorId: 'u', reason: 'r' });
 assert.throws(() => transitionStatus(s1, { type: 'resolve', actorId: 'u', reason: 'r2' }));
 });

 it('in_progress → open (must go via resolve+reopen) throws', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'claim', actorId: 'u' });
 assert.throws(() => transitionStatus(s1, { type: 'reopen', actorId: 'u', reason: 'x' }));
 });

 it('unknown event type throws', () => {
 const s0 = initialStatusState();
 assert.throws(() => transitionStatus(s0, { type: 'unknown' as 'claim', actorId: 'u' }));
 });
});

describe('transitionStatus — immutability', () => {
 it('returns a NEW state object (does not mutate input)', () => {
 const s0 = initialStatusState();
 const before = JSON.stringify(s0);
 const s1 = transitionStatus(s0, { type: 'claim', actorId: 'u' });
 const after = JSON.stringify(s0);
 assert.equal(before, after);
 assert.notEqual(s0, s1);
 });

 it('attempt increments on retry path (future-state for retry support)', () => {
 const s0 = initialStatusState();
 const s1 = transitionStatus(s0, { type: 'claim', actorId: 'u', retry: true });
 assert.equal(s1.status, 'in_progress');
 assert.equal(s1.attempt, 1);
 });
});

describe('IssueStatus — all 5 values documented', () => {
 it('ISSUE_STATUSES has exactly 5 values', () => {
 assert.equal(ISSUE_STATUSES.length, 5);
 assert.deepEqual([...ISSUE_STATUSES].sort(), ['closed', 'in_progress', 'open', 'resolved', 'wont_fix']);
 });
});
