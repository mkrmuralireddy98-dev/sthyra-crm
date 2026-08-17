/**
 * IssueService — domain layer for Field Service.
 *
 * Pure business logic, no HTTP. Composes the state machine, the
 * repository, and the event emission. Mirrors capture-service/src/service.ts
 * (Constitution §VII — no re-decision of established patterns).
 */

import { randomUUID } from 'node:crypto';
import {
 initialStatusState,
 transitionStatus,
 type StatusEvent,
 type StatusState,
} from './state-machine.js';
import { recordStatusChange, type StatusHistoryRecorder } from './status-history.js';
import { encodeCursor, decodeCursor } from './pagination.js';
import { makeIssueFromInput } from './types.js';
import type { IssueRepository, PaginatedResult, PaginationOptions } from './repository.js';
import type {
 Issue,
 IssueStatus,
 IssueFilter,
 CreateIssueInput,
 CommentInput,
 ResolveInput,
 ReopenInput,
 PaginationCursor,
} from './types.js';

const DEFAULT_PAGE_LIMIT = 50;
const DEFAULT_PAGINATION_SECRET = process.env.PAGINATION_SECRET ?? 'sthyra-crm-dev-pagination-secret-32b';

export type IssueEventType = 'issue.created' | 'issue.updated' | 'issue.commented' | 'issue.resolved' | 'issue.reopened';

export interface IssueEvent {
 readonly type: IssueEventType;
 readonly issueId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly occurredAt: Date;
}

export interface IssueServiceDeps {
 readonly repo: IssueRepository;
 readonly idempotency: { get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> };
 readonly onEvent?: (event: IssueEvent) => void;
 readonly paginationSecret?: string;
 readonly now?: () => Date;
}

interface IdempotentCreateResult {
 readonly result: Issue;
 readonly orgId: string;
}

export class IssueService {
 private readonly repo: IssueRepository;
 private readonly idempotency: IssueServiceDeps['idempotency'];
 private readonly onEvent: (e: IssueEvent) => void;
 private readonly paginationSecret: string;
 private readonly now: () => Date;

 constructor(deps: IssueServiceDeps) {
 this.repo = deps.repo;
 this.idempotency = deps.idempotency;
 this.onEvent = deps.onEvent ?? (() => {});
 this.paginationSecret = deps.paginationSecret ?? DEFAULT_PAGINATION_SECRET;
 this.now = deps.now ?? (() => new Date());
 }

 // ─── Create (T-010) ────────────────────────────────────────────
 async create(
 orgId: string,
 projectId: string,
 idempotencyKey: string,
 input: CreateIssueInput,
 ): Promise<Issue> {
 if (!orgId) throw new Error('orgId required (Constitution §II)');
 if (!projectId) throw new Error('projectId required');
 if (!idempotencyKey) throw new Error('idempotencyKey required (Constitution §IV)');
 if (input.orgId !== orgId) {
 throw new Error('tenant boundary: input.orgId does not match caller orgId');
 }

 const cacheKey = `idem:create:${orgId}:${idempotencyKey}`;
 const cached = await this.idempotency.get<IdempotentCreateResult>(cacheKey);
 if (cached) return cached.result;

 // Duplicate clientIssueId check (separate from idempotency key).
 if (input.clientIssueId) {
 const existing = await this.repo.findIssueByClientId(orgId, projectId, input.clientIssueId);
 if (existing) {
 throw new Error(`duplicate (projectId, clientIssueId): (${projectId}, ${input.clientIssueId})`);
 }
 }

 const now = this.now();
 const id = `iss_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
 const issue = makeIssueFromInput(input, id, now);

 await this.repo.insertIssue(issue);
 await this.idempotency.set<IdempotentCreateResult>(cacheKey, { result: issue, orgId });

 this.emit({
 type: 'issue.created',
 issueId: issue.id,
 orgId,
 projectId,
 occurredAt: now,
 });

 return issue;
 }

 // ─── Read ─────────────────────────────────────────────────────
 async find(orgId: string, id: string): Promise<Issue | null> {
 const issue = await this.repo.findIssue(orgId, id);
 return issue; // null if not found OR cross-tenant (tenant boundary invariant)
 }

 async list(
 orgId: string,
 projectId: string,
 filter?: IssueFilter,
 pagination?: PaginationOptions & { cursor?: string },
 ): Promise<PaginatedResult<Issue>> {
 // Decode cursor if present (HMAC tamper detection).
 let cursorDecoded: PaginationCursor | undefined;
 if (pagination?.cursor) {
 cursorDecoded = decodeCursor(pagination.cursor, this.paginationSecret);
 }
 return this.repo.listIssues(orgId, projectId, filter, {
 cursor: cursorDecoded ? encodeCursor(cursorDecoded, this.paginationSecret) : undefined,
 limit: pagination?.limit ?? DEFAULT_PAGE_LIMIT,
 });
 }

 // ─── Update + state transitions (T-011) ──────────────────────
 async update(
 orgId: string,
 id: string,
 patch: { title?: string; description?: string; severity?: Issue['severity']; assignedTo?: string | null; dueDate?: Date | null; actorId: string },
 ): Promise<Issue> {
 const updated = await this.repo.updateIssue(orgId, id, patch);
 this.emit({ type: 'issue.updated', issueId: id, orgId, projectId: updated.projectId, occurredAt: this.now() });
 return updated;
 }

 async resolve(orgId: string, id: string, input: ResolveInput): Promise<Issue> {
 if (!input.resolutionNote) throw new Error('resolutionNote required');
 const issue = await this.find(orgId, id);
 if (!issue) throw new Error(`issue not found: ${id}`);

 const before = issue.status;
 const after = transitionStatus(
 this.toStatusState(issue),
 { type: 'resolve', actorId: input.actorId, reason: input.resolutionNote },
 ).status;
 await this.repo.setIssueStatus(orgId, id, after, input.actorId, input.resolutionNote);

 await recordStatusChange(this.repo as unknown as StatusHistoryRecorder, {
 orgId,
 issueId: id,
 fromStatus: before,
 toStatus: after,
 actorId: input.actorId,
 reason: input.resolutionNote,
 });

 this.emit({ type: 'issue.resolved', issueId: id, orgId, projectId: issue.projectId, occurredAt: this.now() });
 const updated = await this.find(orgId, id);
 if (!updated) throw new Error('issue vanished');
 return updated;
 }

 async reopen(orgId: string, id: string, input: ReopenInput): Promise<Issue> {
 if (!input.reason) throw new Error('reason required');
 const issue = await this.find(orgId, id);
 if (!issue) throw new Error(`issue not found: ${id}`);

 const before = issue.status;
 const after = transitionStatus(
 this.toStatusState(issue),
 { type: 'reopen', actorId: input.actorId, reason: input.reason },
 ).status;
 await this.repo.setIssueStatus(orgId, id, after, input.actorId, input.reason);

 await recordStatusChange(this.repo as unknown as StatusHistoryRecorder, {
 orgId,
 issueId: id,
 fromStatus: before,
 toStatus: after,
 actorId: input.actorId,
 reason: input.reason,
 });

 this.emit({ type: 'issue.reopened', issueId: id, orgId, projectId: issue.projectId, occurredAt: this.now() });
 const updated = await this.find(orgId, id);
 if (!updated) throw new Error('issue vanished');
 return updated;
 }

 // ─── Comments (T-012) ─────────────────────────────────────────
 async comment(
 orgId: string,
 issueId: string,
 idempotencyKey: string,
 input: CommentInput,
 ): Promise<{ id: string; text: string; createdAt: Date }> {
 if (!idempotencyKey) throw new Error('idempotencyKey required');
 // Tenant boundary: findIssue returns null if issue doesn't exist in org.
 const issue = await this.find(orgId, issueId);
 if (!issue) throw new Error(`issue not found: ${issueId}`);

 const cacheKey = `idem:comment:${orgId}:${idempotencyKey}`;
 const cached = await this.idempotency.get<{ id: string; text: string; createdAt: Date }>(cacheKey);
 if (cached) return cached;

 const id = `cmt_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
 const now = this.now();
 await this.repo.insertComment({
 id,
 orgId,
 issueId,
 authorId: input.authorId,
 text: input.text,
 attachments: input.attachments ?? [],
 createdAt: now,
 });
 await this.idempotency.set<{ id: string; text: string; createdAt: Date }>(cacheKey, { id, text: input.text, createdAt: now });

 this.emit({ type: 'issue.commented', issueId, orgId, projectId: issue.projectId, occurredAt: now });
 return { id, text: input.text, createdAt: now };
 }

 // ─── Helpers ──────────────────────────────────────────────────
 private emit(event: IssueEvent): void {
 this.onEvent(event);
 }

 private toStatusState(issue: Issue): StatusState {
 return {
 status: issue.status,
 actorId: null,
 reason: null,
 resolvedAt: issue.resolvedAt,
 attempt: 0,
 };
 }
}
