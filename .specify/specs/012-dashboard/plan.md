# Implementation Plan — Dashboard

**Feature ID:** 012-dashboard
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Architecture Decision — NEW SERVICE

`dashboard-service` is a new microservice on port 9099.

## File paths

```
services/dashboard-service/
├── package.json
├── tsconfig.json
├── Dockerfile
├── public/                                     ← static assets (Phase 12.b)
└── src/
 ├── types.ts                                  ← PageData, ProjectSummary, IssueSummary
 ├── types.test.ts                             ← 4 tests
 ├── css.ts                                      ← inlined CSS as string constants
 ├── layout.ts                                   ← renderLayout + renderError + render404
 ├── layout.test.ts                              ← 6 tests
 ├── aggregator.ts                               ← PURE: aggregateHomePage, aggregateProjectPage
 ├── aggregator.test.ts                          ← 8 tests
 ├── service.ts                                  ← DashboardService (orchestrates downstream calls)
 ├── service.test.ts                              ← 8 tests (with stubbed downstream)
 ├── http.ts                                      ← 8 routes (HTML responses)
 ├── http.test.ts                                 ← 20 tests (HTML structure + tenant isolation)
 ├── cli.ts                                       ← startInMemoryServer
 ├── cli-e2e.test.ts                               ← 3 tests
 └── migrations/001-init.sql                     ← (Phase 12.b)
```

## Architecture decisions

### A1 — Layout (pure functions)

```typescript
export function renderLayout(opts: {
  title: string;
  tenantId: string;
  body: string;
  navLinks: ReadonlyArray<{ href: string; label: string }>;
}): string;
export function renderErrorPage(code: number, title: string, message: string): string;
export function render404Page(tenantId: string): string;
```

### A2 — Aggregator (pure functions)

```typescript
export interface ProjectCard { id: string; name: string; status: string; progressPct: number; }
export function aggregateHomePage(orgId: string, projects: ReadonlyArray<{ id: string; name: string; status: string; progressPct: number }>): ProjectCard[];
export function aggregateProjectPage(...): ProjectPageData;
```

### A3 — CSS (string constant)

```typescript
export const CSS = `
:root { --teal: #00B894; --amber: #F5A524; }
body { font-family: system-ui; margin: 0; padding: 0; }
.header { background: var(--teal); color: white; padding: 16px; }
... (Phase 12 MVP: ~50 lines)
`;
```

### A4 — Service (orchestrates downstream)

```typescript
class DashboardService {
  constructor(deps: { fetcher: DashboardFetcher });
  async getHomePage(orgId: string): Promise<HomePageData>;
  async getProjectPage(orgId: string, projectId: string): Promise<ProjectPageData>;
  async getIssuesPage(orgId: string, projectId: string, status?: string): Promise<IssuesPageData>;
  async getIssuePage(orgId: string, projectId: string, issueId: string): Promise<IssuePageData>;
  async getCopilotReply(orgId: string, projectId: string, text: string): Promise<CopilotPageData>;
  async getDailyReportPage(orgId: string, projectId: string, date: Date): Promise<DailyReportPageData>;
  async getMilestonesPage(orgId: string, projectId: string): Promise<MilestonesPageData>;
  async getWorkflowsPage(orgId: string): Promise<WorkflowsPageData>;
}
```

### A5 — Routes (8)

```
GET  /                                              (FR-1: home)
GET  /projects/:projectId                          (FR-2: project detail)
GET  /projects/:projectId/issues?status=...       (FR-3: issues list)
GET  /projects/:projectId/issues/:issueId         (FR-4: issue detail)
GET  /projects/:projectId/copilot                  (FR-5: chat form)
POST /projects/:projectId/copilot                  (FR-5: chat submit)
GET  /projects/:projectId/reports/daily            (FR-6: daily report)
GET  /orgs/:orgId/reports/weekly                   (FR-6: weekly report)
GET  /projects/:projectId/milestones              (FR-7: milestones)
GET  /orgs/:orgId/workflows                        (FR-8: workflows)
GET  /orgs/:orgId/integrations                    (FR-8: integrations)
+ GET /v1/health
```

### A6 — StubFetcher for tests

```typescript
interface DashboardFetcher {
  fetchProjects(orgId: string): Promise<readonly ProjectSummary[]>;
  fetchProject(orgId: string, projectId: string): Promise<ProjectSummary | null>;
  fetchIssues(orgId: string, projectId: string, filter?: ...): Promise<readonly IssueSummary[]>;
  fetchCaptures(orgId: string, projectId: string): Promise<readonly CaptureSummary[]>;
  fetchMilestones(orgId: string, projectId: string): Promise<readonly MilestoneSummary[]>;
  fetchProgress(orgId: string, projectId: string): Promise<readonly ProgressSummary[]>;
  fetchPunchIssues(orgId: string, projectId: string): Promise<readonly IssueSummary[]>;
  fetchStatusHistory(orgId: string, issueId: string): Promise<readonly StatusHistoryEntry[]>;
  fetchComments(orgId: string, issueId: string): Promise<readonly Comment[]>;
  fetchPhotos(orgId: string, issueId: string): Promise<readonly IssuePhoto[]>;
  askCopilot(orgId: string, projectId: string, text: string): Promise<{ replyText: string; intent: string; latencyMs: number }>;
  fetchDailyReport(orgId: string, projectId: string, date: Date): Promise<DailyReport>;
  fetchWorkflows(orgId: string): Promise<readonly WorkflowSummary[]>;
  fetchIntegrations(orgId: string): Promise<readonly IntegrationSummary[]>;
}
```

