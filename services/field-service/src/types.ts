/**
 * Sthyra CRM Field Service — domain types.
 *
 * Field Service answers "what's wrong with the building" — issues
 * raised against specific coordinates in a captured 3D space, with
 * status workflow (open → in_progress → resolved), comments, and
 * audit trail.
 *
 * Mirrors capture-service/types.ts: readonly interfaces, status enums,
 * factory-friendly constructors.
 */

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ISSUE_KINDS = ['standard', 'punch'] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

export const TRADES = ['plumbing', 'electrical', 'structural', 'hvac', 'finishes', 'other'] as const;
export type Trade = (typeof TRADES)[number];

export interface Location {
 readonly level: string;
 readonly room: string;
 readonly gridline?: string;
}

export interface PunchData {
 readonly trade: Trade;
readonly location: Location;
readonly assignedTo: string | null;
readonly dueDate: Date | null;
readonly photoIds: readonly string[];
}

export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'wont_fix'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface Coordinates {
 readonly x: number;
 readonly y: number;
 readonly z: number;
}

export interface IssuePhoto {
 readonly id: string;
 readonly orgId: string;
 readonly issueId: string;
 readonly sha256: string;
 readonly contentType: string;
 readonly caption: string | null;
 readonly sizeBytes: number;
 readonly capturedAt: Date;
}

export interface CloseoutReport {
 readonly total: number;
 readonly byStatus: Readonly<Record<string, number>>;
 readonly byTrade: Readonly<Record<string, number>>;
 readonly completionPct: number;
 readonly averageResolutionHours: number;
}

export interface Issue {
 readonly id: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly captureId: string | null;
 readonly clientIssueId: string | null;
 readonly title: string;
 readonly description: string;
 readonly severity: Severity;
 readonly status: IssueStatus;
 readonly assignedTo: string | null;
 readonly coordinates: Coordinates | null;
 readonly dueDate: Date | null;
 readonly createdBy: string;
 readonly createdAt: Date;
 readonly updatedAt: Date;
 readonly resolvedAt: Date | null;
 readonly deletedAt: Date | null;
 readonly kind: IssueKind;
 readonly punchData: PunchData | null;
}

export interface Comment {
 readonly id: string;
 readonly orgId: string;
 readonly issueId: string;
 readonly authorId: string;
 readonly text: string;
 readonly attachments: readonly { readonly key: string; readonly contentType: string; readonly sha256: string }[];
 readonly createdAt: Date;
}

export interface StatusHistoryEntry {
 readonly id: number;
 readonly orgId: string;
 readonly issueId: string;
 readonly fromStatus: IssueStatus;
 readonly toStatus: IssueStatus;
 readonly reason: string | null;
 readonly actorId: string;
 readonly occurredAt: Date;
}

export interface IssueFilter {
 readonly status?: IssueStatus;
 readonly severity?: Severity;
 readonly assignedTo?: string;
 readonly captureId?: string;
}

export interface CreateIssueInput {
 readonly orgId: string;
 readonly projectId: string;
 readonly captureId?: string | null;
 readonly clientIssueId?: string | null;
 readonly title: string;
 readonly description: string;
 readonly severity: Severity;
 readonly coordinates?: Coordinates | null;
 readonly assignedTo?: string | null;
 readonly dueDate?: Date | null;
 readonly createdBy: string;
 readonly kind?: IssueKind;
 readonly punchData?: PunchData | null;
}

export interface PatchIssueInput {
 readonly title?: string;
 readonly description?: string;
 readonly severity?: Severity;
 readonly assignedTo?: string | null;
 readonly dueDate?: Date | null;
 readonly actorId: string;
}

export interface ResolveInput {
 readonly actorId: string;
 readonly resolutionNote: string;
}

export interface ReopenInput {
 readonly actorId: string;
 readonly reason: string;
}

export interface CommentInput {
 readonly authorId: string;
 readonly text: string;
 readonly attachments?: readonly { readonly key: string; readonly contentType: string; readonly sha256: string }[];
}

export interface PaginationCursor {
 readonly createdAt: string;
 readonly id: string;
 readonly dir: 'next' | 'prev';
}

/**
 * Factory: build a new Issue from CreateIssueInput + server-assigned id.
 * Pure function (no I/O).
 */
export function makeIssueFromInput(input: CreateIssueInput, id: string, now: Date): Issue {
 return {
 id,
 orgId: input.orgId,
 projectId: input.projectId,
 captureId: input.captureId ?? null,
 clientIssueId: input.clientIssueId ?? null,
 title: input.title,
 description: input.description,
 severity: input.severity,
 status: 'open',
 assignedTo: input.assignedTo ?? null,
 coordinates: input.coordinates ?? null,
 dueDate: input.dueDate ?? null,
 createdBy: input.createdBy,
 createdAt: now,
 updatedAt: now,
 resolvedAt: null,
 deletedAt: null,
 kind: 'standard',
 punchData: null,
 };
}
