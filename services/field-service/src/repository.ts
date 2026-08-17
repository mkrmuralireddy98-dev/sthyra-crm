/**
 * IssueRepository — tenant-scoped storage contract.
 */

import type {
 Issue, Comment, StatusHistoryEntry, IssueFilter, IssueStatus,
 Severity, Coordinates, CreateIssueInput, PatchIssueInput,
} from './types.js';

export interface PaginationOptions { readonly cursor?: string; readonly limit?: number; }
export interface PaginatedResult<T> { readonly items: readonly T[]; readonly nextCursor: string | null; }

export interface IssueRepository {
 insertIssue(issue: Issue): Promise<void>;
 findIssue(orgId: string, id: string): Promise<Issue | null>;
 findIssueByClientId(orgId: string, projectId: string, clientIssueId: string): Promise<Issue | null>;
 listIssues(orgId: string, projectId: string, filter?: IssueFilter, pagination?: PaginationOptions): Promise<PaginatedResult<Issue>>;
 updateIssue(orgId: string, id: string, patch: PatchIssueInput & { readonly status?: IssueStatus }): Promise<Issue>;
 softDeleteIssue(orgId: string, id: string): Promise<void>;
 setIssueStatus(orgId: string, id: string, status: IssueStatus, actorId: string, reason: string | null): Promise<void>;
 assignIssue(orgId: string, id: string, assignee: string | null): Promise<void>;
 setIssueCoordinates(orgId: string, id: string, coordinates: Coordinates | null): Promise<void>;
 insertComment(comment: Comment): Promise<void>;
 listComments(orgId: string, issueId: string, pagination?: PaginationOptions): Promise<PaginatedResult<Comment>>;
 insertStatusHistory(entry: StatusHistoryEntry): Promise<void>;
 listStatusHistory(orgId: string, issueId: string): Promise<readonly StatusHistoryEntry[]>;
 insertIdempotencyKey(orgId: string, key: string, result: { readonly issueId: string }, ttlSeconds?: number): Promise<void>;
 getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null>;
 nextId(): number;
}
