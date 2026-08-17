# Feature Specification — Reports

**Feature ID:** 009-reports
**Phase:** 9 (ninth feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Phase 9 architectural decision:** NEW service `report-service` (justified in §1)

---

## 1. Summary

**Reports** is the analytics layer. It aggregates data from capture-service, field-service, bim-viewer, ai-copilot, mobile-bff, and track-service into stakeholder-ready outputs:

- **Daily progress reports** — yesterday's captures, issues, resolutions, completions
- **Weekly executive summaries** — top metrics, blockers, wins
- **Project deep-dives** — full project rollup combining all 6 services
- **Cross-project dashboards** — portfolio view for executives
- **Custom reports** — ad-hoc queries with filters

**Why now:** Phases 1-8 give us the data plane. Reports is the **read-side** of CQRS — it queries the execution services and produces stakeholder artifacts.

**Architectural decision:** NEW `report-service` on port 9096. Rationale:
- Reports is read-only, cross-service — it's not a CRUD domain
- Per Constitution §VII — distinct domain justifies distinct service
- 13-product roadmap explicitly listed Reports as a separate product

---

## 2. Functional Requirements (FRs)

### FR-1 — Daily progress report
**As** a project manager
**I want** to get yesterday's project activity
**So that** I can brief the team in the morning standup.

- `GET /v1/projects/:projectId/reports/daily?date=YYYY-MM-DD`
- Returns: `{ date, captures: { total, processed, failed }, issues: { opened, resolved, open }, progress: { punchCompletionPct, projectProgressPct }, milestones: { completed, overdue } }`
- 200 with rollup; 404 if no project

### FR-2 — Weekly executive summary
**As** an executive
**I want** a weekly summary across all projects
**So that** I know the portfolio's status.

- `GET /v1/orgs/:orgId/reports/weekly?week=2026-W34`
- Returns: `{ weekStart, weekEnd, projects: { total, active, at_risk, delayed, completed }, topBlockers, topWins, totalCaptures, totalIssuesResolved, totalProgressPct }`
- 200 with rollup; 401 without tenant

### FR-3 — Project deep-dive
**As** a project manager
**I want** a single-page project summary
**So that** I can review the project at a glance.

- `GET /v1/projects/:projectId/reports/deep-dive`
- Returns: `{ projectId, status, milestones: { total, completed, pending, blocked }, captures: { total, ready }, issues: { total, open, resolved }, bim: { currentModelId, totalElements }, punch: { completionPct, trade: Record<Trade, number> }, progress: { progressPct, scheduleVarianceDays } }`
- 200 with hero card; 404 if no project

### FR-4 — Cross-project portfolio
**As** an executive
**I want** to see all projects in one view
**So that** I can prioritize.

- `GET /v1/orgs/:orgId/reports/portfolio`
- Returns: `{ totalProjects, byStatus: Record<ProjectStatus, number>, byCompletion: { '0-25%': number, '25-50%': number, ... } }`
- 200; 401 without tenant

### FR-5 — Custom report (filters)
**As** a power user
**I want** to query with custom filters
**So that** I can find specific patterns.

- `POST /v1/orgs/:orgId/reports/custom`
- Body: `{ entity: 'issues' | 'captures' | 'milestones', filter: { ... }, groupBy?: string, dateRange?: { from, to } }`
- Returns: `{ rows: Row[], groups?: Record<string, number> }`
- 200; 422 on invalid entity

### FR-6 — Report scheduling (cron)
**As** a project manager
**I want** to schedule a daily report
**So that** it's delivered automatically.

- `POST /v1/projects/:projectId/reports/schedule`
- Body: `{ kind: 'daily' | 'weekly', dayOfWeek?: number, hour: number, recipients: string[] }`
- Returns: `{ scheduleId, nextRunAt }`
- Phase 9 MVP: schedule is stored but cron execution is Phase 9.b
- 201 on create; 200 on replay

### FR-7 — List scheduled reports
**As** a project manager
**I want** to see all my scheduled reports
**So that** I can manage them.

- `GET /v1/projects/:projectId/reports/schedule`
- Returns: `{ items: Schedule[] }`
- 200 with paginated list

### FR-8 — Cancel a scheduled report
**As** a project manager
**I want** to cancel a scheduled report
**So that** it doesn't fire.

- `DELETE /v1/projects/:projectId/reports/schedule/:id`
- Returns: 204
- 404 on cross-tenant

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every endpoint enforces `x-tenant-id` (or `:orgId` path param). Cross-tenant = 404.

### NFR-2 — RFC 7807 errors
All errors return `application/problem+json` with 6-field shape.

### NFR-3 — Cacheable
Reports are read-only and cacheable. Phase 9 MVP: in-memory cache with 5-minute TTL. Phase 9.b: Redis.

### NFR-4 — Observability
`x-request-id` on every response. `/v1/metrics` exposes `report_runs_total{kind, projectId}` counter.

### NFR-5 — Idempotency
POST endpoints require `x-idempotency-key`. Replay returns 200 with same id.

### NFR-6 — Cross-service auth
Report-service calls other services with a service-to-service auth token (Phase 9.b). Phase 9 MVP: stub token.

### NFR-7 — Pagination
List endpoints (FR-7) use HMAC-signed cursors (Phase 2/3 pattern).

---

## 4. User scenarios

### Scenario A — Daily standup
1. PM opens dashboard at 9 AM
2. App: `GET /v1/projects/A/reports/daily?date=2026-08-17`
3. Server reads from capture-service, field-service, track-service
4. Returns: "Yesterday: 3 captures (2 ready, 1 failed), 5 issues opened, 2 resolved, 1 milestone overdue"
5. PM briefs the team

### Scenario B — Executive dashboard
1. CEO opens weekly report
2. App: `GET /v1/orgs/X/reports/weekly?week=2026-W34`
3. Server aggregates across all projects
4. Returns: "5 projects active, 2 at_risk, 1 delayed. 23 captures, 12 issues resolved. Top blocker: BIM alignment in Project A."
5. CEO drills into Project A

### Scenario C — Ad-hoc query
1. PM asks: "How many open plumbing issues across all projects?"
2. App: `POST /v1/orgs/X/reports/custom` with `{ entity: 'issues', filter: { trade: 'plumbing', status: 'open' } }`
3. Server calls field-service
4. Returns: "7 open plumbing issues"
5. Server caches for 5 minutes

### Scenario D — Scheduled report
1. PM schedules "Daily 8 AM" report
2. Server stores Schedule record
3. Phase 9.b: cron worker fires at 8 AM, generates report, emails recipients
4. MVP: schedule is stored, cron deferred

### Scenario E — AI Copilot summary
1. PM asks: "How is Project A doing?"
2. AI Copilot (Phase 4) routes to report-service via `GET /v1/projects/A/reports/deep-dive`
3. Returns: "Project A is at_risk. 3 of 5 milestones completed, 1 overdue. 47% progress, 14 days variance."
4. PM drills into specific issues

---

## 5. Out of scope (for this Phase 9 MVP)

- **Email delivery** — Phase 9.b. Schedules are stored but cron execution is a worker.
- **PDF generation** — Phase 9.b. JSON responses only.
- **Redis cache** — Phase 9.b. In-memory cache with 5-min TTL for now.
- **Cross-service auth** — Phase 9.b. Stub token in MVP.
- **Custom report builder UI** — Phase 12 (Dashboard). Report-service exposes the API.
- **Streaming aggregations** — Phase 9.b. MVP aggregates on demand.

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **New service or extend track-service?** — new report-service or extend track-service? **Default: new report-service (per A-decision justification).**
2. **Daily report generation?** — eagerly or on-demand? **Default: on-demand (cacheable).**
3. **Cross-service auth?** — stub token or full service-to-service? **Default: stub token (Phase 9.b).**
4. **Custom report entity enum?** — issues/captures/milestones enough? **Default: 3 entities (Phase 9.b can add more).**
5. **Cache invalidation?** — TTL only or active? **Default: 5-min TTL only.**
6. **Schedule execution?** — actually run or just store? **Default: just store (Phase 9.b worker).**
7. **Schedule recipients?** — email or generic? **Default: email (Phase 9.b transport).**

