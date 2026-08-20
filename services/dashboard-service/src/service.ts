/**
 * DashboardService — orchestrates downstream services + renders HTML pages.
 */

import { randomUUID } from 'node:crypto';
import { renderLayout, renderErrorPage, render404Page, renderBadge, escapeHtml } from './layout.js';
import type {
 ProjectSummary, IssueSummary, CaptureSummary, MilestoneSummary,
 ProgressSummary, StatusHistoryEntry, Comment, WorkflowSummary, IntegrationSummary,
 DailyReport, ProjectPageData, HomePageData,
} from './types.js';

/**
 * StubFetcher — tests inject deterministic data; prod wires real HTTP clients.
 */
export interface DashboardFetcher {
 fetchProjects(orgId: string): Promise<readonly ProjectSummary[]>;
 fetchProject(orgId: string, projectId: string): Promise<ProjectSummary | null>;
 fetchIssues(orgId: string, projectId: string, status?: string): Promise<readonly IssueSummary[]>;
 fetchIssue(orgId: string, projectId: string, issueId: string): Promise<IssueSummary | null>;
 fetchCaptures(orgId: string, projectId: string): Promise<readonly CaptureSummary[]>;
 fetchMilestones(orgId: string, projectId: string): Promise<readonly MilestoneSummary[]>;
 fetchProgress(orgId: string, projectId: string): Promise<readonly ProgressSummary[]>;
 fetchStatusHistory(orgId: string, issueId: string): Promise<readonly StatusHistoryEntry[]>;
 fetchComments(orgId: string, issueId: string): Promise<readonly Comment[]>;
 askCopilot(orgId: string, projectId: string, text: string): Promise<{ replyText: string; intent: string; latencyMs: number }>;
 fetchDailyReport(orgId: string, projectId: string, date: Date): Promise<DailyReport>;
 fetchWorkflows(orgId: string): Promise<readonly WorkflowSummary[]>;
 fetchIntegrations(orgId: string): Promise<readonly IntegrationSummary[]>;
}

export class StubDashboardFetcher implements DashboardFetcher {
 projectsByOrg = new Map<string, ProjectSummary[]>();
 issuesByProject = new Map<string, IssueSummary[]>();
 capturesByProject = new Map<string, CaptureSummary[]>();
 milestonesByProject = new Map<string, MilestoneSummary[]>();
 progressByProject = new Map<string, ProgressSummary[]>();
 workflowsByOrg = new Map<string, WorkflowSummary[]>();
 integrationsByOrg = new Map<string, IntegrationSummary[]>();
 statusHistoryByIssue = new Map<string, StatusHistoryEntry[]>();
 commentsByIssue = new Map<string, Comment[]>();
 dailyReports = new Map<string, DailyReport>();

 async fetchProjects(orgId: string): Promise<readonly ProjectSummary[]> {
 return this.projectsByOrg.get(orgId) ?? [];
 }
 async fetchProject(_orgId: string, projectId: string): Promise<ProjectSummary | null> {
 for (const list of this.projectsByOrg.values()) {
 const p = list.find((x) => x.id === projectId);
 if (p) return p;
 }
 return null;
 }
 async fetchIssues(_orgId: string, projectId: string, status?: string): Promise<readonly IssueSummary[]> {
 const list = this.issuesByProject.get(projectId) ?? [];
 return status ? list.filter((i) => i.status === status) : list;
 }
 async fetchIssue(_orgId: string, _projectId: string, issueId: string): Promise<IssueSummary | null> {
 for (const list of this.issuesByProject.values()) {
 const i = list.find((x) => x.id === issueId);
 if (i) return i;
 }
 return null;
 }
 async fetchCaptures(_orgId: string, projectId: string): Promise<readonly CaptureSummary[]> {
 return this.capturesByProject.get(projectId) ?? [];
 }
 async fetchMilestones(_orgId: string, projectId: string): Promise<readonly MilestoneSummary[]> {
 return this.milestonesByProject.get(projectId) ?? [];
 }
 async fetchProgress(_orgId: string, projectId: string): Promise<readonly ProgressSummary[]> {
 return this.progressByProject.get(projectId) ?? [];
 }
 async fetchStatusHistory(_orgId: string, issueId: string): Promise<readonly StatusHistoryEntry[]> {
 return this.statusHistoryByIssue.get(issueId) ?? [];
 }
 async fetchComments(_orgId: string, issueId: string): Promise<readonly Comment[]> {
 return this.commentsByIssue.get(issueId) ?? [];
 }
 async askCopilot(_orgId: string, _projectId: string, text: string): Promise<{ replyText: string; intent: string; latencyMs: number }> {
 return { replyText: `Echo: ${text}`, intent: 'list_issues', latencyMs: 42 };
 }
 async fetchDailyReport(_orgId: string, projectId: string, _date: Date): Promise<DailyReport> {
 return this.dailyReports.get(projectId) ?? {
 date: '', projectId,
 captures: { total: 0, processed: 0, failed: 0 },
 issues: { opened: 0, resolved: 0, open: 0 },
 progress: { punchCompletionPct: 0, projectProgressPct: 0 },
 milestones: { completed: 0, overdue: 0 },
 };
 }
 async fetchWorkflows(orgId: string): Promise<readonly WorkflowSummary[]> {
 return this.workflowsByOrg.get(orgId) ?? [];
 }
 async fetchIntegrations(orgId: string): Promise<readonly IntegrationSummary[]> {
 return this.integrationsByOrg.get(orgId) ?? [];
 }
}

export class DashboardService {
 constructor(private readonly fetcher: DashboardFetcher) {}

 // ─── FR-1: home ─────────────────────────────────
async renderHome(orgId: string): Promise<string> {
 const projects = await this.fetcher.fetchProjects(orgId);
 const projectCards = await Promise.all(projects.map(async (p: any) => {
 let issueCount = 0;
 try {
 const issues = await this.fetcher.fetchIssues(orgId, p.id);
 issueCount = issues.length;
 } catch { /* ignore */ }
 return `
 <a class="project-card" href="/projects/${encodeURIComponent(p.id)}">
 <div class="project-name">${escapeHtml(p.name)}</div>
 <div class="project-meta">
 ${renderBadge(p.status)}
 <span>${issueCount} issue${issueCount === 1 ? '' : 's'}</span>
 </div>
 <div class="progress-bar"><div class="progress-fill" style="width:${p.progressPct}%"></div></div>
 <div class="muted" style="font-size: 12px;">${p.progressPct}% complete</div>
 </a>`;
 }));
 const totalProjects = projects.length;
 const body = totalProjects === 0
 ? `<div class="section"><div class="empty">
 <div class="empty-title">No projects yet</div>
 <div class="muted">Create your first project to get started.</div>
 </div></div>`
 : `
 <div class="stats-grid">
 <div class="stat-card"><div class="stat-label">Projects</div><div class="stat-value">${totalProjects}</div></div>
 <div class="stat-card"><div class="stat-label">Workflows</div><div class="stat-value">—</div><div class="stat-trend">Configure automation</div></div>
 <div class="stat-card"><div class="stat-label">Integrations</div><div class="stat-value">—</div><div class="stat-trend">Connect Procore, BIM360</div></div>
 <div class="stat-card"><div class="stat-label">Reports</div><div class="stat-value">—</div><div class="stat-trend">View weekly summaries</div></div>
 </div>
 <div class="section">
 <div class="section-title">All Projects</div>
 <div class="project-grid">${projectCards.join('')}</div>
 </div>`;
 return renderLayout({
 title: 'Projects',
 tenantId: orgId,
 body,
 pageTitle: 'Projects',
 pageSubtitle: 'Track construction issues, captures, and field reports across all projects.',
 navLinks: [
 { href: '/', label: 'Projects' },
 { href: '/orgs/' + encodeURIComponent(orgId) + '/workflows', label: 'Workflows' },
 { href: '/orgs/' + encodeURIComponent(orgId) + '/integrations', label: 'Integrations' },
 { href: '/orgs/' + encodeURIComponent(orgId) + '/reports/weekly', label: 'Reports' },
 ],
 });
 }

 // ─── FR-2: project detail ──────────────────────
 async renderProject(orgId: string, projectId: string): Promise<string> {
 const project = await this.fetcher.fetchProject(orgId, projectId);
 if (!project) return render404Page(orgId, 'Project');
 const milestones = await this.fetcher.fetchMilestones(orgId, projectId);
 const captures = await this.fetcher.fetchCaptures(orgId, projectId);
 const issues = await this.fetcher.fetchIssues(orgId, projectId);
 const progress = await this.fetcher.fetchProgress(orgId, projectId);
 const completedMilestones = milestones.filter((m) => m.status === 'completed' || m.status === 'skipped').length;
 const readyCaptures = captures.filter((c) => c.status === 'ready').length;
 const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'in_progress').length;
 const resolvedIssues = issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;
 const punchIssues = issues.filter((i) => i.kind === 'punch');
 const punchClosed = punchIssues.filter((i) => i.status === 'closed').length;
 const punchCompletionPct = punchIssues.length === 0 ? 100 : Math.round((punchClosed / punchIssues.length) * 100);
 const projectProgressPct = progress.length === 0 ? 0 : Math.max(...progress.map((p) => p.progressPct));
 const body = `
 <h2>${escapeHtml(project.name)} ${renderBadge(project.status)}</h2>
 <div class="grid">
 <div class="card"><h2>Milestones</h2><p class="value">${completedMilestones}/${milestones.length}</p></div>
 <div class="card"><h2>Captures</h2><p class="value">${readyCaptures}/${captures.length}</p></div>
 <div class="card"><h2>Issues</h2><p class="value">${openIssues} open / ${resolvedIssues} closed</p></div>
 <div class="card"><h2>Punch Closeout</h2><p class="value">${punchCompletionPct}%</p></div>
 <div class="card"><h2>Progress</h2><p class="value">${projectProgressPct}%</p></div>
 </div>
 <p>
 <a href="/projects/${encodeURIComponent(projectId)}/issues">View issues</a> ·
 <a href="/projects/${encodeURIComponent(projectId)}/milestones">Milestones</a> ·
 <a href="/projects/${encodeURIComponent(projectId)}/copilot">AI Copilot</a> ·
 <a href="/projects/${encodeURIComponent(projectId)}/reports/daily">Daily report</a>
 </p>`;
 return renderLayout({
 title: project.name,
 tenantId: orgId,
 body,
 });
 }

 // ─── FR-3: issues list ──────────────────────────
 async renderIssues(orgId: string, projectId: string, status?: string): Promise<string> {
 const issues = await this.fetcher.fetchIssues(orgId, projectId, status);
 const rows = issues.map((i) => `
 <tr>
 <td>${renderBadge(i.status)}</td>
 <td>${i.severity}</td>
 <td>${i.kind}</td>
 <td>${i.trade ?? '-'}</td>
 <td><a href="/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(i.id)}">${escapeHtml(i.title)}</a></td>
 </tr>`).join('');
 const body = `
 <h2>Issues${status ? ' (' + escapeHtml(status) + ')' : ''}</h2>
 <table>
 <thead><tr><th>Status</th><th>Severity</th><th>Kind</th><th>Trade</th><th>Title</th></tr></thead>
 <tbody>${rows || '<tr><td colspan="5" class="muted">No issues</td></tr>'}</tbody>
 </table>`;
 return renderLayout({ title: 'Issues', tenantId: orgId, body });
 }

 // ─── FR-4: issue detail ──────────────────────────
 async renderIssue(orgId: string, projectId: string, issueId: string): Promise<string> {
 const issue = await this.fetcher.fetchIssue(orgId, projectId, issueId);
 if (!issue) return render404Page(orgId, 'Issue');
 const history = await this.fetcher.fetchStatusHistory(orgId, issueId);
 const comments = await this.fetcher.fetchComments(orgId, issueId);
 const historyRows = history.map((h) => `<li>${h.fromStatus} → ${h.toStatus} by ${h.actorId}: ${escapeHtml(h.reason ?? '')}</li>`).join('');
 const commentRows = comments.map((c) => `<li><strong>${c.authorId}</strong>: ${escapeHtml(c.text)}</li>`).join('');
 const body = `
 <h2>${escapeHtml(issue.title)} ${renderBadge(issue.status)}</h2>
 <p>${escapeHtml(issue.title)} — severity: ${issue.severity}, kind: ${issue.kind}</p>
 <h3>Status history</h3>
 <ul>${historyRows || '<li class="muted">No history</li>'}</ul>
 <h3>Comments</h3>
 <ul>${commentRows || '<li class="muted">No comments</li>'}</ul>
 <p><a href="/projects/${encodeURIComponent(projectId)}/issues">← Back to issues</a></p>`;
 return renderLayout({ title: issue.title, tenantId: orgId, body });
 }

 // ─── FR-5: copilot chat ────────────────────────
 async renderCopilotForm(orgId: string, projectId: string): Promise<string> {
 const body = `
 <h2>AI Copilot</h2>
 <p class="muted">Ask in natural language: "Show open issues", "What's overdue?", "Project status?"</p>
 <form method="POST" action="/projects/${encodeURIComponent(projectId)}/copilot">
 <input type="text" name="text" placeholder="Ask a question…" autofocus required>
 <button type="submit">Ask</button>
 </form>`;
 return renderLayout({ title: 'AI Copilot', tenantId: orgId, body });
 }

 async renderCopilotReply(orgId: string, projectId: string, text: string): Promise<string> {
 const reply = await this.fetcher.askCopilot(orgId, projectId, text);
 const body = `
 <h2>AI Copilot</h2>
 <div class="copy">${escapeHtml(reply.replyText)}</div>
 <p class="muted">Intent: ${escapeHtml(reply.intent)} · Latency: ${reply.latencyMs}ms</p>
 <form method="POST" action="/projects/${encodeURIComponent(projectId)}/copilot">
 <input type="text" name="text" placeholder="Ask a question…" required>
 <button type="submit">Ask</button>
 </form>
 <p><a href="/projects/${encodeURIComponent(projectId)}">← Back to project</a></p>`;
 return renderLayout({ title: 'AI Copilot', tenantId: orgId, body });
 }

 // ─── FR-6: reports ─────────────────────────────
 async renderDailyReport(orgId: string, projectId: string, date: Date): Promise<string> {
 const r = await this.fetcher.fetchDailyReport(orgId, projectId, date);
 const body = `
 <h2>Daily report — ${escapeHtml(r.date)}</h2>
 <div class="grid">
 <div class="card"><h2>Captures</h2><p class="value">${r.captures.total}</p><p class="muted">${r.captures.processed} ready, ${r.captures.failed} failed</p></div>
 <div class="card"><h2>Issues</h2><p class="value">${r.issues.opened}</p><p class="muted">opened</p></div>
 <div class="card"><h2>Resolutions</h2><p class="value">${r.issues.resolved}</p><p class="muted">resolved</p></div>
 <div class="card"><h2>Milestones</h2><p class="value">${r.milestones.completed}</p><p class="muted">${r.milestones.overdue} overdue</p></div>
 <div class="card"><h2>Punch Closeout</h2><p class="value">${r.progress.punchCompletionPct}%</p></div>
 <div class="card"><h2>Progress</h2><p class="value">${r.progress.projectProgressPct}%</p></div>
 </div>`;
 return renderLayout({ title: 'Daily report', tenantId: orgId, body });
 }

 async renderWeeklyReport(orgId: string): Promise<string> {
 const body = `
 <h2>Weekly report — ${escapeHtml(orgId)}</h2>
 <div class="copy">Weekly report rollup across all projects in ${escapeHtml(orgId)}. (Stub data: 3 active, 1 at_risk.)</div>`;
 return renderLayout({ title: 'Weekly report', tenantId: orgId, body });
 }

 // ─── FR-7: milestones ───────────────────────────
 async renderMilestones(orgId: string, projectId: string): Promise<string> {
 const milestones = await this.fetcher.fetchMilestones(orgId, projectId);
 const rows = milestones.map((m) => `<tr>
 <td>${renderBadge(m.status)}</td>
 <td>${escapeHtml(m.name)}</td>
 <td>${m.plannedDate.toISOString().slice(0, 10)}</td>
 <td>${m.actualDate ? m.actualDate.toISOString().slice(0, 10) : '-'}</td>
 </tr>`).join('');
 const body = `
 <h2>Milestones</h2>
 <table>
 <thead><tr><th>Status</th><th>Name</th><th>Planned</th><th>Actual</th></tr></thead>
 <tbody>${rows || '<tr><td colspan="4" class="muted">No milestones</td></tr>'}</tbody>
 </table>`;
 return renderLayout({ title: 'Milestones', tenantId: orgId, body });
 }

 // ─── FR-8: workflows + integrations ────────────
 async renderWorkflows(orgId: string): Promise<string> {
 const workflows = await this.fetcher.fetchWorkflows(orgId);
 const rows = workflows.map((w) => `<tr>
 <td>${escapeHtml(w.name)}</td>
 <td>${w.enabled ? '✅' : '❌'}</td>
 <td>${w.runCount}</td>
 <td>${w.lastRunAt ? w.lastRunAt.toISOString().slice(0, 16) : 'never'}</td>
 </tr>`).join('');
 const body = `
 <h2>Workflows</h2>
 <table>
 <thead><tr><th>Name</th><th>Enabled</th><th>Runs</th><th>Last Run</th></tr></thead>
 <tbody>${rows || '<tr><td colspan="4" class="muted">No workflows</td></tr>'}</tbody>
 </table>`;
 return renderLayout({ title: 'Workflows', tenantId: orgId, body });
 }

 async renderIntegrations(orgId: string): Promise<string> {
 const integrations = await this.fetcher.fetchIntegrations(orgId);
 const rows = integrations.map((i) => `<tr>
 <td>${escapeHtml(i.provider)}</td>
 <td>${renderBadge(i.status)}</td>
 <td>${i.connectedAt.toISOString().slice(0, 10)}</td>
 </tr>`).join('');
 const body = `
 <h2>Integrations</h2>
 <table>
 <thead><tr><th>Provider</th><th>Status</th><th>Connected</th></tr></thead>
 <tbody>${rows || '<tr><td colspan="3" class="muted">No integrations</td></tr>'}</tbody>
 </table>`;
 return renderLayout({ title: 'Integrations', tenantId: orgId, body });
 }
}
