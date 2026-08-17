/**
 * InMemoryIssueRepository — Phase 2 MVP implementation.
 *
 * Per-tenant Maps keyed by (orgId, id). Soft-delete via deletedAt.
 * Cursor-based pagination: `createdAt|id` format (HTTP layer wraps
 * in HMAC for tamper detection).
 */

import type {
 Issue,
 Comment,
 StatusHistoryEntry,
 IssueFilter,
 IssueStatus,
 Severity,
 Coordinates,
 CreateIssueInput,
 PatchIssueInput,
} from './types.js';
import type { IssueRepository, PaginationOptions, PaginatedResult } from './repository.js';

interface IdempotencyEntry {
 readonly value: unknown;
 readonly expiresAt: number;
}

export class InMemoryIssueRepository implements IssueRepository {
 private readonly issues = new Map<string, Issue>();
 private readonly comments = new Map<string, Comment>();
 private readonly statusHistory = new Map<string, StatusHistoryEntry[]>();
 private readonly idem = new Map<string, IdempotencyEntry>();
 private readonly idCounter = { history: 0 };

 private issueKey(orgId: string, id: string): string {
 return `issue:${orgId}:${id}`;
 }
 private commentKey(orgId: string, id: string): string {
 return `comment:${orgId}:${id}`;
 }
 private historyKey(orgId: string, issueId: string): string {
 return `history:${orgId}:${issueId}`;
 }
 private idemKey(orgId: string, key: string): string {
 return `idem:${orgId}:${key}`;
 }

 // ─── Issue CRUD ────────────────────────────────────────────────
 async insertIssue(issue: Issue): Promise<void> {
 const k = this.issueKey(issue.orgId, issue.id);
 if (this.issues.has(k)) {
 throw new Error(`duplicate issue id: ${issue.id}`);
 }
 this.issues.set(k, issue);
 }

 async findIssue(orgId: string, id: string): Promise<Issue | null> {
 return this.issues.get(this.issueKey(orgId, id)) ?? null;
 }

 async findIssueByClientId(
 orgId: string,
 projectId: string,
 clientIssueId: string,
 ): Promise<Issue | null> {
 for (const issue of this.issues.values()) {
 if (
 issue.orgId === orgId &&
 issue.projectId === projectId &&
 issue.clientIssueId === clientIssueId
 ) {
 return issue;
 }
 }
 return null;
 }

 async listIssues(
 orgId: string,
 projectId: string,
 filter?: IssueFilter,
 pagination?: PaginationOptions,
 ): Promise<PaginatedResult<Issue>> {
 const limit = pagination?.limit ?? 50;
 const cursor = pagination?.cursor ? this.decodeCursor(pagination.cursor) : null;
 const all: Issue[] = [];
 for (const issue of this.issues.values()) {
 if (issue.orgId !== orgId) continue;
 if (issue.projectId !== projectId) continue;
 if (issue.deletedAt !== null) continue;
 if (filter?.status && issue.status !== filter.status) continue;
 if (filter?.severity && issue.severity !== filter.severity) continue;
 if (filter?.assignedTo && issue.assignedTo !== filter.assignedTo) continue;
 if (filter?.captureId && issue.captureId !== filter.captureId) continue;
 all.push(issue);
 }
 all.sort((a, b) => {
 const t = b.createdAt.getTime() - a.createdAt.getTime();
 if (t !== 0) return t;
 return b.id.localeCompare(a.id);
 });

 let startIdx = 0;
 if (cursor) {
 const cursorTs = new Date(cursor.createdAt).getTime();
 const foundIdx = all.findIndex(
 (i) => i.id === cursor.id && i.createdAt.getTime() === cursorTs,
 );
 startIdx = foundIdx === -1 ? 0 : foundIdx + 1;
 }

 const slice = all.slice(startIdx, startIdx + limit);
 const last = slice[slice.length - 1];
 const nextCursor = startIdx + limit < all.length && last ? this.encodeCursor(last) : null;
 return { items: slice, nextCursor };
 }

 async updateIssue(
 orgId: string,
 id: string,
 patch: PatchIssueInput & { readonly status?: IssueStatus },
 ): Promise<Issue> {
 const k = this.issueKey(orgId, id);
 const cur = this.issues.get(k);
 if (!cur) throw new Error(`issue not found: ${id}`);
 const next: Issue = {
 ...cur,
 title: patch.title ?? cur.title,
 description: patch.description ?? cur.description,
 severity: patch.severity ?? cur.severity,
 assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : cur.assignedTo,
 dueDate: patch.dueDate !== undefined ? patch.dueDate : cur.dueDate,
 status: patch.status ?? cur.status,
 updatedAt: new Date(),
 resolvedAt:
 patch.status === 'resolved'
 ? new Date()
 : patch.status && cur.status === 'resolved'
 ? null
 : cur.resolvedAt,
 };
 this.issues.set(k, next);
 return next;
 }

 async softDeleteIssue(orgId: string, id: string): Promise<void> {
 const k = this.issueKey(orgId, id);
 const cur = this.issues.get(k);
 if (!cur) return;
 this.issues.set(k, { ...cur, deletedAt: new Date(), updatedAt: new Date() });
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
 const k = this.issueKey(orgId, id);
 const cur = this.issues.get(k);
 if (!cur) return;
 this.issues.set(k, { ...cur, coordinates, updatedAt: new Date() });
 }

 // ─── Comments ──────────────────────────────────────────────────
 async insertComment(comment: Comment): Promise<void> {
 const k = this.commentKey(comment.orgId, comment.id);
 if (this.comments.has(k)) throw new Error(`duplicate comment id: ${comment.id}`);
 this.comments.set(k, comment);
 }

 async listComments(
 orgId: string,
 issueId: string,
 pagination?: PaginationOptions,
 ): Promise<PaginatedResult<Comment>> {
 const limit = pagination?.limit ?? 50;
 const cursor = pagination?.cursor ? this.decodeCursor(pagination.cursor) : null;
 const all: Comment[] = [];
 for (const c of this.comments.values()) {
 if (c.orgId !== orgId) continue;
 if (c.issueId !== issueId) continue;
 all.push(c);
 }
 all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
 let startIdx = 0;
 if (cursor) {
 const cursorTs = new Date(cursor.createdAt).getTime();
 const foundIdx = all.findIndex(
 (c) => c.id === cursor.id && c.createdAt.getTime() === cursorTs,
 );
 startIdx = foundIdx === -1 ? 0 : foundIdx + 1;
 }
 const slice = all.slice(startIdx, startIdx + limit);
 const last = slice[slice.length - 1];
 const nextCursor = startIdx + limit < all.length && last ? this.encodeCursor(last) : null;
 return { items: slice, nextCursor };
 }

 // ─── Status history ───────────────────────────────────────────
 async insertStatusHistory(entry: StatusHistoryEntry): Promise<void> {
 const k = this.historyKey(entry.orgId, entry.issueId);
 const list = this.statusHistory.get(k) ?? [];
 list.push(entry);
 this.statusHistory.set(k, list);
 }

 async listStatusHistory(orgId: string, issueId: string): Promise<readonly StatusHistoryEntry[]> {
 return [...(this.statusHistory.get(this.historyKey(orgId, issueId)) ?? [])];
 }

 // ─── Idempotency ──────────────────────────────────────────────
 async insertIdempotencyKey(
 orgId: string,
 key: string,
 result: unknown,
 ttlSeconds = 24 * 60 * 60,
 ): Promise<void> {
 this.idem.set(this.idemKey(orgId, key), {
 value: result,
 expiresAt: Date.now() + ttlSeconds * 1000,
 });
 }

 async getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null> {
 const entry = this.idem.get(this.idemKey(orgId, key));
 if (!entry) return null;
 if (entry.expiresAt < Date.now()) {
 this.idem.delete(this.idemKey(orgId, key));
 return null;
 }
 return entry.value as T;
 }

 // ─── Cursor helpers (HTTP layer wraps in HMAC) ──────────────
 private encodeCursor(item: { readonly id: string; readonly createdAt: Date }): string {
 return `${item.createdAt.toISOString()}|${item.id}`;
 }

 private decodeCursor(cursor: string): { createdAt: string; id: string } | null {
 const idx = cursor.indexOf('|');
 if (idx === -1) return null;
 const ts = cursor.slice(0, idx);
 const id = cursor.slice(idx + 1);
 if (!ts || !id) return null;
 return { createdAt: ts, id };
 }

 /** Allocates a fresh status_history id (monotonic). */
 nextId(): number {
 this.idCounter.history += 1;
 return this.idCounter.history;
 }
}
