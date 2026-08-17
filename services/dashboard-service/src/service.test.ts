import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { DashboardService, StubDashboardFetcher } from './service.js';

let fetcher: StubDashboardFetcher;
let service: DashboardService;

beforeEach(() => {
 fetcher = new StubDashboardFetcher();
 service = new DashboardService(fetcher);
});

describe('DashboardService.renderHome (FR-1)', () => {
 it('renders empty state when no projects', async () => {
 const html = await service.renderHome('org_a');
 assert.match(html, /<title>Projects — Sthyra CRM<\/title>/);
 assert.ok(html.includes('No projects yet'));
 });

 it('renders project cards', async () => {
 fetcher.projectsByOrg.set('org_a', [
 { id: 'p1', orgId: 'org_a', name: 'Project A', status: 'active', progressPct: 47 },
 { id: 'p2', orgId: 'org_a', name: 'Project B', status: 'at_risk', progressPct: 12 },
 ]);
 const html = await service.renderHome('org_a');
 assert.ok(html.includes('Project A'));
 assert.ok(html.includes('Project B'));
 assert.ok(html.includes('47%'));
 assert.ok(html.includes('at_risk'));
 });

 it('escapes HTML in project names', async () => {
 fetcher.projectsByOrg.set('org_a', [
 { id: 'p1', orgId: 'org_a', name: '<script>alert(1)</script>', status: 'active', progressPct: 0 },
 ]);
 const html = await service.renderHome('org_a');
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('<script>alert'));
 });
});

describe('DashboardService.renderProject (FR-2)', () => {
 it('renders 404 for missing project', async () => {
 const html = await service.renderProject('org_a', 'p1');
 assert.ok(html.includes('404'));
 });

 it('renders project detail with all sections', async () => {
 fetcher.projectsByOrg.set('org_a', [
 { id: 'p1', orgId: 'org_a', name: 'Project A', status: 'active', progressPct: 47 },
 ]);
 fetcher.milestonesByProject.set('p1', [
 { id: 'm1', projectId: 'p1', name: 'Foundation', status: 'completed', plannedDate: new Date('2026-09-01'), actualDate: new Date('2026-09-01') },
 ]);
 fetcher.capturesByProject.set('p1', [
 { id: 'c1', projectId: 'p1', status: 'ready', createdAt: new Date() },
 ]);
 fetcher.issuesByProject.set('p1', [
 { id: 'i1', projectId: 'p1', title: 'Issue 1', status: 'open', kind: 'punch', trade: 'plumbing', severity: 'high', createdAt: new Date() },
 ]);
 const html = await service.renderProject('org_a', 'p1');
 assert.ok(html.includes('Project A'));
 assert.ok(html.includes('Milestones'));
 assert.ok(html.includes('Captures'));
 assert.ok(html.includes('Issues'));
 assert.ok(html.includes('Punch Closeout'));
 });
});

describe('DashboardService.renderIssues (FR-3)', () => {
 it('renders issues table', async () => {
 fetcher.issuesByProject.set('p1', [
 { id: 'i1', projectId: 'p1', title: 'Issue 1', status: 'open', kind: 'standard', trade: null, severity: 'high', createdAt: new Date() },
 ]);
 const html = await service.renderIssues('org_a', 'p1');
 assert.ok(html.includes('Issue 1'));
 assert.ok(html.includes('high'));
 });

 it('filters by status', async () => {
 fetcher.issuesByProject.set('p1', [
 { id: 'i1', projectId: 'p1', title: 'Open', status: 'open', kind: 'standard', trade: null, severity: 'low', createdAt: new Date() },
 { id: 'i2', projectId: 'p1', title: 'Closed', status: 'closed', kind: 'standard', trade: null, severity: 'low', createdAt: new Date() },
 ]);
 const html = await service.renderIssues('org_a', 'p1', 'open');
 assert.ok(html.includes('Open'));
 assert.ok(!html.includes('Closed'));
 });
});

describe('DashboardService.renderIssue (FR-4)', () => {
 it('renders 404 for missing issue', async () => {
 const html = await service.renderIssue('org_a', 'p1', 'i1');
 assert.ok(html.includes('404'));
 });

 it('renders issue detail with history', async () => {
 fetcher.issuesByProject.set('p1', [
 { id: 'i1', projectId: 'p1', title: 'Issue 1', status: 'resolved', kind: 'standard', trade: null, severity: 'medium', createdAt: new Date() },
 ]);
 fetcher.statusHistoryByIssue.set('i1', [
 { id: 1, fromStatus: 'open', toStatus: 'resolved', actorId: 'pm_1', reason: 'fixed', occurredAt: new Date() },
 ]);
 fetcher.commentsByIssue.set('i1', [
 { id: 'c1', issueId: 'i1', authorId: 'user_1', text: 'Looks good', createdAt: new Date() },
 ]);
 const html = await service.renderIssue('org_a', 'p1', 'i1');
 assert.ok(html.includes('Issue 1'));
 assert.ok(html.includes('Status history'));
 assert.ok(html.includes('open → resolved'));
 assert.ok(html.includes('Looks good'));
 });
});

describe('DashboardService.renderCopilot (FR-5)', () => {
 it('renders form when GET', async () => {
 const html = await service.renderCopilotForm('org_a', 'p1');
 assert.ok(html.includes('<form'));
 assert.ok(html.includes('input type="text"'));
 });

 it('renders reply when POST', async () => {
 const html = await service.renderCopilotReply('org_a', 'p1', 'show open issues');
 assert.ok(html.includes('Echo: show open issues'));
 assert.ok(html.includes('list_issues'));
 });
});

describe('DashboardService.renderReports (FR-6)', () => {
 it('renders daily report', async () => {
 fetcher.dailyReports.set('p1', {
 date: '2026-09-01', projectId: 'p1',
 captures: { total: 3, processed: 2, failed: 1 },
 issues: { opened: 5, resolved: 2, open: 12 },
 progress: { punchCompletionPct: 67, projectProgressPct: 47 },
 milestones: { completed: 1, overdue: 0 },
 });
 const html = await service.renderDailyReport('org_a', 'p1', new Date('2026-09-01T00:00:00Z'));
 assert.ok(html.includes('2026-09-01'));
 assert.ok(html.includes('Captures'));
 });

 it('renders weekly report', async () => {
 const html = await service.renderWeeklyReport('org_a');
 assert.ok(html.includes('Weekly report'));
 });
});

describe('DashboardService.renderMilestones (FR-7)', () => {
 it('renders milestones table', async () => {
 fetcher.milestonesByProject.set('p1', [
 { id: 'm1', projectId: 'p1', name: 'Foundation', status: 'completed', plannedDate: new Date('2026-09-01'), actualDate: new Date('2026-09-02') },
 ]);
 const html = await service.renderMilestones('org_a', 'p1');
 assert.ok(html.includes('Foundation'));
 });
});

describe('DashboardService.renderWorkflows + Integrations (FR-8)', () => {
 it('renders workflows', async () => {
 fetcher.workflowsByOrg.set('org_a', [
 { id: 'wf_1', name: 'Escalate', enabled: true, runCount: 5, lastRunAt: new Date() },
 ]);
 const html = await service.renderWorkflows('org_a');
 assert.ok(html.includes('Escalate'));
 assert.ok(html.includes('✅'));
 });

 it('renders integrations', async () => {
 fetcher.integrationsByOrg.set('org_a', [
 { id: 'int_1', provider: 'procore', status: 'connected', connectedAt: new Date() },
 ]);
 const html = await service.renderIntegrations('org_a');
 assert.ok(html.includes('procore'));
 assert.ok(html.includes('connected'));
 });
});
