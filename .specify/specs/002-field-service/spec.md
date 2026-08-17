# Feature Specification — Field Service

**Feature ID:** 002-field-service
**Status:** Draft (Stage 2 of spec-kit, 2026-08-17)
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Phase:** 2 of N — second product feature after Capture Service

---

## Why this feature exists

After the Capture Service ingests a 360° walkthrough and the spatial-AI
pipeline produces a textured mesh, the field crew still has work to do.
They walk the actual site, compare what was captured to what's actually
there, and **raise issues** against specific coordinates (e.g., "this wall
section is showing through to the rebar — needs another scan") and **resolve**
them over time. The Capture Service answers *what's in the building*. The
Field Service answers *what's wrong with the building*.

This is the second product line on the Sthyra CRM platform. It mirrors
OpenSpace's "Field Notes" / "Issues" workflow but is rebuilt from scratch
with multi-tenant isolation, RFC 7807 errors, and a strict Idempotency-Key
contract.

---

## What it ships

### Functional requirements

| # | Requirement | Acceptance |
|---|---|---|
| FR-1 | `POST /v1/projects/:projectId/issues` creates an issue tied to a capture and 3D coordinate | 201 Created; tenant-scoped; requires `Idempotency-Key` |
| FR-2 | `GET /v1/projects/:projectId/issues` lists issues with filters (status, severity, assignedTo, captureId) | 200; pagination via `?cursor=`; default 50/page |
| FR-3 | `GET /v1/projects/:projectId/issues/:id` returns issue with full timeline (status transitions, comments, file attachments) | 200; cross-tenant → 404 |
| FR-4 | `PATCH /v1/projects/:projectId/issues/:id` updates fields (status, assignee, severity, dueDate) | 200; emits `issue.updated` event |
| FR-5 | `POST /v1/projects/:projectId/issues/:id/comments` adds a comment (text + optional attachments) | 201; comment author must be org member |
| FR-6 | `POST /v1/projects/:projectId/issues/:id/resolve` marks issue as resolved (status=resolved) | 200; requires resolution note |
| FR-7 | `POST /v1/projects/:projectId/issues/:id/reopen` reopens a resolved issue (status=open) | 200; requires reopen reason |
| FR-8 | `GET /v1/projects/:projectId/issues/:id/events` SSE stream of status changes + comments | text/event-stream; history replay + live |
| FR-9 | Issue ID is server-assigned UUID v7 (time-ordered for sortability) | hex string |
| FR-10 | Coordinates are 3D (x, y, z) in the capture's local coordinate system, derived from the ICP transform | stored as `coordinates: {x: number, y: number, z: number}` |

### Non-functional requirements

| # | Requirement | Acceptance |
|---|---|---|
| NFR-1 | Tenant isolation: cross-tenant reads/writes return 404 | verified by `tenant-isolation.test.ts` |
| NFR-2 | All state mutations emit a DomainEvent (`issue.created`, `issue.updated`, `issue.commented`, `issue.resolved`, `issue.reopened`) | events written to `event_outbox` (re-use Phase 1 outbox pattern) |
| NFR-3 | Structured logging at every state transition (Constitution §VI) | emit() called by service layer |
| NFR-4 | Idempotency-Key honored on POST endpoints | 201 first, 200 on replay, 400 missing |
| NFR-5 | RFC 7807 problem+json for every error response | verified by `http.test.ts` |
| NFR-6 | Request-id propagated (x-request-id header, trace_id in problem+json) | verified by `observability.test.ts` |
| NFR-7 | Pagination cursor is opaque, signed (HMAC), TTL 24h | cursor encodes `createdAt + id`; tampering → 400 |
| NFR-8 | Soft-delete: deleting an issue sets `deleted_at` (no hard delete in v1) | list/get filter out soft-deleted |
| NFR-9 | Service-level tests use real database (Postgres test container in CI); no fakes for storage layer | per Constitution §V |

### User scenarios

#### Scenario 1: Crew lead raises an issue from a walkthrough

> Maria the crew lead opens the dashboard for project `prj_42`. She
> clicks on a wall section in the 3D viewer at coordinate (3.2, 1.1, 0.5).
> She selects "Raise Issue", picks severity "medium", types
> "Missing MEP detail in this section — needs another scan", and submits.

**Flow:**
1. `POST /v1/projects/prj_42/issues` with `{captureId, coordinates: {x:3.2,y:1.1,z:0.5}, severity: 'medium', title: '...', description: '...'}`
2. Server validates tenant scope (capture belongs to org_a, request from org_a).
3. Issue created with status='open', assignedTo=null.
4. `issue.created` event emitted to event_outbox.
5. Returns 201 with the new issue.

#### Scenario 2: Field engineer resolves the issue

> Bob the field engineer walks the site, takes a new scan of the missing
> MEP section, attaches it as a comment, marks the issue resolved.

**Flow:**
1. Bob uploads the attachment → gets a presigned URL → uploads to S3.
2. `POST /v1/projects/prj_42/issues/{id}/comments` with `{text: 'Re-scanned; see attached', attachments: [{key, contentType, sha256}]}`
3. `issue.commented` event emitted.
4. `POST /v1/projects/prj_42/issues/{id}/resolve` with `{resolutionNote: 'Verified MEP detail now matches'}`
5. Status transitions open → resolved; `issue.resolved` event emitted.
6. The capture it was tied to gets a new pipeline_runs row referencing the issue id.

#### Scenario 3: Manager reopens a falsely-resolved issue

> Carol the project manager reviews Bob's resolution, disagrees, reopens.

**Flow:**
1. `POST /v1/projects/prj_42/issues/{id}/reopen` with `{reason: 'MEP detail still mismatched; needs architect review'}`
2. Status transitions resolved → open; assignee reset to null.
3. `issue.reopened` event emitted.

---

## What it does NOT ship (out of scope for v1)

- **Real-time WebSocket presence** (who's viewing the issue) — use SSE for now
- **Email/SMS notifications** — Phase 3
- **Bulk import** (CSV upload of issues) — not requested
- **Custom fields per project** — schema is fixed for v1
- **AI-suggested issues** (auto-detect problems from the mesh) — separate spec
- **Mobile push notifications** — Phase 3
- **Multi-language** — English only for v1 (i18n via separate spec)
- **Hard delete** — soft-delete only (NFR-8)

---

## Open questions (resolved in /speckit.clarify)

- Q1: **Pagination strategy** — cursor-based (HMAC-signed), 50/page default, 200/page max
- Q2: **Issue numbering** — server-assigned UUID v7 (time-ordered), not human-readable "ISS-001"
- Q3: **Severity levels** — `low | medium | high | critical` (4 levels, no custom)
- Q4: **Status values** — `open | in_progress | resolved | wont_fix` (4 values)
- Q5: **Comment attachments** — store references to capture-service chunks, not new uploads
- Q6: **SSE event format** — same wire format as capture-service events (issue.* prefix)
- Q7: **Authorization model** — every org member can create/comment; only assignees + managers can resolve
