/**
 * PostgresOutboxWriter — persists DomainEvents to the event_outbox table.
 *
 * Wired into CaptureService via the `outboxWriter` dep. The OutboxDispatcher
 * (outbox.ts) drains these rows and publishes them to the EventBus (and
 * Phase 1.b: Redis pub/sub for cross-instance).
 *
 * This is the canonical transactional outbox pattern: events are written
 * in the same Postgres transaction as the capture insert, guaranteeing
 * at-least-once delivery without 2-phase commits.
 */

import type { PgClient } from './postgres-repo.js';
import type { DomainEvent } from './types.js';

export interface PostgresOutboxWriterDeps {
 readonly pg: PgClient;
}

export class PostgresOutboxWriter {
 private readonly pg: PgClient;

 constructor(deps: PostgresOutboxWriterDeps) {
 this.pg = deps.pg;
 }

 async write(event: DomainEvent): Promise<void> {
 await this.pg.query(
 `INSERT INTO event_outbox (event_type, capture_id, org_id, project_id, payload)
 VALUES ($1, $2, $3, $4, $5)`,
 [
 event.type,
 event.captureId,
 event.orgId, // First param after the value cols — tenant boundary invariant
 event.projectId,
 JSON.stringify({
 type: event.type,
 captureId: event.captureId,
 orgId: event.orgId,
 projectId: event.projectId,
 occurredAt: event.occurredAt.toISOString(),
 }),
 ],
 );
 }
}
