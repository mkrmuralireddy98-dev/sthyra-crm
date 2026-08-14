# Feature Specification — Capture Service

**Feature ID:** 001-capture-service
**Status:** Draft (Stage 2 of spec-kit)
**Date:** 2026-08-14
**Conformance:** `.specify/memory/constitution.md` v1.0.0

## Overview

The Capture Service is the ingestion heart of Sthyra CRM. It receives
360° video walks (and other reality-capture uploads — drone, laser
scan) from field mobile clients, validates and stores them durably,
chunks-and-uploads to S3 with idempotent resumability, and orchestrates
the async spatial AI pipeline that produces the photoreal novel-view
rooms and BIM-aligned artifacts the rest of the product consumes.

This is the **single most important service in Phase 1**: every other
product (Field, Track, Model, Live, Twin) depends on capture-ready
artifacts. If the capture pipeline is slow, lossy, or offline-broken,
the product fails at the field — which is exactly where Sthyra CRM's
value proposition lives.

This spec covers **Phase 1 MVP scope only**: chunked upload, in-memory
orchestration, stubbed spatial AI (per Constitution Principle II's
"don't fabricate" rule — we stub the GPU stages, we don't fake the
results). Real ML models come in Phase 1.b with their own spec.

## Functional Requirements

### FR-1 — Capture session initiation

A field client starts a capture by calling `POST /v1/projects/:projectId/captures`
with a JSON body describing the device, capture type, and a
client-generated `clientCaptureId` (UUIDv7). The server returns an
**upload session** with a unique `uploadSessionId`, the list of
pre-signed S3 URLs for chunk uploads, the chunk size, and the
`status: 'uploading'` capture state.

**Idempotency:** the request must include `Idempotency-Key`; the
`(projectId, clientCaptureId)` tuple is unique. A retry of the same
request returns the same upload session, never a new one.

### FR-2 — Chunked resumable upload

The mobile client uploads each chunk directly to S3 via the pre-signed
URL returned by FR-1. Each chunk is 8 MB by default (configurable per
project). The server tracks which chunks have been received (via
`received_chunks: int[]` on the upload session).

**Resume:** if the connection drops mid-upload, the mobile can call
`GET /v1/upload-sessions/:id` to learn which chunks the server already
has, then resume from there. Chunks are content-addressable (sha256 in
metadata); a duplicate chunk PUT is a no-op.

**Failure:** if a chunk's MD5 doesn't match the server's hash, the chunk
is rejected and the client must retry.

### FR-3 — Capture finalization

When all chunks are uploaded, the mobile calls
`POST /v1/upload-sessions/:id/complete` with the final sha256. The server:

1. Concatenates the chunks, verifies the final hash.
2. Transitions the capture from `uploading` → `processing`.
3. Enqueues a `pipeline_run` (Stage 1 = stubbed `decode`).
4. Transitions the upload session to `complete`.

### FR-4 — Pipeline state machine

The pipeline has these states (per capture):

```
draft → uploading → processing → (decoding → sfm → meshing → segmenting → aligning) → ready
                       ↘ failed (any stage error after retries exhausted)
                       ↘ archived (user or retention policy)
```

Every transition writes a `pipeline_run` row. Transitions are idempotent.
Failures route to a DLQ with an on-call alert. User-visible state flips
`processing → ready` via WebSocket push (realtime-gateway).

### FR-5 — Pipeline stage contract

The pipeline orchestrator runs these stages **sequentially** (parallel
where noted). For Phase 1 MVP, **all stages are stubbed** (setTimeout
+ log) — the real ML pipeline comes in Phase 1.b. The **contract**
between the orchestrator and the stages must be stable now so the real
stages drop in without API change:

- Input: `{ captureId, capturePath, projectId, region }`
- Output: `{ stageName, status, artifacts?, error? }`
- Retry policy: 3 attempts with exponential backoff per stage; DLQ after.

**Stages (Phase 1 stubs):**
1. `decode` — extracts equirectangular frames (stub: log + 100ms sleep)
2. `sfm` — Structure-from-Motion (stub)
3. `mesh` — dense MVS + Poisson (stub)
4. `segment` — SAM-2 semantic segmentation (stub)
5. `align` — DINOv2 + ICP BIM alignment (stub)

Each stage emits a `pipeline_run` row on start/complete/fail.

### FR-6 — Status query

`GET /v1/captures/:id` returns the capture with its current status,
the pipeline stages' status, and the artifact URLs (when ready).
`GET /v1/projects/:projectId/captures` lists captures for a project
with pagination + filters.

### FR-7 — WebSocket push on ready

When a capture transitions to `ready`, the service emits a domain event
to the realtime-gateway (via Redis Pub/Sub) that triggers a WebSocket
push to all connected clients viewing the project. Payload:
`{ type: 'capture.ready', captureId, projectId, artifacts: [...] }`.

### FR-8 — Retention & archival

Captures are archived per the project's retention policy (default
7 years for SOC 2 / FedRAMP, configurable per tenant). Archival moves
the data from S3 Standard → S3 Glacier; the database row is preserved
with `status: 'archived'`. Archival is a soft transition — the capture
is still queryable, just not downloadable from the primary tier.

## Non-Functional Requirements

### NFR-1 — Performance

- **Initiation latency:** p95 < 200ms (server-side, excludes network)
- **Chunk PUT latency:** direct to S3, p95 < 1s per chunk
- **Pipeline wall-clock (stubbed Phase 1):** < 30s end-to-end (the stubs
  are intentionally fast; real ML is much slower)
- **Pipeline wall-clock (real Phase 1.b target):** p50 ≤ 1.3h, p95 ≤ 3h
- **GET /v1/captures/:id:** p99 < 200ms

### NFR-2 — Reliability

- **Upload success rate:** ≥ 99.5% per session (per Constitution SLO)
- **No data loss on network failure:** every chunk is durable in S3
  before the server considers it received
- **Idempotent retries:** re-uploading the same `Idempotency-Key`
  produces the same outcome, never a duplicate
- **Crash recovery:** if the server crashes mid-pipeline, a restart
  re-enqueues any `processing` captures whose stage didn't complete

### NFR-3 — Tenant isolation

- Every row carries `projectId` → `orgId` → `region`. The
  `CaptureService.list()` query enforces the tenant boundary.
- S3 objects live under `s3://sthyra-crm-raw-360-{region}/org/<orgId>/project/<projectId>/capture/<captureId>/`.
- The pre-signed URL is scoped to that exact prefix; a leaked URL
  cannot access other tenants' data.

### NFR-4 — Observability

- Every log line structured JSON with `request_id` (per Constitution §VI).
- The `pipeline_run` table is the source of truth for stage-level
  observability — every stage's start/complete/fail is recorded with
  timestamps.
- SLO burn alerts: ingestion success rate < 99.5% for 5 minutes → on-call.
- Per-capture cost telemetry: compute-minutes, storage-bytes, egress-bytes
  recorded in `capture_metrics` for FinOps.

### NFR-5 — Security

- Pre-signed S3 URLs expire in **15 minutes** (configurable per project).
- The capture `clientCaptureId` is a UUIDv7 generated client-side; it is
  not a secret (it's an idempotency key, not an authentication token).
- All endpoints require `Authorization: Bearer <jwt>` and a `tenant_id`
  claim matching the `orgId` on the project.
- Pipeline stages run in **separate AWS Step Functions** with IAM
  roles scoped to the specific S3 prefix; no stage has access to a
  broader prefix than its own capture's path.

### NFR-6 — Storage tiering

- Raw 360° video: S3 Standard (hot 30d) → Standard-IA (90d) → Glacier
  (365d+)
- Pipeline artifacts (frames, tiles, sparse point clouds): S3 Standard
  (90d) → Standard-IA (365d)
- BIM-aligned artifacts (model, transforms): S3 Standard-IA (30d)
- Captures older than 7 years: Glacier Deep Archive

## User Scenarios

### US-1 — Field walk capture (happy path)

**Given** Maya is a superintendent on iOS 17 with the Sthyra CRM
mobile app and a paired Insta360 X4.

**When** she taps "Start walk" on a project, walks the site for 15
minutes, and taps "Finish".

**Then** the app:
1. POSTs `/v1/projects/:id/captures` (FR-1)
2. Uploads 47 chunks of 8 MB to S3 directly (FR-2)
3. POSTs `/v1/upload-sessions/:id/complete` (FR-3)
4. Receives a WebSocket `capture.ready` push within 30 seconds (FR-7)

**And** Maya sees the capture in the project timeline on her dashboard,
clickable to view the 360° walk.

### US-2 — Offline capture with reconnect

**Given** Maya is on a site with no cell coverage for 30 minutes.

**When** she captures a walk offline.

**Then** the app queues the entire capture in local SQLite.

**And** when she regains connectivity (Wi-Fi at the trailer), the
chunks upload in the background via `URLSession.background` (iOS) /
`WorkManager` (Android) (FR-2).

**And** the capture becomes "ready" without any manual retry.

### US-3 — Failed pipeline retry

**Given** the spatial AI pipeline fails at the `sfm` stage because of
corrupted frames.

**When** the orchestrator detects the failure.

**Then** it:
1. Writes a `pipeline_run` row with `status: 'failed'`.
2. Retries with a smaller image pool (3 attempts, exponential backoff).
3. If still failing, routes to the DLQ + on-call alert.
4. Sets the capture `status: 'failed'` with an error message visible
   to the user: "Spatial AI pipeline failed — our team has been alerted."

## Success Criteria

- **SC-1:** A 50 MB capture round-trips (POST → chunks → complete →
  ready) end-to-end in < 30s with the stubbed pipeline.
- **SC-2:** An offline capture uploads in full when connectivity
  returns, with zero data loss across an app kill + airplane mode cycle.
- **SC-3:** 100 simultaneous concurrent uploads succeed with no
  cross-tenant leakage (verified by tenant-isolation probe tests).
- **SC-4:** The pipeline stage transition log allows a developer to
  reconstruct any capture's full history from `pipeline_run` rows
  alone.
- **SC-5:** The `capture_metrics` row enables per-tenant cost attribution
  accurate to within ±5% of actual S3 + compute spend.

## Out of Scope (Phase 1)

- Real spatial AI models (SAM-2, DINOv2, COLMAP, OpenMVS, 3DGS) —
  Phase 1.b.
- Drone ingestion (Plumb Air) — Phase 2.
- 3D laser scan ingestion (Matterport, Leica) — Phase 2.
- ARKit/ARCore visual relocalization — Phase 2.
- Live streaming of in-progress captures — Phase 3 (Plumb Live).
- On-device redaction (PII face/plate blur) — Phase 2.
- Mobile-specific upload optimizations (chunk size adaptation, Wi-Fi
  vs cellular detection) — Phase 2.

## Open Questions (move to `/speckit.clarify`)

- **Q1:** Does the capture pipeline support re-upload after partial
  failure (i.e., re-running the pipeline on the same raw chunks)?
  *(Default: yes — `POST /v1/captures/:id/reprocess` is a Phase 1.b
  endpoint. For Phase 1 MVP, this is out of scope.)*
- **Q2:** Should `capture_metrics` be per-capture or per-stage?
  *(Default: per-stage, rolled up to per-capture.)*
- **Q3:** What happens to a capture whose project is deleted while
  the pipeline is in-flight?
  *(Default: pipeline continues; the capture is orphaned; retention
  policy still applies. Cleanup is a separate batch job.)*
- **Q4:** Does the capture service own the pipeline orchestrator, or
  is it a separate `pipeline-orchestrator` service?
  *(Default: separate service. The capture service emits domain events;
  the orchestrator consumes them. Better separation of concerns.)*
- **Q5:** Is the pipeline idempotent (re-running produces the same
  artifacts) or destructive (re-running replaces artifacts)?
  *(Default: idempotent — same input + same model version produces the
  same artifact URLs.)*
