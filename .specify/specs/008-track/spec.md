# Feature Specification — Track

**Feature ID:** 008-track
**Phase:** 8 (eighth feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Phase 8 architectural decision:** NEW service `track-service` (justified in §1)

---

## 1. Summary

**Track** is the project-level progress monitoring surface. While capture-service records site reality, field-service tracks defects, and bim-viewer anchors geometry — Track answers the executive question: "Are we on schedule, on budget, and on plan?"

Track provides:
- **Milestones** — date-anchored goals with planned vs actual dates
- **Schedule variance** — delta between planned and actual
- **Progress entries** — manual + automatic (e.g., from closeout completion)
- **Project status** — aggregated rollup: planning / active / at-risk / delayed / completed / cancelled

**Why now:** Phases 1-7 give us the data plane. The PM dashboard (Phase 12) needs Track to render the Gantt chart, variance report, and progress bar.

**Architectural decision:** Phase 8 ships a NEW `track-service`. Rationale:
- Track is read-heavy across multiple services (closeout %, BIM ready, capture status)
- It's a separate concern (schedule management, not issue tracking)
- Per Constitution §VII — no re-decision. But §VII allows new services when the domain is distinct. Track's domain (milestones, schedule, progress) is distinct from field-service (issues, comments, status history).
- 13-product roadmap explicitly listed Track as a separate product.

---

## 2. Functional Requirements (FRs)

### FR-1 — Create a milestone
**As** a project manager
**I want** to define a milestone on a project
**So that** the team has a date-anchored goal.

- `POST /v1/projects/:projectId/milestones`
- Body: `{ name, description?, plannedDate, dependsOn?: string[] }`
- Returns: `{ milestoneId, name, plannedDate, status: 'pending' }`
- Headers: `x-tenant-id`, `x-idempotency-key`
- 201 first / 200 on replay / 409 on duplicate name

### FR-2 — Update milestone status
**As** the system or a project manager
**I want** to update a milestone's status
**So that** it tracks reality.

- `PATCH /v1/projects/:projectId/milestones/:id`
- Body: `{ status?: 'pending' | 'in_progress' | 'completed' | 'skipped'; actualDate?: Date; progressPct?: number }`
- State transitions: `pending → in_progress → completed` or `pending → in_progress → skipped`
- Auto-block: `completed` cannot transition to anything else
- 200 on success / 409 on invalid / 404 on cross-tenant

### FR-3 — Log progress entry
**As** a project manager or automated system
**I want** to record a progress entry
**So that** we have an audit trail of who said what.

- `POST /v1/projects/:projectId/progress`
- Body: `{ milestoneId?, progressPct: number, note?: string, source: 'manual' | 'auto_closeout' | 'auto_capture' | 'auto_bim' }`
- Returns: `{ entryId, loggedAt }`
- Progress entries are append-only (no PATCH)
- 201 on success / 400 on invalid pct (must be 0-100)

### FR-4 — Project status rollup
**As** a project manager
**I want** to see the project's overall status
**So that** I can decide what to do.

- `GET /v1/projects/:projectId/status`
- Returns: `{ projectId, status: 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled', milestones: { total, completed, pending, blocked }, scheduleVarianceDays: number, progressPct: number, lastUpdated: Date }`
- 200 with stats; 404 if no project

### FR-5 — Schedule variance
**As** a project manager
**I want** to see the schedule variance
**So that** I know if we're on time.

- `GET /v1/projects/:projectId/variance`
- Returns: `{ plannedEndDate, currentEndDate, varianceDays, atRiskCount, delayedCount, overdueMilestones: Milestone[] }`
- 200; 404 if no project

### FR-6 — Dependency graph
**As** a project manager
**I want** to see which milestones depend on which
**So that** I can visualize the critical path.

- `GET /v1/projects/:projectId/milestones/graph`
- Returns: `{ nodes: Milestone[], edges: { fromId, toId }[] }`
- 200; cycles are rejected at milestone creation (FR-1)

### FR-7 — Milestone filtering
**As** a project manager
**I want** to filter milestones by status
**So that** I can focus on what matters.

- `GET /v1/projects/:projectId/milestones?status=in_progress`
- Returns paginated list of milestones
- Headers: `x-tenant-id` required
- 200 with items; 401 without tenant

### FR-8 — SSE on milestone / status changes
**As** the dashboard
**I want** an SSE stream of project status changes
**So that** the Gantt chart updates in real-time.

- `GET /v1/projects/:projectId/events`
- Emits: `milestone.created`, `milestone.updated`, `milestone.completed`, `progress.logged`, `project.status_changed`
- Tenant-scoped at delivery
- History replay (1 event: current status)

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every endpoint enforces `x-tenant-id`. Cross-tenant = 404.

### NFR-2 — RFC 7807 errors
All errors return `application/problem+json` with 6-field shape.

### NFR-3 — Idempotency on POST
`POST /milestones` and `POST /progress` require `x-idempotency-key`. Replay returns 200 with same id.

### NFR-4 — Cycle detection
`POST /milestones` with `dependsOn` rejects cycles (returns 422).

### NFR-5 — Observability
`x-request-id` on every response. `/v1/metrics` exposes counter `track_milestones_total{status}` and `track_progress_entries_total{source}`.

### NFR-6 — Source tagging
`progress.source` distinguishes 'manual' (PM input) from 'auto_*' (system-driven). Auto sources are write-only from system; manual is the only user-driven source.

### NFR-7 — Soft delete
Milestones and progress entries are never hard-deleted. Use `deletedAt`.

---

## 4. User scenarios

### Scenario A — PM onboards a project
1. PM creates project (Phase 12 will own this; Track gets the projectId)
2. PM creates 5 milestones:
 - "Foundation Complete" (planned 2026-09-01)
 - "Structure Topped Out" (planned 2026-12-01, depends on foundation)
 - "MEP Rough-In" (planned 2027-02-01, depends on structure)
 - "Façade Complete" (planned 2027-04-01)
 - "Substantial Completion" (planned 2027-06-01, depends on façade)
3. Server rejects cycle if PM tries to make foundation depend on completion
4. Dashboard renders Gantt chart

### Scenario B — Progress is logged
1. Foreman marks "Foundation Complete" as in_progress
2. App: `POST /v1/projects/A/progress` with `progressPct: 50, source: 'manual'`
3. Server persists entry; aggregates for project status
4. Status auto-updates: `at_risk` if 50% time elapsed but <50% progress
5. SSE emits `progress.logged`

### Scenario C — Closeout drives completion
1. Phase 7's closeout completion reaches 100%
2. Auto-source sends `POST /v1/projects/A/progress` with `progressPct: 100, source: 'auto_closeout'`
3. Server marks "Substantial Completion" milestone as completed
4. Project status → `completed`
5. SSE emits `milestone.completed` and `project.status_changed`

### Scenario D — Slip detection
1. "Foundation Complete" was planned 2026-09-01
2. Date is now 2026-09-15 — milestone is still pending
3. Server computes overdue; project status → `delayed`
4. Dashboard shows red badge for project
5. PM sees `scheduleVarianceDays: 14` for the milestone

### Scenario E — AI Copilot summary
1. PM asks: "What's the status of Project A?"
2. AI Copilot (Phase 4) routes to track-service via `GET /v1/projects/A/status`
3. Returns: "Project A is at_risk. 2 of 5 milestones completed, 1 overdue by 14 days. 47% progress."
4. PM drills into details

---

## 5. Out of scope (for this Phase 8 MVP)

- **Gantt chart rendering** — that's Phase 12 (Dashboard). Track serves the data.
- **Calendar integration** — Phase 8.b.
- **Critical path computation** — Phase 8.b. Track serves the graph; PM computes the critical path client-side.
- **Resource allocation** — Phase 8.b.
- **Predictive scheduling** — machine learning on past projects. Phase 8.b.

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **New service or extend field-service?** — new track-service or extend field-service? **Default: new track-service (per A-decision justification).**
2. **Cycle detection algorithm?** — DFS with memo? **Default: DFS-based, O(V+E).**
3. **Auto-status thresholds?** — when does status go from active to at_risk? **Default: progressPct < timeElapsedPct × 0.95 → at_risk.**
4. **Variance formula?** — `actualDate - plannedDate` or weighted? **Default: simple actual - planned (per milestone).**
5. **Source validation?** — can clients send `auto_*`? **Default: only server-issued sources; manual users can only send 'manual'.**
6. **Milestone deletion?** — soft-delete only? **Default: yes, soft-delete (NFR-7).**
7. **Project status initial value?** — 'planning' until first milestone created? **Default: 'planning' on project creation; transitions to 'active' on first milestone in_progress.**

