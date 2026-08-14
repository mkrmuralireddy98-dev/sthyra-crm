# Quality Checklist — Capture Service

**Feature ID:** 001-capture-service
**Date:** 2026-08-14
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source spec:** `spec.md`

## How to use this checklist

Each row is a verifiable test item. Items are derived from the spec
clauses (FR / NFR / SC / US) and the constitution principles. A feature
is "done" when **every item is checked off with evidence** (test name,
file path, commit SHA, or screenshot reference).

This checklist is the **release-candidate gate**. Do not promote to
production with any unchecked item.

---

## Functional (FR coverage)

### FR-1 Capture session initiation
- [ ] POST /v1/projects/:id/captures creates an upload session and returns pre-signed S3 URLs
- [ ] Required headers (`Authorization`, `Idempotency-Key`) are validated
- [ ] Same `Idempotency-Key` returns the same upload session (200, not 201)
- [ ] Duplicate `(projectId, clientCaptureId)` without idempotency key → 409
- [ ] Missing `Authorization` → 401
- [ ] JWT `tenant_id` mismatch → 403
- [ ] `Idempotency-Key` is logged at `info` level with `request_id`

### FR-2 Chunked resumable upload
- [ ] Mobile can PUT chunks directly to pre-signed S3 URLs (no API gateway involvement)
- [ ] `received_chunks[]` is updated on every successful PUT
- [ ] Duplicate chunk PUT is a no-op (content-hash dedup)
- [ ] Mid-upload network drop + reconnect resumes from `received_chunks[]`
- [ ] Chunk MD5 mismatch → rejected
- [ ] Pre-signed URLs expire in 15 minutes (configurable per project)
- [ ] `expires_at` enforced — PUT to expired URL fails

### FR-3 Capture finalization
- [ ] All chunks present + sha256 match → capture transitions to `processing`
- [ ] sha256 mismatch → 400
- [ ] Missing chunks → 409
- [ ] Finalization emits `capture.uploaded` domain event
- [ ] Pipeline run row inserted at `status: 'running'` for the `decode` stage

### FR-4 Pipeline state machine
- [ ] State transitions: `draft → uploading → processing → ready | failed | archived`
- [ ] Invalid transitions throw (e.g., `ready → uploading`)
- [ ] Every transition writes a `pipeline_runs` row
- [ ] Idempotent: same transition request → no duplicate row
- [ ] User-visible status flips `processing → ready` via WebSocket push within 5 seconds

### FR-5 Pipeline stage contract
- [ ] Stage contract is stable: `{ captureId, capturePath, projectId, region }` input, `{ stageName, status, artifacts?, error? }` output
- [ ] Retry policy: 3 attempts, exponential backoff
- [ ] After 3 failed attempts → DLQ + on-call alert
- [ ] All 5 stages (`decode`, `sfm`, `mesh`, `segment`, `align`) are stubbed for Phase 1 MVP
- [ ] Each stage emits a `pipeline_run` row on start/complete/fail

### FR-6 Status query
- [ ] GET /v1/captures/:id returns the full capture with `pipelineRuns[]`
- [ ] GET /v1/projects/:id/captures supports pagination (`?page=&limit=`)
- [ ] GET /v1/projects/:id/captures supports `?status=` filter
- [ ] Cross-tenant probe → 404 (not 403, to avoid existence leakage)
- [ ] Cross-org probe → 403

### FR-7 WebSocket push on ready
- [ ] `capture.ready` event triggers WebSocket push to all clients subscribed to the project
- [ ] Payload includes `captureId`, `projectId`, `artifactUrls[]`
- [ ] Push arrives within 5 seconds of `ready` transition

### FR-8 Retention & archival
- [ ] Archive endpoint soft-transitions: capture remains queryable
- [ ] Archival moves S3 objects: Standard → IA (90d) → Glacier (365d)
- [ ] Retention policy per tenant: default 7 years, configurable
- [ ] `captures.status: 'archived'` is queryable

---

## Non-functional (NFR coverage)

### NFR-1 Performance
- [ ] Initiation latency: p95 < 200ms server-side
- [ ] Chunk PUT latency: p95 < 1s per chunk (measured from mobile over 4G)
- [ ] Stubbed pipeline wall-clock: < 30s end-to-end
- [ ] GET /v1/captures/:id p99 < 200ms

### NFR-2 Reliability
- [ ] Upload success rate ≥ 99.5% per session (measured in staging over 100 captures)
- [ ] No data loss on network failure (verified by E2E test that kills the mobile app mid-upload)
- [ ] Idempotent retries verified by 100-iteration stress test
- [ ] Crash recovery: server restart mid-pipeline resumes from last `running` stage

### NFR-3 Tenant isolation
- [ ] Every row carries `projectId` → `orgId` → `region`
- [ ] S3 pre-signed URLs are prefix-scoped (cannot access other tenants)
- [ ] Cross-tenant probe at the repository layer returns `null` (no leak)
- [ ] Cross-tenant probe at the HTTP layer returns 404 (no leak)
- [ ] **Test must fail** when probing cross-tenant — confirms isolation

### NFR-4 Observability
- [ ] Every log line is structured JSON with `request_id`
- [ ] No `console.log` in production code (lint rule or audit)
- [ ] `pipeline_runs` table enables full capture history reconstruction
- [ ] SLO burn alerts route to on-call via PagerDuty (or CloudWatch Alarms)
- [ ] Per-capture cost in `capture_metrics` within ±5% of actual spend

### NFR-5 Security
- [ ] Pre-signed S3 URLs expire in 15 minutes (configurable)
- [ ] `Authorization: Bearer <jwt>` required on every endpoint
- [ ] JWT `tenant_id` claim matches `orgId` on the project (403 otherwise)
- [ ] Step Functions IAM roles scoped to per-capture S3 prefix (not broader)
- [ ] Sensitive-path PRs require Security Lead sign-off (per Constitution §Compliance)

### NFR-6 Storage tiering
- [ ] Raw 360°: Standard (hot 30d) → IA (90d) → Glacier (365d)
- [ ] Artifacts: Standard (90d) → IA (365d)
- [ ] BIM-aligned artifacts: IA (30d)
- [ ] Captures older than 7 years: Glacier Deep Archive
- [ ] `tierFor(age)` function tested for all age boundaries (0d, 30d, 90d, 365d)

---

## User Scenarios (US coverage)

### US-1 Field walk capture (happy path)
- [ ] iOS app starts a capture → walks → finishes → uploads
- [ ] Capture reaches `ready` within 30 seconds (stubbed pipeline)
- [ ] Capture appears in project timeline within 1 second of `ready`
- [ ] Clicking the capture opens the 360° viewer (Phase 1.b integration)

### US-2 Offline capture with reconnect
- [ ] Capture starts offline → queued in local SQLite
- [ ] Connectivity returns → chunks upload in background
- [ ] No data loss across simulated app kill
- [ ] All chunks accounted for after resume (no duplicates)

### US-3 Failed pipeline retry
- [ ] Spatial AI pipeline fails at `sfm` stage
- [ ] Retries 3 times with exponential backoff
- [ ] After 3 failures, `pipeline_runs` row is `status: 'failed'`
- [ ] Capture `status: 'failed'` with user-visible error message
- [ ] DLQ alert routes to on-call

---

## Success Criteria (SC coverage)

- [ ] **SC-1:** 50 MB capture round-trips end-to-end in < 30s (stubbed pipeline)
- [ ] **SC-2:** Offline capture uploads in full on reconnect (zero data loss)
- [ ] **SC-3:** 100 simultaneous concurrent uploads, no cross-tenant leakage
- [ ] **SC-4:** `pipeline_runs` table alone reconstructs any capture's full history
- [ ] **SC-5:** `capture_metrics` per-tenant cost accurate to ±5%

---

## Constitution compliance

### Principle I — Test-First
- [ ] Every task in `tasks.md` starts with RED
- [ ] Coverage ≥ 80% on changed lines
- [ ] No production code without a failing test (CI gate)

### Principle II — Multi-Tenant by Design
- [ ] Every row carries `region`
- [ ] Cross-tenant probe tests fail (no leak) at API, DB, cache, storage, search
- [ ] `tierFor` and S3 prefixes enforce tenant boundary

### Principle III — Strict TypeScript
- [ ] No `any` types in production code
- [ ] `tsc --noEmit` passes with strict flags

### Principle IV — REST + RFC 7807 + Idempotency-Key
- [ ] All errors are `application/problem+json`
- [ ] All mutating endpoints honor `Idempotency-Key`
- [ ] Error responses include `trace_id`

### Principle V — Repository Pattern
- [ ] Both `InMemoryCaptureRepository` and `PostgresCaptureRepository` exist
- [ ] Parameterized SQL only (no string concat)
- [ ] Migrations are idempotent

### Principle VI — Observability by Default
- [ ] Every log line has `request_id`, `service`, `ts`, `level`, `msg`, `fields`
- [ ] SLO dashboards exist
- [ ] SLO burn alerts route to on-call

### Principle VII — No Architectural Re-Decision
- [ ] No task re-decides a pinned decision
- [ ] Any deviations are documented in the PR

---

## Cross-Cutting — Security & Compliance
- [ ] TLS 1.3 only
- [ ] AES-256-GCM at rest (per-tenant CMK)
- [ ] Append-only audit log with hash chain
- [ ] Object Lock Compliance for audit exports (7-year retention)
- [ ] No standing access for admins (SSO + SSM Session Manager)
- [ ] Vulnerability SLA tracking: Critical 24h, High 7d, Medium 30d

---

## Cross-Cutting — Quality Gates
- [ ] Lint passes (ESLint + Prettier)
- [ ] Typecheck passes (strict TS)
- [ ] All unit tests pass (≥ 80% coverage)
- [ ] Integration tests pass with real Postgres
- [ ] E2E synthetic capture test passes
- [ ] Tenant-isolation probe tests fail correctly
- [ ] No `console.log` in production code (audit)
- [ ] No new Sev1/Sev2 lint violations

---

## Sign-off

| Role | Name | Date | Comment |
|---|---|---|---|
| Tech Lead | | | |
| Backend engineer (implementer) | | | |
| Security Lead | | | (required for sensitive-path PRs) |
| CEO | | | (required for FedRAMP-boundary features) |

---

**This checklist is binding. A feature does not ship to production
with any unchecked item.**
