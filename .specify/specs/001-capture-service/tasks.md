# Tasks — Capture Service

**Feature ID:** 001-capture-service
**Date:** 2026-08-14
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source spec:** `spec.md` + `plan.md`

## Conventions

- Each task = one TDD cycle: RED → GREEN → REFACTOR.
- Commit format: `feat(capture-service): <imperative summary>` (per
  Constitution §Development Workflow).
- Each task lists:
  - **Files:** exact paths to create or modify
  - **Test:** what failing test to write FIRST
  - **Implementation:** brief (test-driven)
  - **DoD:** acceptance criteria
- Tasks run in **dependency order**. Parallel `[P-N]` markers show
  which tasks can be done concurrently.
- Mark completed with `[x]` as work progresses.

## Slice 1 — Foundations (T-001 to T-005)

### T-001 — Package skeleton

- **Files (NEW):**
  - `services/capture-service/package.json` — name `@sthyra-crm/capture-service`
  - `services/capture-service/tsconfig.json` — extends `tsconfig.base.json`
- **Test:** `pnpm --filter=@sthyra-crm/capture-service build` succeeds.
- **Implementation:** minimal `package.json` with Fastify 5, pino,
  tsx (dev), `@sthyra-crm/observability`, `@sthyra-crm/auth`,
  `@sthyra-crm/tokens` as workspace deps.
- **DoD:** `pnpm install` succeeds; `pnpm --filter=@sthyra-crm/capture-service test` runs.

### T-002 — Domain types

- **Files (NEW):**
  - `services/capture-service/src/types.ts`
- **Test:** `types.test.ts` covers `CaptureKind`, `CaptureStatus`,
  `UploadSessionStatus`, `PipelineStage`, `PipelineRunStatus` unions.
- **Implementation:** discriminated unions for status; readonly
  interfaces matching the SQL schema.
- **DoD:** TypeScript compiles; `node:test` passes 5+ tests.

### T-003 — `CaptureRepository` interface

- **Files (NEW):**
  - `services/capture-service/src/repository.ts`
- **Test:** `repository.test.ts` — interface compiles; mock implementations
  satisfy the shape.
- **Implementation:** interface with `insert`, `findById`, `findByProjectAndClientId`,
  `listByProject`, `update`, `archive` methods.
- **DoD:** All implementations conform (compile-time).

### T-004 — `InMemoryCaptureRepository`

- **Files (NEW):**
  - `services/capture-service/src/in-memory-repo.ts`
  - `services/capture-service/src/in-memory-repo.test.ts`
- **Test:** RED: `findByProjectAndClientId` returns the right row;
  `insert` throws on duplicate `(projectId, clientCaptureId)`.
- **Implementation:** Map-based store; same pattern as
  `services/org-service/src/index.ts:InMemoryOrgRepository`.
- **DoD:** 8+ tests passing; tenant boundaries enforced.

### T-005 — `PostgresCaptureRepository`

- **Files (NEW):**
  - `services/capture-service/src/postgres-repo.ts`
  - `services/capture-service/src/postgres-repo.test.ts`
  - `services/capture-service/src/migrations/001-init.sql`
- **Test:** RED: `FakePgClient` (same pattern as
  `services/org-service/src/postgres-repo.test.ts`) — create, findById,
  findByProjectAndClientId, list, archive, parameterized SQL only.
- **Implementation:** parameterized queries only; idempotent migration
  runner.
- **DoD:** 8+ tests passing; migration is idempotent.

## Slice 2 — HTTP API (T-006 to T-010)

### T-006 — `POST /v1/projects/:id/captures` with idempotency

- **Files:**
  - `services/capture-service/src/http.ts` (NEW)
  - `services/capture-service/src/http.test.ts` (NEW)
  - `services/capture-service/src/cli.ts` (NEW)
- **Test:** RED:
  - 201 on first POST with `Idempotency-Key`
  - 200 on retry with same key (returns same upload session)
  - 409 on duplicate `(projectId, clientCaptureId)` without `Idempotency-Key`
  - 401 on missing bearer
  - 403 on tenant_id mismatch
- **Implementation:** Fastify route; Idempotency-Key check against
  an in-memory map (Redis-backed in prod).
- **DoD:** 5+ HTTP tests passing; curl smoke test works.

### T-007 — `GET /v1/upload-sessions/:id`

- **Files:** `services/capture-service/src/http.ts` (modify)
- **Test:** RED: returns full upload session state with `receivedChunks[]`
  accurate to current storage state.
- **Implementation:** Fastify route; reads from repository.
- **DoD:** 3+ tests passing.

### T-008 — `POST /v1/upload-sessions/:id/complete`

- **Files:** `services/capture-service/src/http.ts` (modify)
- **Test:** RED:
  - 200 with sha256 match → transitions capture to `processing`
  - 400 with sha256 mismatch
  - 409 if not all chunks received
- **Implementation:** ListObjects + verify hash; transition status;
  emit `capture.uploaded` event.
- **DoD:** 4+ tests passing; integration test with `LocalFsStorage`.

### T-009 — `POST /v1/captures/:id/archive`

- **Files:** `services/capture-service/src/http.ts` (modify)
- **Test:** RED: archive sets `status: 'archived'`; archived captures
  remain queryable.
- **Implementation:** soft transition.
- **DoD:** 2+ tests passing.

### T-010 — `GET /v1/captures/:id` and list endpoint

- **Files:** `services/capture-service/src/http.ts` (modify)
- **Test:** RED:
  - GET /v1/captures/:id returns full capture with `pipelineRuns[]`
  - GET /v1/projects/:id/captures supports `?status=` filter and pagination
  - 404 on cross-tenant ID (probe test per Constitution §II)
  - 403 on cross-org access attempt (probe test per Constitution §II)
- **Implementation:** Fastify routes; repository calls; explicit
  tenant check on every read.
- **DoD:** 7+ tests passing; cross-tenant probe tests **must fail**
  when probing (no leak).

## Slice 3 — Storage (T-011 to T-014)

### T-011 — `BlobStorage` interface

- **Files (NEW):**
  - `services/capture-service/src/storage/index.ts`
- **Test:** `storage.test.ts` — interface compiles; mock satisfies.
- **Implementation:** `put`, `get`, `head`, `signedUrl`, `concatenate`
  methods.
- **DoD:** Compiles.

### T-012 — `LocalFsStorage` (dev)

- **Files (NEW):**
  - `services/capture-service/src/storage/local-fs.ts`
  - `services/capture-service/src/storage/local-fs.test.ts`
- **Test:** RED: chunk PUT/GET round-trip on tmpfs; sha256 verifies.
- **Implementation:** write to `.dev-storage/<region>/org/<orgId>/project/<projectId>/capture/<captureId>/raw/chunk-N.bin`.
- **DoD:** 5+ tests passing; tenant prefix enforced.

### T-013 — `S3Storage` (prod)

- **Files (NEW):**
  - `services/capture-service/src/storage/s3.ts`
  - `services/capture-service/src/storage/s3.test.ts`
- **Test:** RED: pre-signed URL generation works; region-scoped;
  15-minute expiry default.
- **Implementation:** AWS SDK v3; `PutObjectCommand` for chunks;
  `CreateMultipartUpload` for the final concatenation.
- **DoD:** 4+ tests passing (with mocked AWS client).

### T-014 — Storage tiering helper

- **Files (NEW):**
  - `services/capture-service/src/storage/tiering.ts`
- **Test:** RED: `tierFor(capture)` returns correct storage class per
  age threshold.
- **Implementation:** pure function; no side effects.
- **DoD:** 5+ tests covering age boundaries (0d, 30d, 90d, 365d).

## Slice 4 — Pipeline Orchestrator (T-015 to T-022)

### T-015 — Pipeline state machine (in-process)

- **Files (NEW):**
  - `services/pipeline-orchestrator/src/state-machine.ts`
  - `services/pipeline-orchestrator/src/state-machine.test.ts`
- **Test:** RED: `transition(capture, 'processing')` returns the next
  valid state; invalid transitions throw.
- **Implementation:** discriminated union + transition function.
- **DoD:** 8+ tests passing; invalid transitions are impossible.

### T-016 — Step Functions state definition

- **Files (NEW):**
  - `services/pipeline-orchestrator/src/step-functions.asl.json`
- **Test:** static analysis — JSON validates against ASL schema;
  states named correctly; transitions match the state machine.
- **Implementation:** JSON ASL definition; 5 states (decode → sfm →
  mesh → segment → align) with retry policies.
- **DoD:** JSON validates; `cat | jq` shows expected structure.

### T-017 — Stage stub: `decode`

- **Files (NEW):**
  - `services/pipeline-orchestrator/src/stages/decode.ts`
  - `services/pipeline-orchestrator/src/stages/decode.test.ts`
- **Test:** RED: returns empty artifact set in 100ms ± 50ms.
- **Implementation:** stub; logs `[stub] decode complete`.
- **DoD:** 2+ tests passing.

### T-018 — Stage stubs: `sfm`, `mesh`, `segment`, `align`

- **Files:** `services/pipeline-orchestrator/src/stages/{sfm,mesh,segment,align}.ts`
  (NEW)
- **Test:** each returns empty artifacts; emits `pipeline_run` row.
- **Implementation:** identical shape to `decode.ts`.
- **DoD:** 8+ tests passing across all four stages.

### T-019 — Retry policy + exponential backoff

- **Files (NEW):**
  - `services/pipeline-orchestrator/src/retry.ts`
  - `services/pipeline-orchestrator/src/retry.test.ts`
- **Test:** RED: retry counts `attempt` field; backoff is 2^n seconds;
  max 3 attempts; throws after.
- **Implementation:** pure function + clock injection.
- **DoD:** 6+ tests; deterministic timing.

### T-020 — DLQ + on-call alert

- **Files (NEW):**
  - `services/pipeline-orchestrator/src/dlq.ts`
  - `services/pipeline-orchestrator/src/dlq.test.ts`
- **Test:** RED: failed-after-retries capture routes to DLQ;
  alert payload includes capture_id + stage + error.
- **Implementation:** writes to `pipeline_runs` with `status: 'failed'`;
  emits `capture.failed` event; logs at `error` level (triggers CloudWatch alarm).
- **DoD:** 4+ tests passing.

### T-021 — `pipeline_runs` table tracking

- **Files:** `services/pipeline-orchestrator/src/observability.ts`
- **Test:** every stage transition writes a `pipeline_run` row.
- **Implementation:** writes happen in stage handlers, not the
  orchestrator (single responsibility).
- **DoD:** integration test confirms row count per capture.

### T-022 — Pipeline orchestrator wire-up

- **Files (NEW):**
  - `services/pipeline-orchestrator/src/cli.ts`
  - `services/pipeline-orchestrator/src/http.ts` (NEW — start/stop hook)
- **Test:** RED: orchestrator starts; consumes `capture.uploaded`
  events; emits `capture.ready` on completion.
- **Implementation:** wires up state machine + stages + DLQ + Redis
  pub/sub; HTTP server for health check.
- **DoD:** boot smoke test passes.

## Slice 5 — Realtime push (T-023 to T-025)

### T-023 — Redis pub/sub integration

- **Files:**
  - `services/capture-service/src/events.ts` (NEW)
  - `services/capture-service/src/events.test.ts` (NEW)
- **Test:** RED: `publish('capture.ready', payload)` reaches a Redis
  subscriber within 50ms; payload JSON round-trips.
- **Implementation:** ioredis client; `publish` method; subscriber
  helper for tests.
- **DoD:** 4+ tests passing.

### T-024 — Domain event emission

- **Files:** `services/capture-service/src/index.ts` (modify)
- **Test:** every status transition emits the right event:
  - `create` → `capture.initiated`
  - `complete` → `capture.uploaded`
  - pipeline start → `capture.processing`
  - pipeline success → `capture.ready`
  - pipeline fail → `capture.failed`
- **Implementation:** events module integrated with `CaptureService`.
- **DoD:** 5+ tests passing.

### T-025 — WebSocket push trigger

- **Files:** `services/realtime-gateway/src/capture-events.ts` (NEW)
- **Test:** RED: when `capture.ready` event is published, the
  WebSocket gateway pushes to all clients subscribed to the project.
- **Implementation:** existing `realtime-gateway` (Phoenix Channels)
  subscribes to Redis events; broadcasts to project channel.
- **DoD:** integration test confirms push within 5s.

## Slice 6 — Observability (T-026 to T-028)

### T-026 — Structured logging integration

- **Files:** all service files (modify)
- **Test:** every log line is structured JSON with `request_id`.
- **Implementation:** install `@plumb/observability` request-id plugin
  at boot; use `emit()` not `console.log`.
- **DoD:** log audit confirms no `console.log` in capture-service.

### T-027 — Per-capture cost metrics

- **Files:**
  - `services/capture-service/src/metrics.ts` (NEW)
  - `services/capture-service/src/metrics.test.ts` (NEW)
- **Test:** RED: after a capture completes, `capture_metrics` has
  rows for every stage with cost_usd > 0.
- **Implementation:** stage handlers emit metrics; rolled up to
  `captures.aggregate_cost_usd` on `ready`/`failed`.
- **DoD:** 5+ tests; cost within $0.10 of stub computation.

### T-028 — SLO burn alerts

- **Files:**
  - `services/capture-service/src/slo.ts` (NEW)
  - `services/capture-service/src/slo.test.ts` (NEW)
- **Test:** RED: when ingestion success rate < 99.5% for 5 minutes,
  SLO breach logged at `error` level.
- **Implementation:** sliding-window counter; threshold check.
- **DoD:** 4+ tests passing.

## Slice 7 — End-to-end (T-029 to T-030)

### T-029 — Synthetic capture round-trip

- **Files:** `services/capture-service/src/e2e/synthetic-capture.test.ts` (NEW)
- **Test:** RED: 50 MB synthetic capture round-trips end-to-end (POST →
  chunks → complete → ready) in < 30s.
- **Implementation:** integration test using `LocalFsStorage` +
  stubbed pipeline; asserts every transition.
- **DoD:** test passes locally + in CI.

### T-030 — Offline-mode E2E

- **Files:** `apps/mobile-kmm/src/commonTest/kotlin/com/plumb/sync/CaptureOfflineTest.kt`
  (NEW) — placeholder if mobile shell exists yet
- **Test:** chunks uploaded after simulated network outage arrive
  intact; zero data loss across simulated app kill + airplane mode.
- **Implementation:** test harness simulates network failure; asserts
  retry + resume logic.
- **DoD:** test passes; **deferred to Phase 2** when mobile-kmm
  exists. For MVP, this is a stub.

## Dependency Graph

```
T-001 → T-002 → T-003 → T-004 → T-006 → T-007 → T-008 → T-009 → T-010
              ↘ T-005 ↗         ↘ T-011 → T-012 ↗
                              ↘ T-013 ↗
                                          ↓
                              T-014 → T-015 → T-016 → T-017 → T-018 → T-019 → T-020 → T-021 → T-022
                                          ↘ T-023 → T-024 → T-025
                                                                              ↓
                                                                  T-026 → T-027 → T-028
                                                                                          ↓
                                                                                  T-029 → T-030
```

## Parallel work waves

- **[P-1]** T-005 (Postgres repo) + T-011 (BlobStorage interface) — independent
- **[P-2]** T-012 (LocalFs) + T-013 (S3) — independent implementations
- **[P-3]** T-017, T-018, T-019, T-020, T-023 — independent stage implementations
- **[P-4]** T-026, T-027, T-028 — observability concerns, independent

## Definition of Done (for the feature)

- [ ] All 30 tasks `[x]`
- [ ] 114+ tests passing (was the baseline; + new capture-service tests)
- [ ] All SLOs green for 24 hours in CI
- [ ] E2E synthetic capture test passes in CI
- [ ] Tenant-isolation probe test fails (correctly) when probing
      cross-tenant
- [ ] No `console.log` in production code
- [ ] No `any` types in production code
- [ ] Postgres migrations are idempotent
- [ ] All HTTP errors are `application/problem+json`
- [ ] All file paths in plan.md exist (no speculation)
- [ ] PR signed off by Security Lead (per Constitution §Compliance)
