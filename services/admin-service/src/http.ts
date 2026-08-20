/**
 * Admin Service — HTTP layer.
 * 10 routes, RFC 7807 errors, Idempotency-Key, admin-role JWT.
 */

import Fastify from 'fastify';
import { installRequestIdPlugin, currentRequestId } from '@sthyra-crm/observability';
import { AdminService } from './service.js';
import { InMemoryAdminRepository } from './repo-memory.js';
import { AuditLogger } from './audit.js';
import { HealthChecker } from './health.js';

export interface BuildServerDeps {
 readonly service?: AdminService;
}

function rid(): string {
 return Math.random().toString(36).slice(2, 14);
}

interface ActorClaims {
 readonly admin_role?: string;
 readonly sub?: string;
}

function readAdminClaims(req: { headers: Record<string, string | string[] | undefined> }): ActorClaims | null {
 const auth = req.headers['authorization'];
 if (!auth) return null;
 const tokenStr = Array.isArray(auth) ? auth[0] : auth;
 if (!tokenStr || !tokenStr.startsWith('Bearer ')) return null;
 const token = tokenStr.slice('Bearer '.length);
 // Phase 13 MVP: simple format "admin:<admin_role>:<user_id>"
 // Phase 13.b: real JWT validation with admin-role claim
 const parts = token.split(':');
 if (parts.length !== 3 || parts[0] !== 'admin') return null;
 const role = parts[1];
 if (role !== 'super' && role !== 'support') return null;
 return { admin_role: role, sub: parts[2] };
}

function problem(reply: any, status: number, type: string, title: string, detail: string, traceId: string) {
 reply.code(status);
 reply.header('content-type', 'application/problem+json');
 return reply.send({ type, title, status, detail, instance: reply.request.url, traceId });
}

function getTenant(req: { headers: Record<string, string | string[] | undefined> }): string {
 const t = req.headers['x-tenant-id'];
 return (Array.isArray(t) ? (t[0] ?? '') : (t ?? '')).toString().trim();
}

function getIdemKey(req: { headers: Record<string, string | string[] | undefined> }): string {
 const k = req.headers['x-idempotency-key'];
 return (Array.isArray(k) ? (k[0] ?? '') : (k ?? '')).toString().trim();
}

export async function buildAdminServer(deps: BuildServerDeps = {}): Promise<any> {
 const app = Fastify({ logger: false, disableRequestLogging: true });
 installRequestIdPlugin(app);
 const repo = new InMemoryAdminRepository();
 const audit = new AuditLogger(repo);
 const health = new HealthChecker();
 const service = deps.service ?? new AdminService(repo, audit, health);

 // Admin auth middleware
 app.addHook('preHandler', async (req: any, reply: any) => {
 const url = req.url ?? '';
 if (!url.startsWith('/v1/admin/')) return; // public /v1/health passes through
 if (url === '/v1/admin/health') return; // health endpoint is public
 const claims = readAdminClaims(req);
 if (!claims) {
 return problem(reply, 401,
 'https://sthyra-crm.dev/errors/unauthorized',
 'Unauthorized', 'Admin Bearer token required (format: "Bearer admin:<role>:<user_id>")',
 currentRequestId() || rid());
 }
 (req as any).adminClaims = claims;
 });

 app.get('/v1/health', async () => ({ status: 'ok', service: 'admin' }));

 // FR-1: List tenants
 app.get('/v1/admin/tenants', async (req: any, reply: any) => {
 const traceId = rid();
 const q = req.query as { cursor?: string; limit?: string; region?: any; status?: any };
 const limit = q.limit ? Math.min(200, Math.max(1, parseInt(q.limit, 10))) : 50;
 const filter: any = {};
 if (q.region) filter.region = q.region;
 if (q.status) filter.status = q.status;
 const result = await service.listTenants(filter, { cursor: q.cursor, limit });
 return { data: result.items, nextCursor: result.nextCursor };
 });

 // FR-2: Create tenant
 app.post('/v1/admin/tenants', async (req: any, reply: any) => {
 const traceId = rid();
 const claims = (req as any).adminClaims;
 if (!claims) return problem(reply, 401, 'https://sthyra-crm.dev/errors/unauthorized', 'Unauthorized', 'admin_role required', traceId);
 const idem = getIdemKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', traceId);
 const body = req.body as { name?: string; region?: string; plan?: string };
 if (!body.name || !body.region || !body.plan) {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', 'name, region, plan required', traceId);
 }
 const reason = ((req.headers['x-admin-reason'] as string) ?? '').trim() || 'no reason provided';
 const t = await service.createTenant(
 { name: body.name, region: body.region as any, plan: body.plan as any },
 { actorId: claims.sub ?? 'unknown', reason }
 );
 reply.code(201);
 return t;
 });

 // FR-3: Suspend/Resume
 app.post('/v1/admin/tenants/:id/suspend', async (req: any, reply: any) => {
 const traceId = rid();
 const claims = (req as any).adminClaims;
 const idem = getIdemKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', traceId);
 const id = ((req.params as any).id ?? '').trim();
 const reason = ((req.headers['x-admin-reason'] as string) ?? '').trim() || 'no reason provided';
 const t = await service.suspendTenant(id, { actorId: claims.sub ?? 'unknown', reason });
 if (!t) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Not Found', 'tenant not found', traceId);
 return t;
 });

 app.post('/v1/admin/tenants/:id/resume', async (req: any, reply: any) => {
 const traceId = rid();
 const claims = (req as any).adminClaims;
 const idem = getIdemKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', traceId);
 const id = ((req.params as any).id ?? '').trim();
 const reason = ((req.headers['x-admin-reason'] as string) ?? '').trim() || 'no reason provided';
 const t = await service.resumeTenant(id, { actorId: claims.sub ?? 'unknown', reason });
 if (!t) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Not Found', 'tenant not found', traceId);
 return t;
 });

 // FR-4: List users
 app.get('/v1/admin/users', async (req: any, reply: any) => {
 const traceId = rid();
 const q = req.query as { cursor?: string; limit?: string; tenantId?: string; role?: any };
 const limit = q.limit ? Math.min(200, Math.max(1, parseInt(q.limit, 10))) : 50;
 const filter: any = {};
 if (q.tenantId) filter.tenantId = q.tenantId;
 if (q.role) filter.role = q.role;
 const result = await service.listUsers(filter, { cursor: q.cursor, limit });
 return { data: result.items, nextCursor: result.nextCursor };
 });

 // FR-5: Force logout
 app.post('/v1/admin/users/:id/logout', async (req: any, reply: any) => {
 const traceId = rid();
 const claims = (req as any).adminClaims;
 const idem = getIdemKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', traceId);
 const id = ((req.params as any).id ?? '').trim();
 const reason = ((req.headers['x-admin-reason'] as string) ?? '').trim() || 'no reason provided';
 const ok = await service.forceLogout(id, { actorId: claims.sub ?? 'unknown', reason });
 if (!ok) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Not Found', 'user not found', traceId);
 return { ok: true };
 });

 // FR-6: Reset password
 app.post('/v1/admin/users/:id/reset-password', async (req: any, reply: any) => {
 const traceId = rid();
 const claims = (req as any).adminClaims;
 const idem = getIdemKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', traceId);
 const id = ((req.params as any).id ?? '').trim();
 const reason = ((req.headers['x-admin-reason'] as string) ?? '').trim() || 'no reason provided';
 const result = await service.resetPassword(id, { actorId: claims.sub ?? 'unknown', reason });
 if (!result) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Not Found', 'user not found', traceId);
 return result;
 });

 // FR-7: Audit log
 app.get('/v1/admin/audit', async (req: any, reply: any) => {
 const traceId = rid();
 const q = req.query as { cursor?: string; limit?: string; actorId?: string; actionType?: string; since?: string };
 const limit = q.limit ? Math.min(200, Math.max(1, parseInt(q.limit, 10))) : 50;
 const filter: any = {};
 if (q.actorId) filter.actorId = q.actorId;
 if (q.actionType) filter.actionType = q.actionType;
 if (q.since) filter.since = new Date(q.since);
 const result = await service.listAudit(filter, { cursor: q.cursor, limit });
 return { data: result.items, nextCursor: result.nextCursor };
 });

 // FR-8: Feature flags
 app.get('/v1/admin/feature-flags', async () => {
 return { data: await service.listFeatureFlags() };
 });

 app.put('/v1/admin/feature-flags/:key', async (req: any, reply: any) => {
 const traceId = rid();
 const claims = (req as any).adminClaims;
 const idem = getIdemKey(req);
 if (!idem) return problem(reply, 400, 'https://sthyra-crm.dev/errors/missing-idempotency-key', 'Missing Idempotency-Key', 'x-idempotency-key required', traceId);
 const key = ((req.params as any).key ?? '').trim();
 const body = req.body as { tenantId?: string | null; enabled?: boolean };
 if (typeof body.enabled !== 'boolean') {
 return problem(reply, 400, 'https://sthyra-crm.dev/errors/invalid-input', 'Invalid input', 'enabled (boolean) required', traceId);
 }
 const reason = ((req.headers['x-admin-reason'] as string) ?? '').trim() || 'no reason provided';
 const f = await service.setFeatureFlag(key, body.tenantId ?? null, body.enabled, {
 actorId: claims.sub ?? 'unknown',
 reason,
 });
 if (!f) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Not Found', 'feature flag not found', traceId);
 return f;
 });

 // FR-9: System health
 app.get('/v1/admin/health', async () => {
 return await service.systemHealth();
 });

 // FR-10: Tenant stats
 app.get('/v1/admin/tenants/:id/stats', async (req: any, reply: any) => {
 const traceId = rid();
 const id = ((req.params as any).id ?? '').trim();
 const tenant = await service.findTenant(id);
 if (!tenant) return problem(reply, 404, 'https://sthyra-crm.dev/errors/not-found', 'Not Found', 'tenant not found', traceId);
 return await service.tenantStats(id);
 });

 return app;
}
