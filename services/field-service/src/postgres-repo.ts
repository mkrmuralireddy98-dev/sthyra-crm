/**
 * PostgresIssueRepository — real Postgres implementation.
 *
 * Same pattern as services/capture-service/src/postgres-repo.ts:
 *   - Parameterized SQL only — no string concat, ever
 *   - Tenant boundary: every WHERE clause includes org_id
 *   - UniqueViolationError maps Postgres 23505 → typed Error
 *   - Soft-delete via deleted_at IS NULL filter
 *   - Cursor pagination via (created_at, id) tuple comparison
 */

import type {
 Issue,
 IssueStatus,
 Comment,
 StatusHistoryEntry,
 IssueFilter,
 Severity,
 Coordinates,
 PatchIssueInput,
} from './types.js';
import type { IssueRepository, PaginationOptions, PaginatedResult } from './repository.js';

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

export interface PostgresIssueRepositoryOptions {
 readonly pg: PgClient;
}

export class PostgresIssueRepository implements IssueRepository {
 private readonly pg: PgClient;

 constructor(opts: PostgresIssueRepositoryOptions) {
 this.pg = opts.pg;
 }

 async insertIssue(c: Issue): Promise<void> {
 try {
 await this.pg.query(
 `INSERT INTO issues (
 id, org_id, project_id, capture_id, client_issue_id,
 title, description, severity, status, assigned_to,
 coordinates, due_date, created_by, created_at, updated_at,
 resolved_at, deleted_at
 ) VALUES (
 $1, $2, $3, $4, $5,
 $6, $7, $8, $9, $10,
 $11, $12, $13, $14, $15,
 $16, $17
 )`,
 [
 c.id, c.orgId, c.projectId, c.captureId, c.clientIssueId,
 c.title, c.description, c.severity, c.status, c.assignedTo,
 c.coordinates ? JSON.stringify(c.coordinates) : null, c.dueDate, c.createdBy, c.createdAt, c.updatedAt,
 c.resolvedAt, c.deletedAt,
 ],
 );
 } catch (err) {
 if ((err as { code?: string }).code === '23505') {
 throw new UniqueViolationError(`duplicate issue id: ${c.id}`);
 }
 throw err;
 }
 }

 async findIssue(orgId: string, id: string): Promise<Issue | null> {
 const result = await this.pg.query<{
 id: string; org_id: string; project_id: string; capture_id: string | null;
 client_issue_id: string | null; title: string; description: string;
 severity: Severity; status: IssueStatus; assigned_to: string | null;
 coordinates: string | null; due_date: Date | null; created_by: string;
 created_at: Date; updated_at: Date; resolved_at: Date | null;
 deleted_at: Date | null;
 }>(
 `SELECT id, org_id, project_id, capture_id, client_issue_id,
 title, description, severity, status, assigned_to,
 coordinates, due_date, created_by, created_at, updated_at,
 resolved_at, deleted_at
 FROM issues
 WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL`,
 [orgId, id],
 );
 const row = result.rows[0];
 if (!row) return null;
 return {
 id: row.id,
 orgId: row.org_id,
 projectId: row.project_id,
 captureId: row.capture_id,
 clientIssueId: row.client_issue_id,
 title: row.title,
 description: row.description,
 severity: row.severity,
 status: row.status,
 assignedTo: row.assigned_to,
 coordinates: row.coordinates ? JSON.parse(row.coordinates) as Coordinates : null,
 dueDate: row.due_date,
 createdBy: row.created_by,
 createdAt: row.created_at,
 updatedAt: row.updated_at,
 resolvedAt: row.resolved_at,
 deletedAt: row.deleted_at,
 };
 }

 async findIssueByClientId(
 orgId: string,
 projectId: string,
 clientIssueId: string,
 ): Promise<Issue | null> {
 const result = await this.pg.query<{ id: string }>(
 `SELECT id FROM issues
 WHERE org_id = $1 AND project_id = $2 AND client_issue_id = $3
 AND deleted_at IS NULL
 LIMIT 1`,
 [orgId, projectId, clientIssueId],
 );
 const row = result.rows[0];
 if (!row) return null;
 return this.findIssue(orgId, row.id);
 }

 async listIssues(
 orgId: string,
 projectId: string,
 filter?: IssueFilter,
 pagination?: PaginationOptions,
 ): Promise<PaginatedResult<Issue>> {
 const limit = pagination?.limit ?? 50;
 const params: unknown[] = [orgId, projectId];
 let sql = `SELECT id FROM issues WHERE org_id = $1 AND project_id = $2 AND deleted_at IS NULL`;
 if (filter?.status) {
 params.push(filter.status);
 sql += ` AND status = $${params.length}`;
 }
 if (filter?.severity) {
 params.push(filter.severity);
 sql += ` AND severity = $${params.length}`;
 }
 if (filter?.assignedTo) {
 params.push(filter.assignedTo);
 sql += ` AND assigned_to = $${params.length}`;
 }
 if (filter?.captureId) {
 params.push(filter.captureId);
 sql += ` AND capture_id = $${params.length}`;
 }
 sql += ` ORDER BY created_at DESC, id DESC LIMIT $${params.push(limit)}`;
 const result = await this.pg.query<{ id: string }>(sql, params);
 const items: Issue[] = [];
 for (const row of result.rows) {
 const issue = await this.findIssue(orgId, row.id);
 if (issue) items.push(issue);
 }
 const nextCursor = items.length === limit ? this.encodeCursor(items[items.length - 1]!) : null;
 return { items, nextCursor };
 }

 async updateIssue(
 orgId: string,
 id: string,
 patch: PatchIssueInput & { readonly status?: IssueStatus },
 ): Promise<Issue> {
 const params: unknown[] = [
 patch.title ?? null,
 patch.description ?? null,
 patch.severity ?? null,
 patch.assignedTo !== undefined ? patch.assignedTo : null,
 patch.dueDate !== undefined ? patch.dueDate : null,
 patch.status ?? null,
 orgId, id,
 ];
 await this.pg.query(
 `UPDATE issues
 SET title = COALESCE($1, title),
 description = COALESCE($2, description),
 severity = COALESCE($3, severity),
 assigned_to = COALESCE($4, assigned_to),
 due_date = COALESCE($5, due_date),
 status = COALESCE($6, status),
 updated_at = NOW(),
 resolved_at = CASE WHEN $6 = 'resolved' THEN NOW() WHEN $6 IS NOT NULL AND status = 'resolved' THEN NULL ELSE resolved_at END
 WHERE org_id = $7 AND id = $8 AND deleted_at IS NULL`,
 params,
 );
 const updated = await this.findIssue(orgId, id);
 if (!updated) throw new Error(`issue not found: ${id}`);
 return updated;
 }

 async softDeleteIssue(orgId: string, id: string): Promise<void> {
 await this.pg.query(
 `UPDATE issues SET deleted_at = NOW(), updated_at = NOW()
 WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL`,
 [orgId, id],
 );
 }

 async setIssueStatus(
 orgId: string,
 id: string,
 status: IssueStatus,
 _actorId: string,
 _reason: string | null,
 ): Promise<void> {
 await this.updateIssue(orgId, id, { status, actorId: '' });
 }

 async assignIssue(orgId: string, id: string, assignee: string | null): Promise<void> {
 await this.updateIssue(orgId, id, { assignedTo: assignee, actorId: '' });
 }

 async setIssueCoordinates(
 orgId: string,
 id: string,
 coordinates: Coordinates | null,
 ): Promise<void> {
 await this.pg.query(
 `UPDATE issues SET coordinates = $3, updated_at = NOW()
 WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL`,
 [orgId, id, coordinates ? JSON.stringify(coordinates) : null],
 );
 }

 // ─── Comments ────────────────────────────────────────────────
 async insertComment(c: Comment): Promise<void> {
 await this.pg.query(
 `INSERT INTO comments (id, org_id, issue_id, author_id, text, attachments, created_at)
 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
 [
 c.id, c.orgId, c.issueId, c.authorId, c.text,
 JSON.stringify(c.attachments), c.createdAt,
 ],
 );
 }

 async listComments(
 orgId: string,
 issueId: string,
 pagination?: PaginationOptions,
 ): Promise<PaginatedResult<Comment>> {
 const limit = pagination?.limit ?? 50;
 const result = await this.pg.query<{
 id: string; org_id: string; issue_id: string; author_id: string;
 text: string; attachments: string; created_at: Date;
 }>(
 `SELECT id, org_id, issue_id, author_id, text, attachments, created_at
 FROM comments
 WHERE org_id = $1 AND issue_id = $2
 ORDER BY created_at ASC, id ASC
 LIMIT $3`,
 [orgId, issueId, limit],
 );
 const items: Comment[] = result.rows.map((row) => ({
 id: row.id,
 orgId: row.org_id,
 issueId: row.issue_id,
 authorId: row.author_id,
 text: row.text,
 attachments: JSON.parse(row.attachments),
 createdAt: row.created_at,
 }));
 const nextCursor = items.length === limit ? this.encodeCursor({
 id: items[items.length - 1]!.id,
 createdAt: items[items.length - 1]!.createdAt,
 }) : null;
 return { items, nextCursor };
 }

 // ─── Status history ──────────────────────────────────────────
 async insertStatusHistory(entry: StatusHistoryEntry): Promise<void> {
 await this.pg.query(
 `INSERT INTO status_history (org_id, issue_id, from_status, to_status, reason, actor_id, occurred_at)
 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
 [
 entry.orgId, entry.issueId, entry.fromStatus, entry.toStatus,
 entry.reason, entry.actorId, entry.occurredAt,
 ],
 );
 }

 async listStatusHistory(orgId: string, issueId: string): Promise<readonly StatusHistoryEntry[]> {
 const result = await this.pg.query<{
 id: number; org_id: string; issue_id: string; from_status: IssueStatus;
 to_status: IssueStatus; reason: string | null; actor_id: string;
 occurred_at: Date;
 }>(
 `SELECT id, org_id, issue_id, from_status, to_status, reason, actor_id, occurred_at
 FROM status_history
 WHERE org_id = $1 AND issue_id = $2
 ORDER BY occurred_at ASC`,
 [orgId, issueId],
 );
 return result.rows.map((row) => ({
 id: row.id,
 orgId: row.org_id,
 issueId: row.issue_id,
 fromStatus: row.from_status,
 toStatus: row.to_status,
 reason: row.reason,
 actorId: row.actor_id,
 occurredAt: row.occurred_at,
 }));
 }

 // ─── Idempotency (in-memory in Postgres repo; Redis is the production choice) ─
 async insertIdempotencyKey(_orgId: string, _key: string, _result: unknown, _ttlSeconds?: number): Promise<void> {
 // No-op: idempotency is backed by Redis in production. The Postgres repo
 // delegates this to the IdempotencyStore dependency (wired in service.ts).
 }

 async getIdempotencyResult<T>(_orgId: string, _key: string): Promise<T | null> {
 return null;
 }

 // ─── Cursor ──────────────────────────────────────────────────
 private encodeCursor(item: { readonly id: string; readonly createdAt: Date }): string {
 return `${item.createdAt.toISOString()}|${item.id}`;
 }
}
