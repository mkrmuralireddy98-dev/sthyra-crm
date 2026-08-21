/**
 * Server-side API client.
 * Pages (server components) call this directly to backend services.
 *
 * Use this from server components (.tsx files with `export const dynamic = 'force-dynamic'`).
 * For client-side calls, use `@/lib/api` which goes through Next.js API routes.
 */

const HOST = process.env.BACKEND_HOST ?? '127.0.0.1';

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

function url(service: keyof typeof DEFAULT_PORTS, path: string): string {
 const port = process.env[`${service.toUpperCase()}_PORT`] ?? DEFAULT_PORTS[service];
 return `http://${HOST}:${port}${path}`;
}


function unwrap(response: any): any {
 if (response && typeof response === 'object' && 'data' in response) {
 return response.data;
 }
 return response;
}

function newIdempotencyKey(prefix: string): string {
 return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function call<T = any>(
 urlStr: string,
 init: RequestInit = {},
 headers: Record<string, string> = {},
): Promise<T> {
 const res = await fetch(urlStr, {
 ...init,
 headers: { ...headers, ...(init.headers as Record<string, string>) },
 cache: 'no-store',
 });
 if (!res.ok) {
 const text = await res.text().catch(() => '');
 throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
 }
 if (res.status === 204) return undefined as T;
 return (await res.json()) as T;
}

// ─── ORGS ────────────────────────────────────────────────────────

export interface Org {
 id: string;
 name: string;
 country?: string;
 region?: string;
 plan: string;
 status: string;
 createdAt: string;
 userCount?: number;
}

export async function listOrgs(): Promise<Org[]> {
 try {
 const data = await call<{ data: Org[] }>(
 url('admin', '/v1/admin/tenants'),
 { method: 'GET' },
 { authorization: `Bearer admin:super:usr_dashboard` },
 );
 return unwrap(data) ?? [];
 } catch (err) {
 console.error('[api-server] listOrgs failed:', err);
 return [];
 }
}

export async function createOrg(input: { name: string; country: string; plan: string }): Promise<Org | null> {
 try {
 const data = await call<{ data: Org }>(
 url('admin', '/v1/admin/tenants'),
 {
 method: 'POST',
 body: JSON.stringify({
 name: input.name,
 region: input.country,
 plan: input.plan,
 }),
 },
 {
 'x-idempotency-key': newIdempotencyKey('create-org'),
 authorization: `Bearer admin:super:usr_dashboard`,
 },
 );
 return data.data;
 } catch (err) {
 console.error('[api-server] createOrg failed:', err);
 return null;
 }
}

// ─── ISSUES ──────────────────────────────────────────────────────

export interface Issue {
 id: string;
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

export async function listIssues(orgId: string, projectId = 'prj_demo'): Promise<Issue[]> {
 try {
 const data = await call<{ data: Issue[] }>(
 url('field', `/v1/projects/${projectId}/issues`),
 { method: 'GET' },
 { 'x-tenant-id': orgId },
 );
 return unwrap(data) ?? [];
 } catch (err) {
 console.error('[api-server] listIssues failed:', err);
 return [];
 }
}

export async function createIssue(input: {
 tenantId: string;
 projectId?: string;
 title: string;
 description?: string;
 severity: string;
 trade?: string;
}): Promise<Issue | null> {
 try {
 const data = await call<{ data: Issue }>(
 url('field', `/v1/projects/${input.projectId ?? 'prj_demo'}/issues`),
 {
 method: 'POST',
 body: JSON.stringify({
 title: input.title,
 description: input.description,
 severity: input.severity,
 trade: input.trade,
 }),
 },
 {
 'x-idempotency-key': newIdempotencyKey('create-issue'),
 'x-tenant-id': input.tenantId,
 },
 );
 return data.data;
 } catch (err) {
 console.error('[api-server] createIssue failed:', err);
 return null;
 }
}
