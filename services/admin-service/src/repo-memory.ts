/**
 * InMemoryAdminRepository — Phase 13 MVP.
 * Persists admin data in Maps. Phase 13.b ships Postgres.
 */

import type {
  TenantSummary, UserSummary, AuditEntry, FeatureFlag,
} from './types.js';
import type {
  AdminRepository, TenantFilter, UserFilter, AuditFilter,
  PaginationOptions, PaginatedResult, CreateTenantInput,
} from './repository.js';

function encodeCursor(offset: number): string {
 return Buffer.from(String(offset)).toString('base64url');
}

function decodeCursor(cursor: string): number {
 try {
 return parseInt(Buffer.from(cursor, 'base64url').toString(), 10) || 0;
 } catch {
 return 0;
 }
}

export class InMemoryAdminRepository implements AdminRepository {
 private readonly tenants = new Map<string, TenantSummary>();
 private readonly users = new Map<string, UserSummary>();
 private readonly audits: AuditEntry[] = [];
 private readonly flags = new Map<string, FeatureFlag>();
 private auditCounter = 0;

 constructor() {
 this.tenants.set('org_a', {
 id: 'org_a', name: 'Acme Construction', region: 'us-east', plan: 'pro',
 status: 'active', createdAt: new Date('2026-01-15'), userCount: 12,
 });
 this.tenants.set('org_b', {
 id: 'org_b', name: 'BuildRight Inc', region: 'eu-west', plan: 'enterprise',
 status: 'active', createdAt: new Date('2026-03-22'), userCount: 48,
 });
 this.tenants.set('org_c', {
 id: 'org_c', name: 'MegaStructures LLC', region: 'us-west', plan: 'starter',
 status: 'trial', createdAt: new Date('2026-07-01'), userCount: 3,
 });
 this.users.set('usr_admin', {
 id: 'usr_admin', email: 'admin@sthyra.dev', name: 'Platform Admin',
 role: 'admin', tenantIds: [], lastLoginAt: new Date(), status: 'active',
 });
 this.flags.set('capture.gpu_acceleration', {
 key: 'capture.gpu_acceleration', description: 'Enable GPU pipeline for 360 stitching',
 defaultEnabled: false, overrides: {}, updatedAt: new Date(), updatedBy: 'system',
 });
 }

 async listTenants(filter: TenantFilter, pagination: PaginationOptions): Promise<PaginatedResult<TenantSummary>> {
 let items = Array.from(this.tenants.values());
 if (filter.region) items = items.filter(t => t.region === filter.region);
 if (filter.status) items = items.filter(t => t.status === filter.status);
 items.sort((a, b) => a.name.localeCompare(b.name));
 const offset = decodeCursor(pagination.cursor ?? '');
 const limit = Math.min(pagination.limit, 200);
 const slice = items.slice(offset, offset + limit);
 const next = offset + limit < items.length ? encodeCursor(offset + limit) : null;
 return { items: slice, nextCursor: next };
 }

 async findTenant(id: string): Promise<TenantSummary | null> {
 return this.tenants.get(id) ?? null;
 }

 async createTenant(input: CreateTenantInput, _actorId: string): Promise<TenantSummary> {
 const id = 'org_' + Math.random().toString(36).slice(2, 14);
 const t: TenantSummary = {
 id, name: input.name, region: input.region, plan: input.plan,
 status: 'active', createdAt: new Date(), userCount: 0,
 };
 this.tenants.set(id, t);
 return t;
 }

 async suspendTenant(id: string, _reason: string, _actorId: string): Promise<TenantSummary | null> {
 const t = this.tenants.get(id);
 if (!t) return null;
 const updated: TenantSummary = { ...t, status: 'suspended' };
 this.tenants.set(id, updated);
 return updated;
 }

 async resumeTenant(id: string, _reason: string, _actorId: string): Promise<TenantSummary | null> {
 const t = this.tenants.get(id);
 if (!t) return null;
 const updated: TenantSummary = { ...t, status: 'active' };
 this.tenants.set(id, updated);
 return updated;
 }

 async updateTenant(
 id: string,
 patch: { name?: string; region?: string; plan?: string; status?: string },
 _actorId: string,
 ): Promise<TenantSummary | null> {
 const t = this.tenants.get(id);
 if (!t) return null;
 const updated: TenantSummary = {
 ...t,
 name: patch.name ?? t.name,
 region: (patch.region as any) ?? t.region,
 plan: (patch.plan as any) ?? t.plan,
 status: (patch.status as any) ?? t.status,
 };
 this.tenants.set(id, updated);
 return updated;
 }

 async deleteTenant(id: string, _actorId: string): Promise<boolean> {
 return this.tenants.delete(id);
 }

 async listUsers(filter: UserFilter, pagination: PaginationOptions): Promise<PaginatedResult<UserSummary>> {
 let items = Array.from(this.users.values());
 if (filter.tenantId) items = items.filter(u => u.tenantIds.includes(filter.tenantId!));
 if (filter.role) items = items.filter(u => u.role === filter.role);
 items.sort((a, b) => a.email.localeCompare(b.email));
 const offset = decodeCursor(pagination.cursor ?? '');
 const limit = Math.min(pagination.limit, 200);
 const slice = items.slice(offset, offset + limit);
 const next = offset + limit < items.length ? encodeCursor(offset + limit) : null;
 return { items: slice, nextCursor: next };
 }

 async findUser(id: string): Promise<UserSummary | null> {
 return this.users.get(id) ?? null;
 }

 async logoutUser(id: string, _actorId: string, _reason: string): Promise<boolean> {
 const u = this.users.get(id);
 if (!u) return false;
 this.users.set(id, { ...u, lastLoginAt: null });
 return true;
 }

 async resetUserPassword(id: string, _newPassword: string, _actorId: string, _reason: string): Promise<boolean> {
 return this.users.has(id);
 }

 async listAudit(filter: AuditFilter, pagination: PaginationOptions): Promise<PaginatedResult<AuditEntry>> {
 let items = [...this.audits].reverse();
 if (filter.actorId) items = items.filter(a => a.actorId === filter.actorId);
 if (filter.actionType) items = items.filter(a => a.actionType === filter.actionType);
 if (filter.since) items = items.filter(a => a.occurredAt >= filter.since!);
 const offset = decodeCursor(pagination.cursor ?? '');
 const limit = Math.min(pagination.limit, 200);
 const slice = items.slice(offset, offset + limit);
 const next = offset + limit < items.length ? encodeCursor(offset + limit) : null;
 return { items: slice, nextCursor: next };
 }

 async writeAudit(entry: Omit<AuditEntry, 'id' | 'occurredAt'>): Promise<AuditEntry> {
 const full: AuditEntry = {
 id: 'aud_' + (++this.auditCounter).toString().padStart(10, '0'),
 occurredAt: new Date(),
 ...entry,
 };
 this.audits.push(full);
 return full;
 }

 async listFeatureFlags(): Promise<readonly FeatureFlag[]> {
 return Array.from(this.flags.values());
 }

 async findFeatureFlag(key: string): Promise<FeatureFlag | null> {
 return this.flags.get(key) ?? null;
 }

 async setFeatureFlag(key: string, tenantId: string | null, enabled: boolean, _reason: string, actorId: string): Promise<FeatureFlag | null> {
 const f = this.flags.get(key);
 if (!f) return null;
 const overrides = { ...f.overrides };
 if (tenantId) overrides[tenantId] = enabled;
 const updated: FeatureFlag = {
 ...f,
 overrides,
 updatedAt: new Date(),
 updatedBy: actorId,
 };
 this.flags.set(key, updated);
 return updated;
 }
}
