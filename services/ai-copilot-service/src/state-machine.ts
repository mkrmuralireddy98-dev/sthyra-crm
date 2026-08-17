/**
 * Conversation state machine — pure functional core.
 */

import type { ConversationState } from './types.js';

export interface ConversationStateMachineState {
 readonly state: ConversationState;
}

export type ConversationEvent =
 | { readonly type: 'archive' }
 | { readonly type: 'unarchive' };

const TRANSITIONS: Readonly<Record<ConversationState, readonly ConversationState[]>> = {
 active: ['archived'],
 archived: ['active'],
};

export function initialConversationState(): ConversationStateMachineState {
 return { state: 'active' };
}

export function canTransition(from: ConversationState, to: ConversationState): boolean {
 if (from === to) return false;
 return TRANSITIONS[from].includes(to);
}

export function transitionConversation(state: ConversationStateMachineState, event: ConversationEvent): ConversationStateMachineState {
 const nextState: ConversationState = event.type === 'archive' ? 'archived' : 'active';
 if (!canTransition(state.state, nextState)) {
 throw new Error(`invalid conversation transition: ${state.state} -> ${nextState}`);
 }
 return { state: nextState };
}
