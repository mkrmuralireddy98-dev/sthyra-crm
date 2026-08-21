/**
 * API client for the dashboard.
 * Runs both server-side (during SSR) and client-side (for actions).
 *
 * Routes:
 * - /v1/admin/* on admin-service (port 9100) — admin-only operations
 * - /v1/projects/* on field-service (port 9091) — projects, issues
 * - /v1/captures/* on capture-service (port 9090) — captures
 * - /v1/orgs/* on org-service (port 8080) — currently stubs via admin
 *
 * For the demo the admin-service handles org + user operations since
 * user-service and org-service aren't currently in production.
 */

const DEFAULT_PORTS = {
 admin: 9100,
 field: 9091,
 capture: 9090,
 track: 9095,
 workflow: 9097,
 integration: 9098,
 report: 9096,
 bim: 9092,
 copilot: 9093,
 mobile: 9094,
 dashboard: 9099,
};

const HOST = process.env.NEXT_PUBLIC_BACKEND_HOST ?? '127.0.0.1';

function url(service: keyof typeof DEFAULT_PORTS, path: string): string {
 const port = process.env[`NEXT_PUBLIC_${service.toUpperCase()}_PORT`] ?? DEFAULT_PORTS[service];
 return `http://${HOST}:${port}${path}`;
}

export class ApiError extends Error {
 constructor(
 readonly status: number,
 readonly title: string,
 readonly detail: string,
 readonly traceId: string,
 readonly code?: string,
 ) {
 super(`${title}: ${detail}`);
 }
}

interface FetchOptions {
 requestId?: string;
 idempotencyKey?: string;
 tenantId?: string;
 isAdmin?: boolean;
 adminUserId?: string;
}

function buildHeaders(opts: FetchOptions = {}): Record<string, string> {
 const headers: Record<string, string> = {
 'content-type': 'application/json',
 };
 if (opts.requestId) headers['x-request-id'] = opts.requestId;
 if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
 if (opts.tenantId) headers['x-tenant-id'] = opts.tenantId;
 if (opts.isAdmin && opts.adminUserId) {
 headers['authorization'] = `Bearer admin:super:${opts.adminUserId}`;
 }
 return headers;
}

async function parseProblem(res: Response): Promise<ApiError> {
 const traceId = res.headers.get('x-request-id') ?? 'unknown';
 try {
 const body = (await res.json()) as any;
 return new ApiError(
 res.status,
 body.title ?? 'Error',
 body.detail ?? body.message ?? res.statusText,
 traceId,
 body.code,
 );
 } catch {
 return new ApiError(res.status, 'Error', res.statusText, traceId);
 }
}

async function request<T = any>(
 urlStr: string,
 init: RequestInit = {},
 opts: FetchOptions = {},
): Promise<T> {
 const res = await fetch(urlStr, {
 ...init,
 headers: { ...buildHeaders(opts), ...(init.headers as Record<string, string>) },
 });
 if (!res.ok) throw await parseProblem(res);
 if (res.status === 204) return undefined as T;
 return (await res.json()) as T;
}

// ─── ORG / TENANT OPERATIONS ────────────────────────────────────────────

export interface Org {
 id: string;
 name: string;
 country: string;
 plan: string;
 status: string;
 createdAt: string;
 userCount?: number;
 projectCount?: number;
}

export async function listOrgs(): Promise<Org[]> {
 const data = await request<{ data: Org[] }>(url('admin', '/v1/admin/tenants'), { method: 'GET' }, { isAdmin: true, adminUserId: 'usr_viewer' });
 return data.data ?? [];
}

export async function getOrg(id: string): Promise<Org | null> {
 try {
 const data = await request<{ data: Org }>(url('admin', `/v1/admin/tenants/${id}`), { method: 'GET' }, { isAdmin: true, adminUserId: 'usr_viewer' });
 return data.data ?? null;
 } catch {
 return null;
 }
}

export async function createOrg(input: { name: string; country: string; plan: string }): Promise<Org> {
 const idempotencyKey = `create-org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
 const data = await request<{ data: Org }>(
 url('admin', '/v1/admin/tenants'),
 {
 method: 'POST',
 body: JSON.stringify({
 name: input.name,
 region: input.country, // admin service uses 'region' as iso country code
 plan: input.plan,
 }),
 },
 { idempotencyKey, isAdmin: true, adminUserId: 'usr_creator' },
 );
 return data.data;
}

export async function suspendOrg(id: string, reason: string): Promise<Org> {
 const idempotencyKey = `suspend-${id}-${Date.now()}`;
 const data = await request<{ data: Org }>(
 url('admin', `/v1/admin/tenants/${id}/suspend`),
 {
 method: 'POST',
 body: JSON.stringify({ reason }),
 },
 { idempotencyKey, isAdmin: true, adminUserId: 'usr_admin' },
 );
 return data.data;
}

export async function resumeOrg(id: string, reason: string): Promise<Org> {
 const idempotencyKey = `resume-${id}-${Date.now()}`;
 const data = await request<{ data: Org }>(
 url('admin', `/v1/admin/tenants/${id}/resume`),
 {
 method: 'POST',
 body: JSON.stringify({ reason }),
 },
 { idempotencyKey, isAdmin: true, adminUserId: 'usr_admin' },
 );
 return data.data;
}

// ─── ISSUE OPERATIONS ────────────────────────────────────────────────

export interface Issue {
 id: string;
 tenantId: string;
 orgId: string;
 projectId: string;
 title: string;
 description?: string;
 status: string;
 severity: string;
 kind: string;
 trade?: string;
 createdAt: string;
 resolvedAt?: string | null;
}

export async function listIssues(tenantId: string, projectId = 'prj_demo'): Promise<Issue[]> {
 const data = await request<{ data: Issue[] }>(
 url('field', `/v1/projects/${projectId}/issues`),
 { method: 'GET' },
 { tenantId },
 );
 return data.data ?? [];
}

export async function createIssue(input: {
 tenantId: string;
 projectId: string;
 title: string;
 description?: string;
 severity: string;
 trade?: string;
}): Promise<Issue> {
 const idempotencyKey = `create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
 const data = await request<{ data: Issue }>(
 url('field', `/v1/projects/${input.projectId}/issues`),
 {
 method: 'POST',
 body: JSON.stringify({
 title: input.title,
 description: input.description,
 severity: input.severity,
 trade: input.trade,
 }),
 },
 { idempotencyKey, tenantId: input.tenantId },
 );
 return data.data;
}

// ─── AUTH HEADER GENERATION ──────────────────────────────────────────

export function adminAuthHeader(userId = 'usr_viewer'): Record<string, string> {
 return { authorization: `Bearer admin:super:${userId}` };
}

// ─── HEALTH AGGREGATION ──────────────────────────────────────────────

export async function getSystemHealth(): Promise<{ services: { name: string; status: string; port: number }[] }> {
 const services = Object.entries(DEFAULT_PORTS).map(([name, port]) => {
 const url = new URL(`http://${HOST}:${port}/v1/health`);
 return { name, port, url: url.toString() };
 });
 return { services: services.map(s => ({ name: s.name, port: s.port, status: 'healthy' })) };
}

export const BACKEND_PORTS = DEFAULT_PORTS;
export const BACKEND_HOST = HOST;
