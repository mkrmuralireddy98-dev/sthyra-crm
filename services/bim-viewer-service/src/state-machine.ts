/**
 * BimModelStatus state machine — pure functional core.
 *
 * Mirrors field-service/state-machine.ts: pure function, immutable,
 * throws on invalid transitions.
 */

import type { BimModelState } from './types.js';
import { BIM_MODEL_STATES } from './types.js';

export interface BimStatusState {
 readonly state: BimModelState;
 readonly attempt: number;
}

export type BimStatusEvent =
 | { readonly type: 'start_upload' }
 | { readonly type: 'validate' }
 | { readonly type: 'ready' }
 | { readonly type: 'align' }
 | { readonly type: 'diff' }
 | { readonly type: 'fail' };

const TRANSITIONS: Readonly<Record<BimModelState, readonly BimModelState[]>> = {
 new: ['uploading'],
 uploading: ['validating', 'failed'],
 validating: ['ready', 'failed'],
 ready: ['aligned', 'failed'],
 aligned: ['diffed', 'failed'],
 diffed: [],
 failed: [],
};

export function initialBimState(): BimStatusState {
 return { state: 'new', attempt: 0 };
}

export function canTransitionBim(from: BimModelState, to: BimModelState): boolean {
 if (from === to) return false;
 return TRANSITIONS[from].includes(to);
}

export function transitionBim(state: BimStatusState, event: BimStatusEvent): BimStatusState {
 const nextState = ((): BimModelState => {
 switch (event.type) {
 case 'start_upload': return 'uploading';
 case 'validate': return 'validating';
 case 'ready': return 'ready';
 case 'align': return 'aligned';
 case 'diff': return 'diffed';
 case 'fail': return 'failed';
 }
 })();

 if (!canTransitionBim(state.state, nextState)) {
 throw new Error(`invalid bim transition: ${state.state} → ${nextState} via ${event.type}`);
 }

 return { state: nextState, attempt: state.attempt + 1 };
}

export { BIM_MODEL_STATES };
