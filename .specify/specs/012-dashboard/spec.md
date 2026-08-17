# Feature Specification — Dashboard (Web UI)

**Feature ID:** 012-dashboard
**Phase:** 12 (twelfth feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Phase 12 architectural decision:** NEW service `dashboard-service` (justified in §1)

---

## 1. Summary

**Dashboard** is the user-facing web UI. It ties all 11 backend services into a coherent, navigable interface:

- **Project list** — all projects in the org with status badges
- **Project detail page** — captures/issues/milestones/progress/punch closeout in one view
- **Capture upload UI** — list captures + upload status (read-only; actual upload via mobile-bff)
- **Issue tracker** — list + filter + create (proxies to field-service)
- **AI Copilot chat** — NL queries (proxies to ai-copilot-service)
- **Reports dashboard** — daily/weekly summaries (proxies to report-service)
- **Track milestones** — Gantt-style (proxies to track-service)
- **Workflow rules** — list + run (proxies to workflow-service)
- **Integrations panel** — connect/disconnect (proxies to integration-service)

**Why now:** Phases 1-11 give us 11 services with JSON APIs. Without a UI, the platform is a developer tool. Dashboard is what makes it usable to PMs, field crews, and executives.

**Architectural decision:** NEW `dashboard-service` on port 9099. Rationale:
- Server-rendered HTML (no React build pipeline) keeps deployment simple
- Per Constitution §VII — distinct domain (presentation layer vs API) justifies distinct service
- 13-product roadmap explicitly listed Dashboard

**Scope discipline:** Phase 12 MVP ships **HTML pages + minimal CSS** (using `@sthyra-crm/tokens` design system). Phase 12.b can swap to React/Next.js without changing the API.

---

## 2. Functional Requirements (FRs)

### FR-1 — Home page (org overview)
**As** any user
**I want** to see all projects in my org
**So that** I can pick one to work on.

- `GET /` (HTML)
- Returns: HTML page with project cards
- Headers: `x-tenant-id` (or session cookie in Phase 12.b)
- 200; 401 if no tenant

### FR-2 — Project detail page
**As** any user
**I want** to see one project's full state
**So that** I have a single pane of glass.

- `GET /projects/:projectId` (HTML)
- Returns: HTML page with sections:
 - Status badge (planning/active/at_risk/delayed/completed)
 - Milestones summary (total, completed, blocked)
 - Captures (total, ready count)
 - Issues (total, open count)
 - BIM (current model ID, element count)
 - Punch list (closeout %)
 - Progress (overall %)
- 200; 404 if cross-tenant

### FR-3 — Issues list page
**As** any user
**I want** to see all issues for a project
**So that** I can triage.

- `GET /projects/:projectId/issues` (HTML)
- Returns: HTML table of issues with status, severity, kind, trade, title
- 200; 404 if cross-tenant

### FR-4 — Issue detail page
**As** any user
**I want** to see one issue's full history
**So that** I can review before deciding.

- `GET /projects/:projectId/issues/:issueId` (HTML)
- Returns: HTML page with:
 - Title, description, severity, status, kind (standard/punch)
 - Status history (audit trail)
 - Photos (if any)
 - Comments
- 200; 404 if cross-tenant

### FR-5 — AI Copilot chat
**As** any user
**I want** to ask natural-language questions
**So that** I don't need to learn the API.

- `GET /projects/:projectId/copilot` (HTML page with form)
- `POST /projects/:projectId/copilot` (form submit, returns rendered reply)
- Returns: HTML page with reply text + intent
- 200; 400 if no text

### FR-6 — Reports page
**As** any PM
**I want** to see daily/weekly reports
**So that** I can brief my team.

- `GET /projects/:projectId/reports/daily` (HTML)
- Returns: HTML page with daily metrics (captures/issues/progress/milestones)
- 200; 404 if cross-tenant

- `GET /orgs/:orgId/reports/weekly` (HTML)
- Returns: HTML page with org-wide weekly rollup

### FR-7 — Track milestones page
**As** any PM
**I want** to see the Gantt-style timeline
**So that** I can spot delays.

- `GET /projects/:projectId/milestones` (HTML)
- Returns: HTML page with milestone cards (planned date, status, variance)
- 200; 404 if cross-tenant

### FR-8 — Workflow rules page
**As** an admin
**I want** to see + run workflows
**So that** I can monitor automation.

- `GET /orgs/:orgId/workflows` (HTML)
- Returns: HTML page with workflow list (name, trigger, lastRunAt, runCount)
- 200; 404 if cross-tenant

- `GET /orgs/:orgId/integrations` (HTML)
- Returns: HTML page with integration list (provider, status)

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every page enforces `x-tenant-id` (or session cookie). Cross-tenant = 404.

### NFR-2 — RFC 7807 errors
Error pages return `application/problem+json` for API consumers and HTML for browser users.

### NFR-3 — Cacheable
HTML pages are cacheable with ETag. Phase 12 MVP: no caching (just-in-time render). Phase 12.b: ETags.

### NFR-4 — Design tokens
All UI uses `@sthyra-crm/tokens` (teal #00B894, amber #F5A524). Inlined CSS in HTML.

### NFR-5 — Mobile-responsive
HTML pages use CSS Grid + viewport meta. Readable on iPhone.

### NFR-6 — Observability
`x-request-id` on every page. `/v1/metrics` exposes `dashboard_page_views_total{path}` counter.

### NFR-7 — SSR (server-side rendered)
HTML is generated server-side, not client-side JS. Works without JavaScript enabled.

---

## 4. User scenarios

### Scenario A — PM opens dashboard
1. PM navigates to `/`
2. Server reads x-tenant-id from session, queries project list
3. Returns HTML with 5 project cards
4. PM clicks Project A → `/projects/A`

### Scenario B — PM reviews project
1. PM opens `/projects/A`
2. Server queries 8 services in parallel: capture-service, field-service, bim-viewer, ai-copilot, mobile-bff, track-service, workflow-service, integration-service
3. Renders single HTML page with all sections
4. PM scrolls, sees 47% progress, 1 overdue milestone

### Scenario C — PM asks AI Copilot
1. PM opens `/projects/A/copilot`
2. Form with input "show open plumbing issues"
3. Submits → server POSTs to ai-copilot-service
4. Returns rendered reply: "7 open plumbing items"
5. PM drills into the linked issues

### Scenario D — Field crew checks issues
1. Field lead opens `/projects/A/issues?status=open`
2. Server queries field-service with filter
3. Returns HTML table of 12 open issues
4. Lead taps one → `/projects/A/issues/iss_1`

### Scenario E — Daily standup
1. PM opens `/projects/A/reports/daily?date=2026-09-01`
2. Server queries report-service
3. Returns HTML: "Yesterday: 3 captures (2 ready, 1 failed), 5 issues opened, 2 resolved, 1 milestone overdue"

---

## 5. Out of scope (for this Phase 12 MVP)

- **Interactive form submission** (besides copilot chat) — Phase 12.b.
- **Real-time SSE updates** — Phase 12.b.
- **Authentication / sessions** — Phase 12.b (Phase 13 admin).
- **React / Next.js** — Phase 12.b.
- **Charts (Gantt, bar charts)** — Phase 12.b. MVP shows text-based milestones.
- **Drag-and-drop** — Phase 12.b.

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **New service or static site?** — new dashboard-service or static HTML? **Default: new dashboard-service (server-side render).**
2. **CSS approach?** — inlined or external stylesheet? **Default: inlined (per-page `<style>` block).**
3. **Page count?** — 8 or more? **Default: 8 (FR-1 to FR-8).**
4. **Template engine?** — handlebars, JSX, or string concat? **Default: pure string concat (no deps).**
5. **Cross-service auth?** — service tokens or public? **Default: internal service tokens (Phase 12.b: full auth).**
6. **Tenant header on HTML pages?** — query param or header? **Default: header (`x-tenant-id`) for API compatibility.**
7. **Design tokens integration?** — import npm package or copy values? **Default: import @sthyra-crm/tokens (workspace dep).**

