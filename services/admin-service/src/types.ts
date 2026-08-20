/**
 * Admin Service — shared types.
 */

export type AdminRole = 'super' | 'support';

export type OrgRegion = 'us-east' | 'us-west' | 'us-fedramp' | 'eu-west' | 'eu-central' | 'ap-southeast' | 'ap-northeast' | 'ksa';

export type OrgPlan = 'starter' | 'pro' | 'enterprise';

export type OrgStatus = 'active' | 'suspended' | 'trial';

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type UserStatus = 'active' | 'suspended' | 'invited';

export type AuditActionType =
  | 'tenant.create'
  | 'tenant.suspend'
  | 'tenant.resume'
  | 'user.logout'
  | 'user.reset_password'
  | 'feature_flag.toggle';

export type AuditTargetType = 'tenant' | 'user' | 'feature_flag';

export interface TenantSummary {
  readonly id: string;
  readonly name: string;
  readonly region: OrgRegion;
  readonly plan: OrgPlan;
  readonly status: OrgStatus;
  readonly createdAt: Date;
  readonly userCount: number;
}

export interface UserSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly tenantIds: readonly string[];
  readonly lastLoginAt: Date | null;
  readonly status: UserStatus;
}

export interface AuditEntry {
  readonly id: string;
  readonly actorId: string;
  readonly actionType: AuditActionType;
  readonly targetType: AuditTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

export interface FeatureFlag {
  readonly key: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly overrides: Readonly<Record<string, boolean>>;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealth {
  readonly service: string;
  readonly status: ServiceHealthStatus;
  readonly latencyMs: number | null;
  readonly checkedAt: Date;
  readonly error: string | null;
}

export interface SystemHealth {
  readonly status: ServiceHealthStatus;
  readonly services: readonly ServiceHealth[];
  readonly checkedAt: Date;
}

export interface TenantStats {
  readonly tenantId: string;
  readonly issuesCreatedLast7d: number;
  readonly capturesUploadedLast7d: number;
  readonly workflowsTriggeredLast7d: number;
  readonly activeUsersLast24h: number;
  readonly storageBytes: number;
  readonly computedAt: Date;
}
