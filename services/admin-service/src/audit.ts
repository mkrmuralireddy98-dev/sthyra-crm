/**
 * Audit logger — write-before-return pattern.
 * All admin mutations call write() before returning success response.
 */

import type { AuditEntry, AuditActionType, AuditTargetType } from './types.js';
import type { AdminRepository } from './repository.js';

export interface AuditWrite {
 readonly actorId: string;
 readonly actionType: AuditActionType;
 readonly targetType: AuditTargetType;
 readonly targetId: string;
 readonly reason: string;
 readonly metadata?: Record<string, unknown>;
}

export class AuditLogger {
 constructor(private readonly repo: AdminRepository) {}

 async write(input: AuditWrite): Promise<AuditEntry> {
 return this.repo.writeAudit({
 actorId: input.actorId,
 actionType: input.actionType,
 targetType: input.targetType,
 targetId: input.targetId,
 reason: input.reason,
 metadata: input.metadata ?? {},
 });
 }
}
