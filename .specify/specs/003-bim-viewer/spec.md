# Feature Specification — BIM Viewer

**Feature ID:** 003-bim-viewer
**Phase:** 3 (third feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Source schemas consumed:**
- `services/capture-service/` — capture pipeline, ready capture = 3D point cloud
- `services/field-service/` — issue tracker with coordinate annotations
- `packages/tokens/` — design palette

---

## 1. Summary

The **BIM Viewer** is the visualization layer that ties captures to BIM (Building Information Modeling) source models. After a site walk-through, the field lead views the captured point cloud superimposed on the BIM model — they can pick a point in the cloud and see the BIM element under that point, surface issues tied to specific elements, and verify that the build matches the model.

**Why now:** Both Phase 1 (capture-service) and Phase 2 (field-service) are complete. Without BIM Viewer, the captured point clouds are just numbers; without it, the issues have no visual context. The BIM Viewer is the product moment — it's what the customer actually pays for.

---

## 2. Functional Requirements (FRs)

### FR-1 — BIM model upload
**As** a project manager
**I want** to upload an IFC (Industry Foundation Classes) model to a project
**So that** the model is associated with future captures for alignment.

- `POST /v1/projects/:projectId/bim-model`
- Body: `{ fileName: string, contentType: 'ifc' | 'ifczip', sha256: string, sizeBytes: number, schemaVersion: string }`
- Returns the uploaded model's id + an upload-session id for chunked PUT
- Headers: `x-tenant-id`, `x-idempotency-key`
- 201 first / 200 on replay / 409 on duplicate sha256

### FR-2 — BIM model status poll
**As** a client (browser/mobile)
**I want** to poll the BIM model status
**So that** the UI can show progress (uploading → validating → processing → ready).

- `GET /v1/projects/:projectId/bim-model`
- Returns the current state + last updated timestamp
- 404 if no model attached to the project yet
- 200 with `{ state, schemaVersion, totalElements, modelHash, processedAt }`

### FR-3 — Capture ↔ BIM alignment
**As** a field lead
**I want** to align a 3D capture to the BIM model
**So that** every world point is mapped to a BIM element id.

- `POST /v1/projects/:projectId/captures/:captureId/align`
- Body: `{ actorId: string }`
- Triggers the `align` stage (already in capture-service pipeline)
- Returns `{ jobId: string }`
- 202 Accepted (async)
- 404 if either the BIM model or the capture doesn't exist in this tenant

### FR-4 — Lookup element at world point
**As** a dashboard
**I want** to query "what BIM element is at world point (x, y, z)?"
**So that** the UI can label each captured region with the structural element name.

- `POST /v1/projects/:projectId/bim-model/element-lookup`
- Body: `{ x: number, y: number, z: number }`
- Returns `{ elementId: string, elementName: string, elementType: 'IfcBeam' | 'IfcWall' | 'IfcSlab' | string, distance: number }` OR `{ elementId: null }` if no element within `lookupRadiusMeters` (default 0.5m)
- 400 on invalid coordinates
- 404 on no model attached

### FR-5 — List captures aligned to this BIM
**As** a project manager
**I want** to list all captures aligned to this BIM model
**So that** I see the complete walk-through history.

- `GET /v1/projects/:projectId/bim-model/aligned-captures`
- Returns `{ id, status, alignedAt, totalPoints, issuesCount }`
- 404 on no model

### FR-6 — Get BIM diff (capture vs model)
**As** a quality engineer
**I want** to see what changed between the BIM model and the most recent capture
**So that** I can flag deviations (e.g., a wall removed in the field that the model still shows).

- `GET /v1/projects/:projectId/bim-model/diff?captureId=:captureId`
- Returns `{ deviations: [{ elementId, deviationType, severity, distance, description }], deviationCount }`
- 404 on missing model or capture
- 202 if the diff is still being computed (the client retries with backoff)

### FR-7 — Subscribe to BIM events (SSE)
**As** a dashboard
**I want** an SSE stream of BIM events
**So that** the UI updates without polling when the model is processed, captures are aligned, or diffs are computed.

- `GET /v1/projects/:projectId/bim-model/events`
- Emits `bim.uploaded`, `bim.validated`, `bim.ready`, `bim.aligned`, `bim.diff_computed`, `bim.failed`
- Tenant-scoped (cross-tenant = empty stream)
- History replay on connect (1 event: current state)

### FR-8 — Delete BIM model (soft-delete)
**As** a project manager
**I want** to delete a BIM model
**So that** I can replace it with a newer version.

- `DELETE /v1/projects/:projectId/bim-model`
- 204 No Content
- Soft-delete via `deletedAt` (Constitution §V — no hard delete in v1)
- 404 on no model

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
**Every** API call carries `x-tenant-id`; every SQL query starts with `WHERE org_id = $1`; every cache key includes `orgId`; SSE events filter by tenant. Cross-tenant requests return 404 (no existence leak).

### NFR-2 — Authorization (Phase 3 MVP)
Any authenticated org member can read the BIM model and run lookups. Upload, delete, and re-align require `project_manager` role from membership-service (mirrors the Phase 2 Q7 deferred-to-A6 pattern).

### NFR-3 — Tenant-scoped file storage
BIM IFC files are stored in S3 (with LocalFs fallback for dev). Storage key: `bim/{orgId}/{projectId}/{modelHash}.ifc`. Tenant boundary enforced at the storage layer (key prefix = orgId).

### NFR-4 — Performance
- Element-lookup: p95 < 200ms for models up to 100k elements (per-element precomputed bbox tree)
- Diff: p95 < 5s for capture vs 100k-element model (delta-comparison, not full scan)
- SSE: 1 fan-out per subscriber, no buffering

### NFR-5 — Errors
All errors return `application/problem+json` with 6-field shape: `{ type, status, title, detail, trace_id, code }`. Status codes per spec.md FRs.

### NFR-6 — Idempotency
POST endpoints require `x-idempotency-key` header (Constitution §IV). Replay returns 200 with the original body; new attempt with different params returns 409.

### NFR-7 — Observability
- Request-id propagation: every response includes `x-request-id` header
- Structured logs: every state transition emits a log line with captureId/projectId/orgId
- `/v1/metrics` endpoint exposes Prometheus-format counters: `bim_models_total{state}`, `bim_alignment_jobs_total{outcome}`, `bim_element_lookups_total`, `bim_diffs_total{status}`

### NFR-8 — Pagination
Aligned-captures list is paginated via HMAC-signed cursor (max 200 per page, default 50). Same pattern as field-service pagination.ts.

### NFR-9 — Security
BIM IFC files can contain proprietary information. Models are private to the org — no cross-tenant reads, no public URLs. S3 keys include `orgId` prefix; storage layer enforces tenant boundary.

---

## 4. User scenarios

### Scenario A — Project setup
1. PM uploads a 4MB IFC file (`POST /v1/projects/:id/bim-model`)
2. Server begins async validation (checks IFC schema version, parses entities)
3. Server emits `bim.uploaded` SSE event
4. Validation completes ~30s later; server emits `bim.validated` → `bim.ready`
5. PM receives SSE event; UI shows green checkmark

### Scenario B — Capture alignment + lookup
1. Field lead walks the site → `captureId cap_001` is uploaded (existing capture-service pipeline)
2. Capture finishes processing → status `ready`
3. PM triggers `POST /v1/projects/:id/captures/cap_001/align` → server emits `bim.aligned`
4. Dashboard opens the capture view → user clicks at world point (1.5, 2.5, 0.5)
5. `POST .../element-lookup { x: 1.5, y: 2.5, z: 0.5 }` returns `{ elementId: 'beam_001', elementName: 'Level 3 East Beam', elementType: 'IfcBeam', distance: 0.03 }`
6. Dashboard labels the point with "L3 East Beam" (Constitution §II — tenant-specific name)

### Scenario C — Diff scan
1. Field crew mounts a wall that was NOT in the original BIM (3 weeks after baseline walk)
2. New capture `cap_007` uploaded, aligned to BIM
3. PM requests `GET /v1/projects/:id/bim-model/diff?captureId=cap_007`
4. Returns `{ deviations: [{ elementId: 'wall_024', deviationType: 'extra', severity: 'major', distance: 1.2m, description: 'New wall mounted, not in BIM' }] }`
5. PM creates a `phase_3.task` tied to `wall_024`

---

## 5. Out of scope (for this Phase 3 MVP)

- **3D rendering pipeline** — the bim-viewer-service exposes the data model only; the actual three.js front-end is a separate `apps/dashboard-webgl/` workstream.
- **Federated BIM merge** — when a project has multiple revisions of the BIM model, we keep the latest. Diffing across multiple models is Phase 4.
- **LOD generation** — Level-of-Detail mesh simplification is Phase 4.
- **Real-time BIM collaboration** — multiple users editing the same model concurrently is Phase 5.
- **CAD formats** — we accept IFC only. Revit/Navisworks/CAD conversion is a separate project.

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **IFC schema coverage** — IFC 2x3 only, or also IFC 4 / IFC 4x3? Default IFC 4x3 (the modern Industry Foundation Classes).
2. **Storage tier** — IFC files go to S3 standard tier (not Glacier), with LocalFs fallback for dev. Default S3 standard.
3. **Alignment algorithm** — ICP (Iterative Closest Point), or just GPS+initial-guess? Default ICP via our Phase 1.4 IcpAlignStage.
4. **Cache strategy** — precomputed bbox tree per model, in-memory. Phase 3.b migrates to Redis.
5. **Diff accuracy** — point-to-mesh distance threshold: how many meters count as a deviation? Default 0.05m (5cm).
6. **Authorization** — defer to membership-service for `project_manager` role checks. (Resolves to plan §A6 pattern.)
7. **Versioning** — do we soft-delete the old model when a new one is uploaded, or keep history? Default: keep history (audit trail); the `currentModelId` field points to the active one.

