# Feature Specification — QA / Punch List

**Feature ID:** 007-qa-punch-list
**Phase:** 7 (seventh feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Source schemas consumed:**
- `services/field-service/` (Phase 2 — extends it)
- `services/mobile-bff-service/` (Phase 5/6 — issue creation from camera)
- `services/ai-copilot-service/` (Phase 4 — NL queries about punch list)

---

## 1. Summary

The **QA / Punch List** is a structured issue type used during final-walk-through. A punch item is a specific, bounded defect: "Missing outlet in Room 304" or "Door frame 1.5mm off-spec on Level 2". Punch items have:

- **Checklist structure** — each item is pass/fail, not a discussion thread
- **Photo evidence** — multiple photos per item
- **Location binding** — tied to a BIM element (from Phase 3) or coordinates
- **Owner + due date** — who fixes it, by when
- **Trade categorization** — plumbing, electrical, structural, etc.

**Why now:** Phases 1-6 give us the data plane. The punch list is the structured workflow that closeout requires.

**Architectural decision:** Phase 7 extends **field-service** (Phase 2). Issues get a `kind: 'standard' | 'punch'` discriminator. Punch items have an attached `punch_data` JSONB column. Per Constitution §VII — no parallel qa-service.

---

## 2. Functional Requirements (FRs)

### FR-1 — Create a punch item
**As** a QA inspector
**I want** to create a punch item from the mobile app
**So that** the closeout list is captured on the spot.

- `POST /v1/projects/:projectId/issues` (extended from Phase 2)
- Body: `{ kind: 'punch', title, description, severity, coordinates?, captureId?, assignedTo?, dueDate?, trade?, location: { level, room, gridline } }`
- Returns: `{ issueId, status: 'open', clientIssueId }`
- Headers: `x-tenant-id`, `x-idempotency-key`
- 201 first / 200 on replay / 409 on duplicate

### FR-2 — Photo upload to a punch item
**As** the QA inspector
**I want** to attach multiple photos
**So that** the contractor has visual evidence.

- `POST /v1/projects/:projectId/issues/:id/photos`
- Multipart upload (binary photo + JSON metadata: `{ caption?, capturedAt, geo? }`)
- Returns: `{ photoId, sha256, sizeBytes, thumbnailUrl }`
- 201 on accept / 413 if > 10MB
- Up to 20 photos per item (NFR-3)

### FR-3 — Mark an item as resolved
**As** the contractor
**I want** to mark an item fixed and attach evidence
**So that** the inspector can re-verify.

- `POST /v1/projects/:projectId/issues/:id/resolve`
- Body: `{ actorId, resolutionNote, beforePhotoId?, afterPhotoId? }`
- Transitions: `open → in_progress → resolved` (existing state machine)
- 200 on success / 409 on wrong state

### FR-4 — Inspection pass / fail
**As** the inspector
**I want** to mark a resolved item as pass or fail
**So that** it can be re-opened if the fix is inadequate.

- `POST /v1/projects/:projectId/issues/:id/inspect`
- Body: `{ inspectorId, outcome: 'pass' | 'fail', note? }`
- If pass: `resolved → closed`
- If fail: `resolved → in_progress` (re-opened with audit trail)
- 200 on success

### FR-5 — Closeout report
**As** a project manager
**I want** to see closeout progress as a percentage
**So that** I know if the project is ready to hand over.

- `GET /v1/projects/:projectId/closeout`
- Returns: `{ total, byStatus, byTrade, completionPct, averageResolutionHours }`
- 200 with stats; 404 on no project

### FR-6 — Trade categorization
**As** a contractor
**I want** items tagged with a trade (plumbing, electrical, etc.)
**So that** I can filter to my work.

- `trade: 'plumbing' | 'electrical' | 'structural' | 'hvac' | 'finishes' | 'other'`
- Filter by trade in list endpoint
- Sum by trade in closeout report

### FR-7 — Location binding
**As** the inspector
**I want** to bind a punch item to a specific location
**So that** it's clear where the work is.

- `location: { level: string, room: string, gridline?: string }`
- Free-text level/room; gridline is BIM coordinate reference (e.g., "A-3")
- Coordinates (x,y,z) are alternative location (matches Phase 2)

### FR-8 — SSE on closeout changes
**As** the project dashboard
**I want** an SSE stream of closeout events
**So that** the dashboard updates without polling.

- `GET /v1/projects/:projectId/closeout/events`
- Emits: `punch.created`, `punch.assigned`, `punch.resolved`, `punch.inspected`, `punch.reopened`
- Tenant-scoped at delivery (cross-tenant = empty stream)
- History replay on connect (1 event: current state)

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every endpoint enforces `x-tenant-id` (or JWT claims for mobile). Cross-tenant = 404.

### NFR-2 — RFC 7807 errors
All errors return `application/problem+json` with 6-field shape.

### NFR-3 — Photo limits
Per-item max 20 photos. Per-photo max 10MB. Total per project: 1GB. Server returns 413 + hint on overflow.

### NFR-4 — Soft delete
Punch items are never hard-deleted. Use `deletedAt` (Constitution §V). Audit trail preserved.

### NFR-5 — Observability
`x-request-id` on every response. `/v1/metrics` exposes: `punch_items_total{kind, trade, status}`, `punch_photos_total{outcome}`, `punch_closeout_completion_bucket{projectId}`.

### NFR-6 — Authorization
- Create / Edit punch item: any org member with `qa_inspector` or `project_manager` role
- Resolve: any org member (the assigned contractor)
- Inspect (pass/fail): only `qa_inspector` role
- Closeout report: any org member

### NFR-7 — Backward compat with standard issues
Standard issues (Phase 2) keep working. `kind: 'punch'` is new; `kind` defaults to `'standard'` if not specified.

---

## 4. User scenarios

### Scenario A — Punch list walk
1. QA inspector starts a final-walk for Project A
2. App shows the project's BIM model (Phase 3 integration)
3. Inspector taps a point in the model → "Create punch item" sheet opens
4. App: `POST /v1/projects/A/issues` with `kind: 'punch', coordinates, trade, location`
5. App: `POST .../issues/:id/photos` with the floor photo
6. App: `POST .../issues/:id/assign` to the plumbing contractor with due date
7. Server emits `punch.created` SSE event
8. Dashboard updates closeout completion: 1/total

### Scenario B — Contractor fixes + re-verify
1. Plumbing contractor opens app, sees assigned items
2. App: `POST .../issues/:id/resolve` with before/after photos
3. State: `open → in_progress → resolved`
4. Server emits `punch.resolved` SSE
5. Inspector's dashboard: item shows as "ready to re-verify"
6. Inspector: `POST .../issues/:id/inspect` with `outcome: 'pass'`
7. State: `resolved → closed`
8. Closeout completion bumps to 2/total

### Scenario C — Reject fix
1. Inspector inspects a resolved item
2. App: `POST .../issues/:id/inspect` with `outcome: 'fail'`
3. State: `resolved → in_progress` (audit-trail entry recorded)
4. Server emits `punch.reopened` SSE
5. Contractor re-tries, re-resolves
6. Inspector passes → `closed`

### Scenario D — AI Copilot on punch list
1. PM asks: "How many open plumbing items?"
2. AI Copilot routes to field-service via Phase 4
3. List endpoint filters by `kind: 'punch'`, `status: 'open'`, `trade: 'plumbing'`
4. Returns: "7 open plumbing items"
5. PM taps one → navigates to detail view

---

## 5. Out of scope (for this Phase 7 MVP)

- **Photo storage optimization** — Phase 7.b. Phase 7 stores raw photos.
- **Geo-fencing** — auto-detect when inspector walks near a punch item. Phase 7.b.
- **Trade-specific templates** — pre-filled item templates by trade. Phase 7.b.
- **Mobile QR codes** — link punch items to physical QR codes. Phase 7.b.
- **Re-inspection scheduling** — calendar integration. Phase 7.b.

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **Extend or duplicate field-service?** — extend or parallel qa-service? **Default: extend (Constitution §VII).**
2. **Photo storage backend** — S3 (Phase 1.3) or local? **Default: S3 with LocalFs fallback (Phase 1.3 reuse).**
3. **Trade enum cardinality** — 6 trades or more granular? **Default: 6 trades (Phase 7.b can add more).**
4. **Closeout completion formula** — `(closed / total)` or weighted by severity? **Default: `(closed / total)`, plus by-status breakdown.**
5. **Punch auto-archive** — when project closes, archive all items? **Default: no; project status is separate concern.**
6. **Punch items in standard list?** — return all issues, or filter? **Default: list endpoint returns all; client filters by `kind`.**
7. **Photo caption localization** — captions in en-US only? **Default: en-US only in Phase 7 MVP; Phase 7.b adds i18n (Phase 6 pattern).**

