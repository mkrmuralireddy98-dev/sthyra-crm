/**
 * Outbox dispatcher — drains the event_outbox table and publishes events
 * to the EventBus (and Phase 1.b: Redis pub/sub for multi-instance).
 *
 * The dispatcher is a polling loop:
 *   1. SELECT unpublished events with FOR UPDATE SKIP LOCKED (multi-instance safe)
 *   2. Publish each via the sink
 *   3. UPDATE published=true in a transaction
 *
 * If the sink throws, the row is NOT marked published — it will be retried
 * on the next poll. This guarantees at-least-once delivery.
 */

import type { PgClient } from './postgres-repo.js';

export interface OutboxRow {
 readonly id: number;
 readonly event_type: string;
 readonly capture_id: string;
 readonly org_id: string;
 readonly project_id: string;
 readonly payload: Record<string, unknown>;
 readonly published: boolean;
 readonly created_at: Date;
}

export type OutboxSink = (row: OutboxRow) => Promise<void>;

export interface OutboxLogger {
 (level: 'error' | 'warn' | 'info', msg: string, fields: Record<string, unknown>): void;
}

export interface OutboxDispatcherDeps {
 readonly pg: PgClient;
 readonly sink: OutboxSink;
 readonly pollIntervalMs?: number;
 readonly logger?: OutboxLogger;
 readonly batchSize?: number;
}

export class OutboxDispatcher {
 private readonly pg: PgClient;
 private readonly sink: OutboxSink;
 private readonly pollIntervalMs: number;
 private readonly logger: OutboxLogger;
 private readonly batchSize: number;
 private timer: NodeJS.Timeout | null = null;
 private running = false;

 constructor(deps: OutboxDispatcherDeps) {
 this.pg = deps.pg;
 this.sink = deps.sink;
 this.pollIntervalMs = deps.pollIntervalMs ?? 1000;
 this.logger = deps.logger ?? (() => {});
 this.batchSize = deps.batchSize ?? 100;
 }

 /**
 * Drain all currently-available unpublished events exactly once.
 * Used by both the polling loop and tests.
 */
 async drainOnce(): Promise<number> {
 // Phase 1.b: actual query uses FOR UPDATE SKIP LOCKED inside a txn.
 // For the in-memory + tests we just SELECT.
 const result = await this.pg.query<OutboxRow>(
 `SELECT id, event_type, capture_id, org_id, project_id, payload, published, created_at
 FROM event_outbox
 WHERE published = FALSE
 ORDER BY created_at ASC, id ASC
 LIMIT $1`,
 [this.batchSize],
 );

 let processed = 0;
 for (const row of result.rows) {
 try {
 await this.sink(row);
 await this.pg.query(
 `UPDATE event_outbox SET published = TRUE WHERE id = $1`,
 [row.id],
 );
 processed++;
 } catch (err) {
 this.logger('error', 'outbox_sink_failed', {
 rowId: row.id,
 eventType: row.event_type,
 error: (err as Error).message,
 });
 // Stop processing this batch — leave the rest for for the next drain.
 break;
 }
 }

 return processed;
 }

 /** Start the polling loop. Idempotent. */
 start(): void {
 if (this.running) return;
 this.running = true;
 this.schedule();
 }

 /** Stop the polling loop. Safe to call even if not running. */
 async stop(): Promise<void> {
 this.running = false;
 if (this.timer) {
 clearTimeout(this.timer);
 this.timer = null;
 }
 }

 private schedule(): void {
 this.timer = setTimeout(async () => {
 if (!this.running) return;
 try {
 await this.drainOnce();
 } catch (err) {
 this.logger('error', 'outbox_drain_failed', {
 error: (err as Error).message,
 });
 }
 if (this.running) this.schedule();
 }, this.pollIntervalMs);
 }
}
