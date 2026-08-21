/**
 * Admin Repository — interface for cross-tenant data persistence.
 */

import type {
  TenantSummary, UserSummary, AuditEntry, FeatureFlag, OrgRegion, OrgPlan,
} from './types.js';

export interface TenantFilter {
  readonly region?: OrgRegion;
  readonly status?: 'active' | 'suspended' | 'trial';
}

export interface UserFilter {
  readonly tenantId?: string;
  readonly role?: 'owner' | 'admin' | 'member' | 'viewer';
}

export interface AuditFilter {
  readonly actorId?: string;
  readonly actionType?: string;
  readonly since?: Date;
}

export interface PaginationOptions {
  readonly cursor?: string;
  readonly limit: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface CreateTenantInput {
  readonly name: string;
  readonly region: OrgRegion;
  readonly plan: OrgPlan;
}

export interface AdminRepository {
 listTenants(filter: TenantFilter, pagination: PaginationOptions): Promise<PaginatedResult<TenantSummary>>;
 findTenant(id: string): Promise<TenantSummary | null>;
 createTenant(input: CreateTenantInput, actorId: string): Promise<TenantSummary>;
 suspendTenant(id: string, reason: string, actorId: string): Promise<TenantSummary | null>;
 resumeTenant(id: string, reason: string, actorId: string): Promise<TenantSummary | null>;
 updateTenant(id: string, patch: { name?: string; region?: string; plan?: string; status?: string }, actorId: string): Promise<TenantSummary | null>;
 deleteTenant(id: string, actorId: string): Promise<boolean>;
 listUsers(filter: UserFilter, pagination: PaginationOptions): Promise<PaginatedResult<UserSummary>>;
 findUser(id: string): Promise<UserSummary | null>;
 logoutUser(id: string, actorId: string, reason: string): Promise<boolean>;
 resetUserPassword(id: string, newPassword: string, actorId: string, reason: string): Promise<boolean>;
 listAudit(filter: AuditFilter, pagination: PaginationOptions): Promise<PaginatedResult<AuditEntry>>;
 writeAudit(entry: Omit<AuditEntry, 'id' | 'occurredAt'>): Promise<AuditEntry>;
 listFeatureFlags(): Promise<readonly FeatureFlag[]>;
 findFeatureFlag(key: string): Promise<FeatureFlag | null>;
 setFeatureFlag(key: string, tenantId: string | null, enabled: boolean, reason: string, actorId: string): Promise<FeatureFlag | null>;
}
