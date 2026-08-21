/**
 * API client for the dashboard (client-side).
 * All calls go through Next.js API routes (which proxy to backend).
 *
 * NOTE on response format:
 * admin-service returns { data: [...] } for collections but bare entities for
 * single-item ops (POST/PATCH). The unwrap() helper handles both.
 */

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

function makeHeaders(opts: {
 tenantId?: string;
 idempotencyKey?: string;
 requestId?: string;
} = {}): Record<string, string> {
 const headers: Record<string, string> = {
 'content-type': 'application/json',
 };
 if (opts.tenantId) headers['x-tenant-id'] = opts.tenantId;
 if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
 if (opts.requestId) headers['x-request-id'] = opts.requestId;
 return headers;
}

/**
 * unwrap — admin-service returns either { data: T } or bare T depending on the route.
 * This helper normalizes so callers always get the entity.
 */
function unwrap<T>(response: any): T {
 if (response && typeof response === 'object' && 'data' in response) {
 return response.data as T;
 }
 return response as T;
}

async function request<T = any>(
 urlStr: string,
 init: RequestInit = {},
 headers: Record<string, string> = {},
): Promise<T> {
 const res = await fetch(urlStr, {
 ...init,
 headers: { ...headers, ...(init.headers as Record<string, string>) },
 });
 if (!res.ok) {
 const traceId = res.headers.get('x-request-id') ?? 'unknown';
 let body: any = {};
 try {
 body = await res.json();
 } catch {
 body = { detail: res.statusText };
 }
 throw new ApiError(
 res.status,
 body.title ?? 'Error',
 body.detail ?? body.message ?? res.statusText,
 traceId,
 body.code,
 );
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

function newIdempotencyKey(): string {
 return `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listOrgs(): Promise<Org[]> {
 const data = await request<any>('/api/admin/tenants', { method: 'GET' });
 return unwrap<Org[]>(data) ?? [];
}

export async function getOrg(id: string): Promise<Org | null> {
 try {
 const data = await request<any>(`/api/admin/tenants/${id}`, { method: 'GET' });
 return unwrap<Org>(data);
 } catch {
 return null;
 }
}

export async function createOrg(input: { name: string; country: string; plan: string }): Promise<Org> {
 const data = await request<any>(
 '/api/admin/tenants',
 {
 method: 'POST',
 body: JSON.stringify({
 name: input.name,
 region: input.country, // admin-service stores country in 'region' field
 plan: input.plan,
 }),
 },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
 return unwrap<Org>(data);
}

export async function suspendOrg(id: string, reason: string): Promise<Org> {
 const data = await request<any>(
 `/api/admin/tenants/${id}/suspend`,
 {
 method: 'POST',
 body: JSON.stringify({ reason }),
 },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
 return unwrap<Org>(data);
}

export async function resumeOrg(id: string, reason: string): Promise<Org> {
 const data = await request<any>(
 `/api/admin/tenants/${id}/resume`,
 {
 method: 'POST',
 body: JSON.stringify({ reason }),
 },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
 return unwrap<Org>(data);
}

export async function updateOrg(
 id: string,
 patch: { name?: string; country?: string; plan?: string; status?: string },
): Promise<Org> {
 const data = await request<any>(
 `/api/admin/tenants/${id}`,
 {
 method: 'PATCH',
 body: JSON.stringify({
 ...patch,
 region: patch.country, // admin-service stores country in 'region' field
 }),
 },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
 return unwrap<Org>(data);
}

export async function deleteOrg(id: string, reason: string): Promise<void> {
 await request<void>(
 `/api/admin/tenants/${id}`,
 {
 method: 'DELETE',
 },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
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

export async function listIssues(tenantId: string, projectId = 'prj_demo'): Promise<Issue[]> {
 const data = await request<any>(`/api/orgs/${tenantId}/issues`, { method: 'GET' });
 return unwrap<Issue[]>(data) ?? [];
}

export async function createIssue(input: {
 tenantId: string;
 projectId?: string;
 title: string;
 description?: string;
 severity: string;
 trade?: string;
}): Promise<Issue> {
 const data = await request<any>(
 `/api/orgs/${input.tenantId}/issues`,
 {
 method: 'POST',
 body: JSON.stringify({
 title: input.title,
 description: input.description,
 severity: input.severity,
 trade: input.trade,
 }),
 },
 makeHeaders({
 tenantId: input.tenantId,
 idempotencyKey: newIdempotencyKey(),
 }),
 );
 return unwrap<Issue>(data);
}


// ─── PROJECTS ────────────────────────────────────────────────────

export interface Project {
 id: string;
 tenantId: string;
 name: string;
 location: string;
 type: string;
 status: string;
 progressPct: number;
 createdAt: string;
}

export async function listProjects(orgId: string): Promise<Project[]> {
 const data = await request<any>(`/api/admin/tenants/${orgId}/projects`, { method: 'GET' });
 return unwrap<Project[]>(data) ?? [];
}

export async function createProject(input: {
 tenantId: string;
 name: string;
 location: string;
 type?: string;
}): Promise<Project> {
 const data = await request<any>(
 `/api/admin/tenants/${input.tenantId}/projects`,
 {
 method: 'POST',
 body: JSON.stringify({
 name: input.name,
 location: input.location,
 type: input.type ?? 'commercial',
 }),
 },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
 return unwrap<Project>(data);
}

export async function updateProject(tenantId: string, projectId: string, patch: { name?: string; location?: string; type?: string; status?: string; progressPct?: number }): Promise<Project> {
 const data = await request<any>(
 `/api/admin/tenants/${tenantId}/projects/${projectId}`,
 {
 method: 'PATCH',
 body: JSON.stringify(patch),
 },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
 return unwrap<Project>(data);
}

export async function deleteProject(tenantId: string, projectId: string): Promise<void> {
 await request<void>(
 `/api/admin/tenants/${tenantId}/projects/${projectId}`,
 { method: 'DELETE' },
 makeHeaders({ idempotencyKey: newIdempotencyKey() }),
 );
}
