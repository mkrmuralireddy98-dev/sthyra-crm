/**
 * Retry policy — pure functions for the spatial-AI pipeline.
 *
 * Per tasks.md T-019 + spec-kit plan.md §retry policy:
 *   - 3 attempts max
 *   - Exponential backoff: 2^attempt seconds (1000ms, 2000ms, 4000ms, ...)
 *   - Jitter: ±25% to avoid thundering herd on shared dependencies
 *   - Cap at MAX_BACKOFF_MS = 5000ms
 *   - Retry only on 'retryable' errors. Permanent errors (validation,
 *     schema mismatch) go straight to DLQ.
 *
 * Pure functions — no I/O, no Date.now(). Trivially testable.
 */

export const MAX_ATTEMPTS = 3;
export const MAX_BACKOFF_MS = 5000;

export interface RetryDecision {
 /** Whether the error is transient and worth retrying. */
 readonly retryable: boolean;
 /** Optional human-readable reason (for logs). */
 readonly reason?: string;
}

export type RetryOutcome = 'retry' | 'dlq';

export function shouldRetry(attempt: number, decision: RetryDecision): RetryOutcome {
 if (!decision.retryable) return 'dlq';
 if (attempt >= MAX_ATTEMPTS) return 'dlq';
 return 'retry';
}

/**
 * Returns the backoff delay in milliseconds before the next attempt.
 * attempt is 1-indexed (1 = first retry, 2 = second, ...).
 *
 *   attempt=1: 1000ms (with jitter: 1000–1250ms)
 *   attempt=2: 2000ms (with jitter: 2000–2500ms)
 *   attempt=3: 4000ms (with jitter: 4000–5000ms — cap kicks in)
 *   attempt=N: capped at MAX_BACKOFF_MS
 */
export function computeBackoffMs(attempt: number): number {
 const base = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s, ...
 const jitter = base * 0.25 * Math.random(); // ±25%
 const withJitter = base + jitter;
 return Math.min(MAX_BACKOFF_MS, Math.round(withJitter));
}
