import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildDashboardServer } from './http.js';
import { StubDashboardFetcher } from './service.js';

const TENANT = 'org_a';

let app: FastifyInstance;
let fetcher: StubDashboardFetcher;

beforeEach(async () => {
 fetcher = new StubDashboardFetcher();
 fetcher.projectsByOrg.set(TENANT, [
 { id: 'p1', orgId: TENANT, name: 'Project A', status: 'active', progressPct: 47 },
 ]);
 fetcher.issuesByProject.set('p1', [
 { id: 'i1', projectId: 'p1', title: 'Issue 1', status: 'open', kind: 'punch', trade: 'plumbing', severity: 'high', createdAt: new Date() },
 ]);
 fetcher.milestonesByProject.set('p1', [
 { id: 'm1', projectId: 'p1', name: 'Foundation', status: 'completed', plannedDate: new Date('2026-09-01'), actualDate: new Date('2026-09-02') },
 ]);
 app = await buildDashboardServer({ fetcher });
});

describe('Dashboard HTTP — /v1/health', () => {
 it('200 OK', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/health' });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'ok');
 });
});

describe('Dashboard HTTP — FR-1 GET / (home)', () => {
 it('401 when tenant missing', async () => {
 const res = await app.inject({ method: 'GET', url: '/' });
 assert.equal(res.statusCode, 401);
 assert.match(res.headers['content-type'], /text\/html/);
 });

 it('200 HTML with project cards when tenant present', async () => {
 const res = await app.inject({
 method: 'GET', url: '/',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.match(res.headers['content-type'], /text\/html/);
 assert.ok(res.body.includes('Project A'));
 });

 it('empty state shows "No projects"', async () => {
 const emptyFetcher = new StubDashboardFetcher();
 const emptyApp = await buildDashboardServer({ fetcher: emptyFetcher });
 const res = await emptyApp.inject({
 method: 'GET', url: '/',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.ok(res.body.includes('No projects'));
 });
});

describe('Dashboard HTTP — FR-2 GET /projects/:projectId', () => {
 it('200 with project detail', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Project A'));
 assert.ok(res.body.includes('Milestones'));
 });

 it('renders 404 for missing project', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/missing',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200); // SSR HTML
 assert.ok(res.body.includes('404'));
 });
});

describe('Dashboard HTTP — FR-3 GET /projects/:projectId/issues', () => {
 it('200 with issues table', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1/issues',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Issue 1'));
 });

 it('filter by status', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1/issues?status=open',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Issue 1'));
 });
});

describe('Dashboard HTTP — FR-4 GET /projects/:projectId/issues/:issueId', () => {
 it('200 with issue detail', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1/issues/i1',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Issue 1'));
 });

 it('renders 404 for missing issue', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1/issues/missing',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.ok(res.body.includes('404'));
 });
});

describe('Dashboard HTTP — FR-5 GET/POST /projects/:projectId/copilot', () => {
 it('GET renders form', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1/copilot',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('<form'));
 });

 it('POST renders reply', async () => {
 const res = await app.inject({
 method: 'POST', url: '/projects/p1/copilot',
 headers: { 'x-tenant-id': TENANT, 'content-type': 'application/json' },
 payload: { text: 'show issues' },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Echo: show issues'));
 });

 it('POST without text returns 400', async () => {
 const res = await app.inject({
 method: 'POST', url: '/projects/p1/copilot',
 headers: { 'x-tenant-id': TENANT, 'content-type': 'application/json' },
 payload: {},
 });
 assert.equal(res.statusCode, 400);
 });
});

describe('Dashboard HTTP — FR-6 reports', () => {
 it('GET daily report', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1/reports/daily?date=2026-09-01',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Daily report'));
 });

 it('GET weekly report', async () => {
 const res = await app.inject({
 method: 'GET', url: '/orgs/' + TENANT + '/reports/weekly',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Weekly report'));
 });
});

describe('Dashboard HTTP — FR-7 milestones', () => {
 it('GET milestones table', async () => {
 const res = await app.inject({
 method: 'GET', url: '/projects/p1/milestones',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Foundation'));
 });
});

describe('Dashboard HTTP — FR-8 workflows + integrations', () => {
 it('GET workflows', async () => {
 fetcher.workflowsByOrg.set(TENANT, [
 { id: 'wf_1', name: 'Escalate', enabled: true, runCount: 5, lastRunAt: new Date() },
 ]);
 const res = await app.inject({
 method: 'GET', url: '/orgs/' + TENANT + '/workflows',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('Escalate'));
 });

 it('GET integrations', async () => {
 fetcher.integrationsByOrg.set(TENANT, [
 { id: 'int_1', provider: 'procore', status: 'connected', connectedAt: new Date() },
 ]);
 const res = await app.inject({
 method: 'GET', url: '/orgs/' + TENANT + '/integrations',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 200);
 assert.ok(res.body.includes('procore'));
 });

 it('workflows tenant mismatch → 404', async () => {
 const res = await app.inject({
 method: 'GET', url: '/orgs/org_b/workflows',
 headers: { 'x-tenant-id': TENANT },
 });
 assert.equal(res.statusCode, 404);
 });
});
