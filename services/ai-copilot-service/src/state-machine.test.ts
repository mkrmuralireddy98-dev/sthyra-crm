import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 initialConversationState,
 transitionConversation,
 canTransition,
} from './state-machine.js';

describe('Conversation state machine (T-009)', () => {
 it('initial state is active', () => {
 const s = initialConversationState();
 assert.equal(s.state, 'active');
 });

 it('active → archived via archive event', () => {
 const s = transitionConversation(initialConversationState(), { type: 'archive' });
 assert.equal(s.state, 'archived');
 });

 it('archived → active via unarchive event', () => {
 const s0 = transitionConversation(initialConversationState(), { type: 'archive' });
 const s1 = transitionConversation(s0, { type: 'unarchive' });
 assert.equal(s1.state, 'active');
 });

 it('throws on invalid transition (archive when already archived)', () => {
 const s0 = transitionConversation(initialConversationState(), { type: 'archive' });
 assert.throws(() => transitionConversation(s0, { type: 'archive' }));
 });

 it('canTransition correctly gates transitions', () => {
 assert.equal(canTransition('active', 'archived'), true);
 assert.equal(canTransition('archived', 'active'), true);
 assert.equal(canTransition('active', 'active'), false);
 assert.equal(canTransition('archived', 'archived'), false);
 });

 it('returns new state object (immutability)', () => {
 const s0 = initialConversationState();
 const s1 = transitionConversation(s0, { type: 'archive' });
 assert.notEqual(s0, s1);
 });
});
