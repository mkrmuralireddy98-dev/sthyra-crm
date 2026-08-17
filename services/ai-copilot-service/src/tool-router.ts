/**
 * Tool router — routes intents to downstream service calls.
 */

import type { Intent, ToolCall, ToolError } from './types.js';

export interface ToolRouterDeps {
 readonly fetchFn: typeof fetch;
 readonly captureServiceUrl: string;
 readonly fieldServiceUrl: string;
 readonly bimViewerServiceUrl: string;
}

interface ListResponse { items?: unknown[]; total?: number; }

interface BimLookupResponse {
 elementId: string | null;
 elementName: string | null;
 elementType: string | null;
 distance: number;
}

async function safeFetch(
 fetchFn: typeof fetch,
 url: string,
 init: RequestInit,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
 try {
 const res = await fetchFn(url, init);
 if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
 return { ok: true, value: await res.json() };
 } catch (e) {
 return { ok: false, error: (e as Error).message };
 }
}

async function routeCaptureList(
 deps: ToolRouterDeps,
 orgId: string,
 projectId: string,
 status: string | undefined,
): Promise<{ ok: true; call: ToolCall } | { ok: false; error: ToolError }> {
 const headers = { 'x-tenant-id': orgId };
 const input: Record<string, unknown> = { projectId };
 if (status) input['status'] = status;
 const qs = status ? '?status=' + encodeURIComponent(status) : '';
 const url = `${deps.captureServiceUrl}/v1/projects/${projectId}/captures${qs}`;
 const result = await safeFetch(deps.fetchFn, url, { method: 'GET', headers });
 if (!result.ok) return { ok: false, error: { tool: 'capture.list', error: result.error } };
 const data = result.value as ListResponse;
 const items = data.items ?? [];
 const call: ToolCall = {
 tool: 'capture.list',
 input,
 output: { items, total: data.total ?? items.length },
 };
 return { ok: true, call };
}

async function routeIssueList(
 deps: ToolRouterDeps,
 orgId: string,
 projectId: string,
 filters: { status?: string; severity?: string },
): Promise<{ ok: true; call: ToolCall } | { ok: false; error: ToolError }> {
 const headers = { 'x-tenant-id': orgId };
 const params = new URLSearchParams();
 if (filters.status) params.set('status', filters.status);
 if (filters.severity) params.set('severity', filters.severity);
 const qs = params.toString();
 const url = `${deps.fieldServiceUrl}/v1/projects/${projectId}/issues${qs ? '?' + qs : ''}`;
 const result = await safeFetch(deps.fetchFn, url, { method: 'GET', headers });
 if (!result.ok) return { ok: false, error: { tool: 'issue.list', error: result.error } };
 const data = result.value as ListResponse;
 const items = data.items ?? [];
 const call: ToolCall = {
 tool: 'issue.list',
 input: { projectId, ...filters },
 output: { items, total: data.total ?? items.length },
 };
 return { ok: true, call };
}

async function routeBimLookup(
 deps: ToolRouterDeps,
 orgId: string,
 projectId: string,
 x: number, y: number, z: number,
): Promise<{ ok: true; call: ToolCall } | { ok: false; error: ToolError }> {
 const headers = { 'x-tenant-id': orgId, 'content-type': 'application/json' };
 const url = `${deps.bimViewerServiceUrl}/v1/projects/${projectId}/bim-model/element-lookup`;
 const result = await safeFetch(deps.fetchFn, url, {
 method: 'POST', headers,
 body: JSON.stringify({ x, y, z }),
 });
 if (!result.ok) return { ok: false, error: { tool: 'bim.lookup_element', error: result.error } };
 const data = result.value as BimLookupResponse;
 const call: ToolCall = { tool: 'bim.lookup_element', input: { projectId, x, y, z }, output: data };
 return { ok: true, call };
}

export async function routeTools(
 intent: Intent,
 deps: ToolRouterDeps,
 ctx: { orgId: string; projectId: string },
): Promise<{ calls: ToolCall[]; errors: ToolError[] }> {
 const calls: ToolCall[] = [];
 const errors: ToolError[] = [];

 switch (intent.type) {
 case 'list_issues': {
 const r = await routeIssueList(deps, ctx.orgId, ctx.projectId, {
 status: intent.slots['status'] as string | undefined,
 severity: intent.slots['severity'] as string | undefined,
 });
 if (r.ok) calls.push(r.call); else errors.push(r.error);
 break;
 }
 case 'list_captures': {
 const r = await routeCaptureList(deps, ctx.orgId, ctx.projectId, intent.slots['status'] as string | undefined);
 if (r.ok) calls.push(r.call); else errors.push(r.error);
 break;
 }
 case 'lookup_element': {
 const x = intent.slots['x'];
 const y = intent.slots['y'];
 const z = intent.slots['z'];
 if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
 const r = await routeBimLookup(deps, ctx.orgId, ctx.projectId, x, y, z);
 if (r.ok) calls.push(r.call); else errors.push(r.error);
 } else {
 errors.push({ tool: 'bim.lookup_element', error: 'missing x/y/z slots' });
 }
 break;
 }
 case 'summarize_project': {
 const [captureRes, issueRes] = await Promise.all([
 routeCaptureList(deps, ctx.orgId, ctx.projectId, undefined),
 routeIssueList(deps, ctx.orgId, ctx.projectId, {}),
 ]);
 for (const r of [captureRes, issueRes]) {
 if (r.ok) calls.push(r.call); else errors.push(r.error);
 }
 break;
 }
 case 'find_blockers': {
 const r = await routeIssueList(deps, ctx.orgId, ctx.projectId, { status: 'open' });
 if (r.ok) calls.push(r.call); else errors.push(r.error);
 break;
 }
 case 'clarify':
 break;
 }
 return { calls, errors };
}
