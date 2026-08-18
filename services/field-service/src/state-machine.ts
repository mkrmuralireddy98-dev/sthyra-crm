/**
 * IssueStatus state machine — pure functional core.
 *
 * Mirrors the pipeline state machine pattern from capture-service:
 *   - Pure function, no I/O
 *   - Returns new state object (immutable)
 *   - Throws on invalid transitions
 *
 * The transitions matrix (spec §clarifications Q4):
 *
 * open --claim--> in_progress
 * open --resolve--> resolved
 * open --wont-fix--> wont_fix
 * in_progress --resolve--> resolved
 * in_progress --wont-fix--> wont_fix
 * resolved --reopen--> open
 * resolved --close--> closed (Phase 7 inspect pass; terminal)
 * wont_fix --reopen--> open
 *
 * Invalid: any self-transition, in_progress → open (must resolve first),
 * resolved/wont_fix → in_progress (terminal-like, must reopen).
 */

import type { IssueStatus } from './types.js';

export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'wont_fix'] as const;
export type { IssueStatus };

export interface StatusState {
 readonly status: IssueStatus;
 readonly actorId: string | null;
 readonly reason: string | null;
 readonly resolvedAt: Date | null;
 readonly closedAt: Date | null;
 readonly attempt: number;
}

export type StatusEvent =
 | { readonly type: 'claim'; readonly actorId: string; readonly retry?: boolean }
 | { readonly type: 'resolve'; readonly actorId: string; readonly reason: string }
 | { readonly type: 'wont_fix'; readonly actorId: string; readonly reason: string }
 | { readonly type: 'reopen'; readonly actorId: string; readonly reason: string }
 | { readonly type: 'close'; readonly actorId: string };

const TRANSITIONS: Readonly<Record<IssueStatus, readonly IssueStatus[]>> = {
 open: ['in_progress', 'resolved', 'wont_fix'],
 in_progress: ['resolved', 'wont_fix'],
 resolved: ['open', 'closed'],
 closed: [],
 wont_fix: ['open'],
};

export function initialStatusState(): StatusState {
 return {
 status: 'open',
 actorId: null,
 reason: null,
 resolvedAt: null,
 attempt: 0,
 };
}

/**
 * Pure check: is the transition from→to allowed by the matrix?
 */
export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
 if (from === to) return false;
 return TRANSITIONS[from].includes(to);
}

/**
 * Apply a status event to a state. Returns a NEW state. Throws on invalid.
 */
export function transitionStatus(state: StatusState, event: StatusEvent): StatusState {
 const now = new Date();
 const nextStatus = ((): IssueStatus => {
 switch (event.type) {
 case 'claim':
 return 'in_progress';
 case 'resolve':
 return 'resolved';
 case 'wont_fix':
 return 'wont_fix';
 case 'reopen':
 return 'open';
 case 'close':
 return 'closed';
 }
 })();

 if (!canTransition(state.status, nextStatus)) {
 throw new Error(
 `invalid transition: ${state.status} → ${nextStatus} via ${event.type}`,
 );
 }

 // Claim (retry) increments attempt; everything else stays at 1.
 const nextAttempt = event.type === 'claim' ? state.attempt + 1 : 1;

 return {
 status: nextStatus,
 actorId: event.actorId,
 reason: event.type === 'claim' ? null : event.reason ?? null,
 resolvedAt: nextStatus === 'resolved' ? now : null,
 closedAt: nextStatus === 'closed' ? now : null,
 attempt: nextAttempt,
 };
}
