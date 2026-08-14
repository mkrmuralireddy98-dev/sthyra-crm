import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { computeBackoffMs, shouldRetry, MAX_ATTEMPTS } from './retry.js';

/**
 * Retry policy — pure functions.
 *
 * Per tasks.md T-019:
 *   - 3 attempts, exponential backoff
 *   - backoff = 2^n seconds (with jitter)
 *   - max backoff cap
 *
 * shouldRetry(attempt, lastError) returns:
 *   - 'retry' if the error is retryable AND attempt < MAX_ATTEMPTS
 *   - 'dlq' otherwise
 *
 * computeBackoffMs(attempt) returns the delay before the next attempt.
 */

describe('shouldRetry', () => {
 it('retries on transient errors (attempt 1)', () => {
 assert.equal(shouldRetry(1, { retryable: true }), 'retry');
 });

 it('retries on attempt 2 (last allowed)', () => {
 assert.equal(shouldRetry(2, { retryable: true }), 'retry');
 });

 it('routes to DLQ on attempt 3 (max exhausted)', () => {
 assert.equal(shouldRetry(3, { retryable: true }), 'dlq');
 });

 it('routes to DLQ immediately on non-retryable errors', () => {
 assert.equal(shouldRetry(1, { retryable: false }), 'dlq');
 });

 it('MAX_ATTEMPTS is 3 (Constitution §retry policy)', () => {
 assert.equal(MAX_ATTEMPTS, 3);
 });
});

describe('computeBackoffMs', () => {
 it('attempt 1 → ~1 second (with jitter, < 1500ms)', () => {
 const ms = computeBackoffMs(1);
 assert.ok(ms >= 1000, `got ${ms}ms`);
 assert.ok(ms <= 1500, `got ${ms}ms`);
 });

 it('attempt 2 → ~2 seconds (with jitter, 2000–3000ms)', () => {
 const ms = computeBackoffMs(2);
 assert.ok(ms >= 2000, `got ${ms}ms`);
 assert.ok(ms <= 3000, `got ${ms}ms`);
 });

 it('attempt 3 → would be ~4s but capped at MAX_BACKOFF_MS', () => {
 const ms = computeBackoffMs(3);
 assert.ok(ms >= 4000, `got ${ms}ms`);
 assert.ok(ms <= 5000, `got ${ms}ms`);
 });

 it('attempt 10 → still capped (no exponential runaway)', () => {
 const ms = computeBackoffMs(10);
 assert.ok(ms <= 5000, `got ${ms}ms`);
 });
});
