import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { routeTools, type ToolRouterDeps } from './tool-router.js';
import type { Intent } from './types.js';

function makeFakeFetch(responses: Array<{ url: string; status?: number; body?: unknown }>): typeof fetch {
 return (async (url: string, _init?: RequestInit) => {
 const r = responses.find((x) => url.startsWith(x.url));
 if (!r) throw new Error(`unexpected fetch to ${url}`);
 const status = r.status ?? 200;
 return {
 ok: status < 400,
 status,
 json: async () => r.body ?? {},
 } as unknown as Response;
 }) as typeof fetch;
}

const deps: ToolRouterDeps = {
 fetchFn: makeFakeFetch([]),
 captureServiceUrl: 'http://capture',
 fieldServiceUrl: 'http://field',
 bimViewerServiceUrl: 'http://bim',
};

describe('Tool router (T-010 to T-013)', () => {
 it('list_issues calls issue.list on field-service', async () => {
 const intent: Intent = { type: 'list_issues', slots: { status: 'open' }, confidence: 0.9 };
 let capturedUrl = '';
 const d: ToolRouterDeps = {
 ...deps,
 fetchFn: (async (url) => {
 capturedUrl = url;
 return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) } as unknown as Response;
 }) as typeof fetch,
 };
 const r = await routeTools(intent, d, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(r.calls.length, 1);
 assert.equal(r.calls[0]?.tool, 'issue.list');
 assert.match(capturedUrl, /\/v1\/projects\/prj_1\/issues/);
 assert.match(capturedUrl, /status=open/);
 });

 it('list_captures calls capture.list on capture-service', async () => {
 const intent: Intent = { type: 'list_captures', slots: {}, confidence: 0.9 };
 let capturedUrl = '';
 const d: ToolRouterDeps = {
 ...deps,
 fetchFn: (async (url) => {
 capturedUrl = url;
 return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) } as unknown as Response;
 }) as typeof fetch,
 };
 const r = await routeTools(intent, d, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(r.calls.length, 1);
 assert.equal(r.calls[0]?.tool, 'capture.list');
 assert.match(capturedUrl, /\/v1\/projects\/prj_1\/captures/);
 });

 it('lookup_element POSTs coordinates to bim-viewer', async () => {
 const intent: Intent = { type: 'lookup_element', slots: { x: 1.5, y: 2.5, z: 0.5 }, confidence: 0.95 };
 let capturedMethod = '';
 let capturedUrl = '';
 let capturedBody = '';
 const d: ToolRouterDeps = {
 ...deps,
 fetchFn: (async (url, init) => {
 capturedMethod = init?.method ?? '';
 capturedUrl = url;
 capturedBody = init?.body as string ?? '';
 return { ok: true, status: 200, json: async () => ({ elementId: 'b1', elementName: 'B', elementType: 'IfcBeam', distance: 0.1 }) } as unknown as Response;
 }) as typeof fetch,
 };
 const r = await routeTools(intent, d, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(r.calls.length, 1);
 assert.equal(capturedMethod, 'POST');
 assert.match(capturedUrl, /element-lookup/);
 assert.match(capturedBody, /1\.5/);
 });

 it('lookup_element returns error when coordinates missing', async () => {
 const intent: Intent = { type: 'lookup_element', slots: { x: 1.5 }, confidence: 0.5 };
 const r = await routeTools(intent, deps, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(r.calls.length, 0);
 assert.equal(r.errors.length, 1);
 assert.equal(r.errors[0]?.tool, 'bim.lookup_element');
 });

 it('summarize_project fans out to 2 services in parallel', async () => {
 const intent: Intent = { type: 'summarize_project', slots: {}, confidence: 0.9 };
 const d: ToolRouterDeps = {
 ...deps,
 fetchFn: makeFakeFetch([
 { url: 'http://capture', body: { items: [], total: 4 } },
 { url: 'http://field', body: { items: [], total: 23 } },
 ]),
 };
 const r = await routeTools(intent, d, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(r.calls.length, 2);
 const tools = r.calls.map((c) => c.tool).sort();
 assert.deepEqual(tools, ['capture.list', 'issue.list']);
 });

 it('clarify intent produces no tool calls', async () => {
 const intent: Intent = { type: 'clarify', slots: {}, confidence: 0.3 };
 const r = await routeTools(intent, deps, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(r.calls.length, 0);
 assert.equal(r.errors.length, 0);
 });

 it('tool 500 returns error in errors array', async () => {
 const intent: Intent = { type: 'list_issues', slots: {}, confidence: 0.9 };
 const d: ToolRouterDeps = {
 ...deps,
 fetchFn: (async () => ({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) } as unknown as Response)) as typeof fetch,
 };
 const r = await routeTools(intent, d, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(r.calls.length, 0);
 assert.equal(r.errors.length, 1);
 assert.equal(r.errors[0]?.tool, 'issue.list');
 });

 it('x-tenant-id header is set on every fetch', async () => {
 const intent: Intent = { type: 'list_issues', slots: {}, confidence: 0.9 };
 let capturedHeaders: Record<string, string> | undefined;
 const d: ToolRouterDeps = {
 ...deps,
 fetchFn: (async (_url, init) => {
 capturedHeaders = init?.headers as Record<string, string>;
 return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) } as unknown as Response;
 }) as typeof fetch,
 };
 await routeTools(intent, d, { orgId: 'org_a', projectId: 'prj_1' });
 assert.equal(capturedHeaders?.['x-tenant-id'], 'org_a');
 });
});
