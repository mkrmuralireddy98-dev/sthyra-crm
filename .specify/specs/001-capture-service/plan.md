# Implementation Plan — Capture Service

**Feature ID:** 001-capture-service
**Date:** 2026-08-14
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source spec:** `spec.md`

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 22.22.3 | Pinned in repo (`package.json#engines`) |
| Language | TypeScript strict | Constitution §III |
| Web framework | Fastify 5 | Pinned in repo (org-service reference impl) |
| Database | Postgres 16 (RDS Aurora in prod) | Constitution §V |
| Object storage | AWS S3 + `LocalFsStorage` for dev | Standard |
| State | In-memory `InMemoryCaptureRepository` for dev; `PostgresCaptureRepository` for prod | Constitution §V |
| Queue (events) | Redis Pub/Sub | Existing in `packages/observability` & `apps/dashboard` |
| Orchestrator | AWS Step Functions | Standard for long-running workflows; SRE-approved |
| Auth | `@plumb/auth` middleware | Constitution §IV |
| Observability | `@plumb/observability` | Constitution §VI |
| Tests | `node:test` + `assert` | Pinned in repo |

## Architecture

```
┌──────────────┐                 ┌────────────────────┐
│  Mobile      │─── 1. POST ────▶│ capture-service    │
│  (iOS/Android)│   /v1/captures │ (Fastify + Postgres)│
│              │                 │                    │
│              │─── 2. PUT ─────▶│  ───┐               │
│              │   direct to S3  │     │ pre-signed    │
│              │   (signed URLs) │     │ URLs from      │
│              │◀── 3. (loop) ───│     │ capture-svc    │
│              │                 │  ───┘               │
│              │─── 4. POST ────▶│                    │
│              │   /complete      │                    │
└──────────────┘                 └──────┬─────────────┘
                                         │
                                         │ emits domain event
                                         │ (capture.uploaded)
                                         ▼
                                 ┌──────────────────┐
                                 │ pipeline-         │
                                 │ orchestrator      │
                                 │ (Step Functions)  │
                                 │                  │
                                 │ [decode]→[sfm]→  │
                                 │ [mesh]→[segment]→│
                                 │ [align]→[ready]  │
                                 └──────┬───────────┘
                                        │
                                        │ emits capture.ready
                                        ▼
                                 ┌──────────────────�
                                 │ realtime-gateway │
                                 │ (Phoenix)        │
                                 └──────┬───────────┘
                                        │ WebSocket push
                                        ▼
                                 ┌──────────────────┐
                                 │ Dashboard /      │
                                 │ Mobile clients   │
                                 └──────────────────┘
```

## Component Boundaries

| Component | Responsibility | Communicates with |
|---|---|---|
| **capture-service** | REST API for capture lifecycle, S3 pre-signing, chunk tracking | Postgres, S3, Redis (events) |
| **pipeline-orchestrator** | AWS Step Functions execution, stage dispatch, retry/DLQ | S3 (read/write), capture-service (status update), realtime-gateway (push) |
| **realtime-gateway** | WebSocket fan-out for capture.ready events | Redis (pub/sub) |
| **org-service** | Tenant + project lookup (the capture-service needs `:orgId` to enforce tenant boundary) | Postgres |
| **observability** | Logging + request-id propagation | n/a (shared library) |

## Data Model

### `captures` table (new)

```sql
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  client_capture_id TEXT NOT NULL,
  kind TEXT NOT NULL,           -- 'walkthrough_360' | 'drone' | 'laser_scan' (Phase 2)
  status TEXT NOT NULL,         -- 'draft' | 'uploading' | 'processing' | 'ready' | 'failed' | 'archived'
  device_model TEXT,
  device_os_version TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  total_chunks INTEGER,
  total_bytes BIGINT,
  sha256 TEXT,                  -- final hash of concatenated chunks
  artifact_urls JSONB,          -- {tiles, mesh, splats, segments, alignment}
  error_message TEXT,
  aggregate_cost_usd NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, client_capture_id)
);
CREATE INDEX IF NOT EXISTS captures_org_id_idx ON captures (org_id);
CREATE INDEX IF NOT EXISTS captures_project_id_idx ON captures (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS captures_status_idx ON captures (status) WHERE status IN ('processing', 'failed');
```

### `upload_sessions` table (new)

```sql
CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES captures(id),
  org_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  chunk_size_bytes INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  received_chunks INTEGER[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,         -- 'pending' | 'uploading' | 'complete' | 'abandoned'
  expires_at TIMESTAMPTZ NOT NULL,  -- chunk PUT URLs expire here
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS upload_sessions_capture_id_idx ON upload_sessions (capture_id);
CREATE INDEX IF NOT EXISTS upload_sessions_expires_at_idx ON upload_sessions (expires_at);
```

### `pipeline_runs` table (new)

```sql
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES captures(id),
  org_id TEXT NOT NULL,
  stage TEXT NOT NULL,          -- 'decode' | 'sfm' | 'mesh' | 'segment' | 'align'
  status TEXT NOT NULL,         -- 'pending' | 'running' | 'succeeded' | 'failed'
  attempt INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  artifacts JSONB,              -- stage-specific outputs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pipeline_runs_capture_id_idx ON pipeline_runs (capture_id);
CREATE INDEX IF NOT EXISTS pipeline_runs_status_idx ON pipeline_runs (status) WHERE status = 'running';
```

### `capture_metrics` table (new)

```sql
CREATE TABLE IF NOT EXISTS capture_metrics (
  capture_id TEXT NOT NULL REFERENCES captures(id),
  org_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  compute_seconds NUMERIC(10,3) DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  egress_bytes BIGINT DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (capture_id, stage)
);
CREATE INDEX IF NOT EXISTS capture_metrics_org_id_idx ON capture_metrics (org_id, recorded_at);
```

## API Surface

### REST endpoints (capture-service)

```
POST   /v1/projects/:projectId/captures
  Headers: Authorization, Idempotency-Key, X-Request-Id
  Body: { clientCaptureId, kind, deviceModel, deviceOsVersion, startedAt }
  → 201 { id, uploadSession: { id, chunkUrls[], chunkSizeBytes, expiresAt } }
  → 200 (Idempotency-Key hit: returns existing session)

GET    /v1/upload-sessions/:id
  Headers: Authorization
  → 200 { id, captureId, totalChunks, receivedChunks[], status, expiresAt }

POST   /v1/upload-sessions/:id/complete
  Headers: Authorization
  Body: { sha256 }
  → 200 { captureId, status: 'processing' }

POST   /v1/captures/:id/reprocess       [Phase 1.b, not MVP]
POST   /v1/captures/:id/archive
  Headers: Authorization
  → 204

GET    /v1/captures/:id
  Headers: Authorization
  → 200 { id, status, kind, startedAt, finalizedAt, artifactUrls, errorMessage, pipelineRuns[] }

GET    /v1/projects/:projectId/captures?status=&page=&limit=
  Headers: Authorization
  → 200 { data: Capture[], total, page, limit }

GET    /v1/health   (existing pattern in org-service)
```

All errors follow Constitution §IV: `application/problem+json` per
RFC 7807 with `trace_id` (= `request_id`).

### Domain events (Redis Pub/Sub)

- `capture.initiated` — when POST /v1/projects/:id/captures succeeds
- `capture.uploaded` — when all chunks received
- `capture.processing` — when pipeline starts
- `capture.ready` — when pipeline completes successfully
- `capture.failed` — when pipeline exhausted retries

These are the realtime-gateway's source of truth for WebSocket push
events.

## S3 Layout

Per Constitution §II (tenant isolation):

```
s3://sthyra-crm-raw-360-{region}/
  org/{orgId}/
    project/{projectId}/
      capture/{captureId}/
        raw/
          chunk-0000.bin
          chunk-0001.bin
          ...
          manifest.json     # sha256 + chunk count + metadata
        processed/          # populated by pipeline stages
          frames/
          tiles/
          mesh/
          splats/
          segments/
          alignment/
```

S3 IAM policy for the pipeline-orchestrator role scopes to the
capture-specific prefix (`capture/{captureId}/*`) — not the broader
project prefix.

## Testing Strategy

Per Constitution §I (TDD mandatory):

### Unit tests (per package)

- `CaptureService.create()` — idempotency on duplicate `(projectId, clientCaptureId)`
- `CaptureService.complete()` — sha256 verification, transition to `processing`
- `PostgresCaptureRepository` — parameterized SQL only, `FakePgClient` contract
- `LocalFsStorage` — chunk PUT/GET round-trip
- `S3Storage` — pre-signed URL generation, content-type handling
- `PipelineOrchestrator` — stage sequencing, retry policy, DLQ

### Integration tests

- Full HTTP round-trip: POST → chunk PUT → POST /complete → status transitions
- WebSocket push: `capture.ready` event → dashboard receives within 5s
- Tenant isolation: cross-tenant probe returns 404

### E2E tests

- Synthetic capture (50 MB test pattern) round-trips end-to-end
- Offline-mode: chunks upload after simulated network outage
- Crash recovery: server restart mid-pipeline resumes from last `running` stage

### Coverage

- ≥ 80% on changed lines (Constitution §Quality Gates)
- ≥ 90% on the `CaptureService` core (this is the critical path)

## Phasing (vertical slices)

Per Constitution, tasks run in **dependency order**. Below is the
dependency graph the tasks file will follow:

### Slice 1 — Foundations (T-001 to T-005)
- Package skeleton
- Domain types
- InMemory repository
- Repository interface
- Postgres repository (parameterized SQL only)

### Slice 2 — HTTP API (T-006 to T-010)
- POST /v1/projects/:id/captures with idempotency
- GET /v1/upload-sessions/:id
- POST /v1/upload-sessions/:id/complete
- POST /v1/captures/:id/archive
- GET /v1/captures/:id and GET /v1/projects/:id/captures

### Slice 3 — Storage (T-011 to T-014)
- BlobStorage interface
- LocalFsStorage implementation
- S3Storage implementation (pre-signed URLs)
- Storage tiering helper (S3 Standard → IA → Glacier)

### Slice 4 — Pipeline orchestrator (T-015 to T-022)
- Pipeline state machine
- Step Functions state definition
- Pipeline stage stubs (decode, sfm, mesh, segment, align)
- Retry policy + exponential backoff
- DLQ + on-call alert
- Pipeline run tracking (pipeline_runs table)

### Slice 5 — Realtime push (T-023 to T-025)
- Redis pub/sub integration
- Domain event emission
- WebSocket push trigger

### Slice 6 — Observability (T-026 to T-028)
- Structured logging integration
- Per-capture cost metrics
- SLO burn alerts

### Slice 7 — End-to-end test (T-029 to T-030)
- Synthetic capture round-trip test
- Offline-mode E2E test

## Risks

| Risk | Mitigation |
|---|---|
| Pre-signed URL expiry too short → mid-upload chunk rejection | Default 15 min; configurable per project; mobile auto-refreshes on expiry |
| S3 throttling on burst uploads | Use S3 Transfer Acceleration; rate-limit per-tenant in capture-service |
| Pipeline orchestrator's Step Functions cost adds up | Use Express Workflows (cheaper); reserve baseline capacity; spot for non-time-critical stages |
| Cross-tenant data leak via S3 prefix bug | Per-tenant IAM access points; pre-signed URLs are prefix-scoped; CI includes cross-tenant probe |
| Postgres `received_chunks INTEGER[]` grows unbounded | Partition by capture; archive chunks array to S3 once capture is `ready` |
| Mobile apps sending duplicate chunks (race conditions) | Content-hash dedup at the storage layer; chunk-level idempotency key |
| `pipeline_runs` table bloats under burst load | Partition by `created_at` monthly; archive old runs to S3 after 90 days |

## Dependencies (other services/features)

- **org-service** (built, committed) — provides tenant validation for
  the JWT `tenant_id` claim
- **observability** (built, committed) — provides request-id plugin
- **auth** (built, committed) — provides bearer-token middleware
- **tokens** (built, committed) — design system for any UI surfaced

The capture-service can begin work in parallel with **field-service**
and **track-service**; no upstream block.

## Out-of-Scope (deferred)

- Real ML pipeline (Phase 1.b): COLMAP, OpenMVS, 3DGS, SAM-2
- Drone ingestion (Phase 2)
- ARKit/ARCore relocalization (Phase 2)
- On-device redaction (Phase 2)
- Live streaming (Phase 3)
- Reprocess endpoint (Phase 1.b)

## Open architectural decisions (to resolve before /speckit.implement)

- **A1:** Step Functions Standard vs Express Workflows — recommend
  Express for ≤ 5-min stages (decode, segment), Standard for ≥ 1-hour
  stages (sfm, mesh). Resolve in Stage 6.
- **A2:** Redis vs NATS JetStream for event bus — recommend Redis
  (already in stack). Resolve in Stage 6.
- **A3:** Real-time push implementation — recommend Phoenix Channels
  on `realtime-gateway` (existing service per master plan). Resolve in
  Stage 5.
