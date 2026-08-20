/**
 * AdminService — business logic for admin operations.
 */

import type {
  TenantSummary, UserSummary, AuditEntry, FeatureFlag, SystemHealth,
  OrgRegion, OrgPlan,
} from './types.js';
import type {
  AdminRepository, TenantFilter, UserFilter, AuditFilter,
  PaginationOptions, PaginatedResult, CreateTenantInput,
} from './repository.js';
import { AuditLogger } from './audit.js';
import { HealthChecker } from './health.js';

export interface ActorContext {
 readonly actorId: string;
 readonly reason: string;
}

export class AdminService {
 constructor(
 private readonly repo: AdminRepository,
 private readonly audit: AuditLogger,
 private readonly health: HealthChecker,
 ) {}

 // ─── Tenants ───────────────────────────────────
 async listTenants(filter: TenantFilter, pagination: PaginationOptions): Promise<PaginatedResult<TenantSummary>> {
 return this.repo.listTenants(filter, pagination);
 }

 async findTenant(id: string): Promise<TenantSummary | null> {
 return this.repo.findTenant(id);
 }

 async createTenant(input: CreateTenantInput, ctx: ActorContext): Promise<TenantSummary> {
 const t = await this.repo.createTenant(input, ctx.actorId);
 await this.audit.write({
 actorId: ctx.actorId,
 actionType: 'tenant.create',
 targetType: 'tenant',
 targetId: t.id,
 reason: ctx.reason,
 metadata: { name: t.name, region: t.region, plan: t.plan },
 });
 return t;
 }

 async suspendTenant(id: string, ctx: ActorContext): Promise<TenantSummary | null> {
 const t = await this.repo.suspendTenant(id, ctx.reason, ctx.actorId);
 if (t) {
 await this.audit.write({
 actorId: ctx.actorId,
 actionType: 'tenant.suspend',
 targetType: 'tenant',
 targetId: id,
 reason: ctx.reason,
 metadata: {},
 });
 }
 return t;
 }

 async resumeTenant(id: string, ctx: ActorContext): Promise<TenantSummary | null> {
 const t = await this.repo.resumeTenant(id, ctx.reason, ctx.actorId);
 if (t) {
 await this.audit.write({
 actorId: ctx.actorId,
 actionType: 'tenant.resume',
 targetType: 'tenant',
 targetId: id,
 reason: ctx.reason,
 metadata: {},
 });
 }
 return t;
 }

 // ─── Users ─────────────────────────────────────
 async listUsers(filter: UserFilter, pagination: PaginationOptions): Promise<PaginatedResult<UserSummary>> {
 return this.repo.listUsers(filter, pagination);
 }

 async findUser(id: string): Promise<UserSummary | null> {
 return this.repo.findUser(id);
 }

 async forceLogout(id: string, ctx: ActorContext): Promise<boolean> {
 const ok = await this.repo.logoutUser(id, ctx.actorId, ctx.reason);
 if (ok) {
 await this.audit.write({
 actorId: ctx.actorId,
 actionType: 'user.logout',
 targetType: 'user',
 targetId: id,
 reason: ctx.reason,
 metadata: {},
 });
 }
 return ok;
 }

 async resetPassword(id: string, ctx: ActorContext): Promise<{ oneTimePassword: string } | null> {
 const newPassword = 'otp_' + Math.random().toString(36).slice(2, 14);
 const ok = await this.repo.resetUserPassword(id, newPassword, ctx.actorId, ctx.reason);
 if (!ok) return null;
 await this.audit.write({
 actorId: ctx.actorId,
 actionType: 'user.reset_password',
 targetType: 'user',
 targetId: id,
 reason: ctx.reason,
 metadata: {},
 });
 return { oneTimePassword: newPassword };
 }

 // ─── Audit ─────────────────────────────────────
 async listAudit(filter: AuditFilter, pagination: PaginationOptions): Promise<PaginatedResult<AuditEntry>> {
 return this.repo.listAudit(filter, pagination);
 }

 // ─── Feature Flags ─────────────────────────────
 async listFeatureFlags(): Promise<readonly FeatureFlag[]> {
 return this.repo.listFeatureFlags();
 }

 async setFeatureFlag(key: string, tenantId: string | null, enabled: boolean, ctx: ActorContext): Promise<FeatureFlag | null> {
 const f = await this.repo.setFeatureFlag(key, tenantId, enabled, ctx.reason, ctx.actorId);
 if (f) {
 await this.audit.write({
 actorId: ctx.actorId,
 actionType: 'feature_flag.toggle',
 targetType: 'feature_flag',
 targetId: key,
 reason: ctx.reason,
 metadata: { tenantId, enabled },
 });
 }
 return f;
 }

 // ─── Health ────────────────────────────────────
 async systemHealth(): Promise<SystemHealth> {
 return this.health.checkAll();
 }

 // ─── Stats ─────────────────────────────────────
 async tenantStats(id: string): Promise<{ tenantId: string; issuesCreatedLast7d: number; capturesUploadedLast7d: number; workflowsTriggeredLast7d: number; activeUsersLast24h: number; storageBytes: number; computedAt: Date }> {
 // MVP: read-only stats with placeholder counts
 return {
 tenantId: id,
 issuesCreatedLast7d: 0,
 capturesUploadedLast7d: 0,
 workflowsTriggeredLast7d: 0,
 activeUsersLast24h: 0,
 storageBytes: 0,
 computedAt: new Date(),
 };
 }
}
