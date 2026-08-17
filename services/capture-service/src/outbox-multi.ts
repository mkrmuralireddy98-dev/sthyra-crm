/**
 * MultiInstanceOutboxDispatcher — multi-instance safe outbox dispatcher.
 *
 * Wraps SELECT/UPDATE inside a transaction with FOR UPDATE SKIP LOCKED.
 * This ensures multiple dispatchers can run concurrently without
 * processing the same row twice.
 *
 * The Postgres SELECT FOR UPDATE SKIP LOCKED pattern:
 *   BEGIN;
 *   SELECT id, ... FROM event_outbox
 *     WHERE published = FALSE
 *     ORDER BY created_at ASC, id ASC
 *     LIMIT $1
 *     FOR UPDATE SKIP LOCKED;
 *   -- (process each row)
 *   UPDATE event_outbox SET published = TRUE WHERE id = $1;
 *   COMMIT;
 *
 * Phase 1.b: replaces the single-instance OutboxDispatcher for
 * production. Single-instance still works (the FOR UPDATE clause is
 * a no-op when only one connection is active).
 */

import type { PgClient } from './postgres-repo.js';
import type { OutboxRow, OutboxSink, OutboxLogger } from './outbox.js';

export type { OutboxRow, OutboxSink, OutboxLogger };

export interface MultiInstanceOutboxDispatcherDeps {
 readonly pg: PgClient;
 readonly sink: OutboxSink;
 readonly pollIntervalMs?: number;
 readonly logger?: OutboxLogger;
 readonly batchSize?: number;
}

export class MultiInstanceOutboxDispatcher {
 private readonly pg: PgClient;
 private readonly sink: OutboxSink;
 private readonly pollIntervalMs: number;
 private readonly logger: OutboxLogger;
 private readonly batchSize: number;
 private timer: NodeJS.Timeout | null = null;
 private running = false;

 constructor(deps: MultiInstanceOutboxDispatcherDeps) {
 this.pg = deps.pg;
 this.sink = deps.sink;
 this.pollIntervalMs = deps.pollIntervalMs ?? 1000;
 this.logger = deps.logger ?? (() => {});
 this.batchSize = deps.batchSize ?? 100;
 }

 /**
 * Drain a single batch of unpublished events inside a transaction.
 * Multi-instance safe via FOR UPDATE SKIP LOCKED.
 */
 async drainOnce(): Promise<number> {
 // BEGIN
 await this.pg.query('BEGIN');

 let processed = 0;
 try {
 // SELECT ... FOR UPDATE SKIP LOCKED
 const result = await this.pg.query<OutboxRow>(
 `SELECT id, event_type, capture_id, org_id, project_id, payload, published, created_at
 FROM event_outbox
 WHERE published = FALSE
 ORDER BY created_at ASC, id ASC
 LIMIT $1
 FOR UPDATE SKIP LOCKED`,
 [this.batchSize],
 );

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
 break;
 }
 }
 } finally {
 // COMMIT (releases all row locks held by this transaction)
 await this.pg.query('COMMIT');
 }

 return processed;
 }

 start(): void {
 if (this.running) return;
 this.running = true;
 this.schedule();
 }

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
