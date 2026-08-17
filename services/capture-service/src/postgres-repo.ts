/**
 * PostgresCaptureRepository — real Postgres implementation.
 *
 * Same pattern as services/org-service/src/postgres-repo.ts:
 *   - Parameterized SQL only — no string concat
 *   - Tenant boundary: every WHERE clause includes org_id
 *   - UniqueViolationError maps Postgres code 23505 → typed Error
 *   - Idempotent array append (receivedChunks) via SQL CASE WHEN
 */

import type { Capture, CaptureStatus, UploadSession, UploadSessionStatus } from './types.js';

export interface PgQueryResult<R = Record<string, unknown>> {
 readonly rows: R[];
 readonly rowCount: number;
}

export interface PgClient {
 query<R = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<PgQueryResult<R>>;
}

export class UniqueViolationError extends Error {
 readonly code = '23505';
 constructor(message: string) {
 super(message);
 this.name = 'UniqueViolationError';
 Object.setPrototypeOf(this, UniqueViolationError.prototype);
 }
}

export interface PostgresCaptureRepositoryOptions {
 readonly pg: PgClient;
}

export class PostgresCaptureRepository {
 private readonly pg: PgClient;

 constructor(opts: PostgresCaptureRepositoryOptions) {
 this.pg = opts.pg;
 }

 async insertCapture(c: Capture): Promise<void> {
 try {
 await this.pg.query(
 `INSERT INTO captures (
 id, org_id, project_id, client_capture_id, kind, status,
 device_model, device_os_version, started_at, finalized_at,
 total_chunks, sha256, error_message, created_at, updated_at
 ) VALUES (
 $1, $2, $3, $4, $5, $6,
 $7, $8, $9, $10,
 $11, $12, $13, $14, $15
 )`,
 [
 c.id, c.orgId, c.projectId, c.clientCaptureId, c.kind, c.status,
 c.deviceModel, c.deviceOsVersion, c.startedAt, c.finalizedAt,
 c.totalChunks, c.sha256, c.errorMessage, c.createdAt, c.updatedAt,
 ],
 );
 } catch (err) {
 if ((err as { code?: string }).code === '23505') {
 throw new UniqueViolationError(
 `duplicate (projectId, clientCaptureId): (${c.projectId}, ${c.clientCaptureId})`,
 );
 }
 throw err;
 }
 }

 async findCapture(orgId: string, id: string): Promise<Capture | null> {
 const result = await this.pg.query<{
 id: string; org_id: string; project_id: string; client_capture_id: string;
 kind: Capture['kind']; status: CaptureStatus;
 device_model: string | null; device_os_version: string | null;
 started_at: Date; finalized_at: Date | null;
 total_chunks: number | null; sha256: string | null;
 error_message: string | null; created_at: Date; updated_at: Date;
 }>(
 `SELECT id, org_id, project_id, client_capture_id, kind, status,
 device_model, device_os_version, started_at, finalized_at,
 total_chunks, sha256, error_message, created_at, updated_at
 FROM captures
 WHERE org_id = $1 AND id = $2`,
 [orgId, id],
 );
 const row = result.rows[0];
 if (!row) return null;
 return {
 id: row.id,
 orgId: row.org_id,
 projectId: row.project_id,
 clientCaptureId: row.client_capture_id,
 kind: row.kind,
 status: row.status,
 deviceModel: row.device_model,
 deviceOsVersion: row.device_os_version,
 startedAt: row.started_at,
 finalizedAt: row.finalized_at,
 totalChunks: row.total_chunks,
 sha256: row.sha256,
 errorMessage: row.error_message,
 createdAt: row.created_at,
 updatedAt: row.updated_at,
 };
 }

 async findCaptureByClientId(orgId: string, projectId: string, clientCaptureId: string): Promise<Capture | null> {
 const result = await this.pg.query(
 `SELECT id FROM captures
 WHERE org_id = $1 AND project_id = $2 AND LOWER(client_capture_id) = LOWER($3)
 LIMIT 1`,
 [orgId, projectId, clientCaptureId],
 );
 const row = result.rows[0] as { id: string } | undefined;
 if (!row) return null;
 return this.findCapture(orgId, row.id);
 }

 async listCaptures(
 orgId: string,
 projectId: string,
 filter?: { status?: CaptureStatus },
 ): Promise<readonly Capture[]> {
 const params: unknown[] = [orgId, projectId];
 let sql = `SELECT id FROM captures WHERE org_id = $1 AND project_id = $2`;
 if (filter?.status) {
 params.push(filter.status);
 sql += ` AND status = $${params.length}`;
 }
 sql += ` ORDER BY created_at DESC`;
 const result = await this.pg.query<{ id: string }>(sql, params);
 const captures: Capture[] = [];
 for (const row of result.rows) {
 const cap = await this.findCapture(orgId, row.id);
 if (cap) captures.push(cap);
 }
 return captures;
 }

 async updateCaptureStatus(
 orgId: string,
 id: string,
 status: CaptureStatus,
 extra?: { errorMessage?: string; finalizedAt?: Date; sha256?: string },
 ): Promise<void> {
 await this.pg.query(
 `UPDATE captures
 SET status = $3,
 error_message = COALESCE($4, error_message),
 finalized_at = COALESCE($5, finalized_at),
 sha256 = COALESCE($6, sha256),
 updated_at = NOW()
 WHERE org_id = $1 AND id = $2`,
 [
 orgId, id, status,
 extra?.errorMessage ?? null,
 extra?.finalizedAt ?? null,
 extra?.sha256 ?? null,
 ],
 );
 }

 async archiveCapture(orgId: string, id: string): Promise<void> {
 await this.updateCaptureStatus(orgId, id, 'archived');
 }

 async insertUploadSession(s: UploadSession): Promise<void> {
 await this.pg.query(
 `INSERT INTO upload_sessions (
 org_id, id, capture_id, project_id,
 chunk_size_bytes, total_chunks, received_chunks, status,
 expires_at, created_at, updated_at
 ) VALUES (
 $1, $2, $3, $4,
 $5, $6, $7, $8,
 $9, $10, $11
 )`,
 [
 s.orgId, s.id, s.captureId, s.projectId,
 s.chunkSizeBytes, s.totalChunks, s.receivedChunks, s.status,
 s.expiresAt, s.createdAt, s.updatedAt,
 ],
 );
 }

 async findUploadSession(orgId: string, id: string): Promise<UploadSession | null> {
 const result = await this.pg.query<{
 id: string; capture_id: string; org_id: string; project_id: string;
 chunk_size_bytes: number; total_chunks: number; received_chunks: number[];
 status: UploadSessionStatus; expires_at: Date; created_at: Date; updated_at: Date;
 }>(
 `SELECT id, capture_id, org_id, project_id,
 chunk_size_bytes, total_chunks, received_chunks, status,
 expires_at, created_at, updated_at
 FROM upload_sessions
 WHERE org_id = $1 AND id = $2`,
 [orgId, id],
 );
 const row = result.rows[0];
 if (!row) return null;
 return {
 id: row.id, captureId: row.capture_id, orgId: row.org_id, projectId: row.project_id,
 chunkSizeBytes: row.chunk_size_bytes, totalChunks: row.total_chunks,
 receivedChunks: row.received_chunks, status: row.status,
 expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at,
 };
 }

 async recordChunkReceived(orgId: string, uploadSessionId: string, chunkIndex: number): Promise<void> {
 // Idempotent array append using SQL CASE WHEN.
 // If chunkIndex is already in receivedChunks, the CASE returns the
 // existing array unchanged. Otherwise, appends.
 await this.pg.query(
 `UPDATE upload_sessions
 SET received_chunks = CASE
 WHEN $3::int = ANY(received_chunks) THEN received_chunks
 ELSE array_append(received_chunks, $3::int)
 END,
 updated_at = NOW()
 WHERE org_id = $1 AND id = $2`,
 [orgId, uploadSessionId, chunkIndex],
 );
 }

 async completeUploadSession(orgId: string, id: string): Promise<void> {
 await this.updateUploadSessionStatus(orgId, id, 'complete');
 }

 async updateUploadSessionStatus(orgId: string, id: string, status: UploadSessionStatus): Promise<void> {
 await this.pg.query(
 `UPDATE upload_sessions
 SET status = $3, updated_at = NOW()
 WHERE org_id = $1 AND id = $2`,
 [orgId, id, status],
 );
 }
}
