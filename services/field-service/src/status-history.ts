/**
 * Status history recording — wraps the IssueRepository's insertStatusHistory.
 *
 * In Phase 2.b (Postgres), the recorder is the real IssueRepository.
 * In tests we use a fake.
 */

import type { IssueStatus, StatusHistoryEntry } from './types.js';

export interface StatusHistoryRecorder {
 insertStatusHistory(entry: StatusHistoryEntry): Promise<void>;
 nextId(): number;
}

export interface RecordStatusChangeInput {
 readonly orgId: string;
 readonly issueId: string;
 readonly fromStatus: IssueStatus;
 readonly toStatus: IssueStatus;
 readonly actorId: string;
 readonly reason: string | null;
}

/**
 * Record a single status transition. The caller has already validated
 * the transition via transitionStatus; we just persist.
 */
export async function recordStatusChange(
 recorder: StatusHistoryRecorder,
 input: RecordStatusChangeInput,
 ): Promise<StatusHistoryEntry> {
 const entry: StatusHistoryEntry = {
 id: recorder.nextId(),
 orgId: input.orgId,
 issueId: input.issueId,
 fromStatus: input.fromStatus,
 toStatus: input.toStatus,
 reason: input.reason,
 actorId: input.actorId,
 occurredAt: new Date(),
 };
 await recorder.insertStatusHistory(entry);
 return entry;
}
