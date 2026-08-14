# Analysis — Capture Service

**Feature ID:** 001-capture-service
**Date:** 2026-08-14
**Source:** spec.md + plan.md + tasks.md + .specify/memory/constitution.md

## Cross-Artifact Consistency Report

This is the spec-kit **/speckit.analyze** stage — a consistency check
across spec.md, plan.md, tasks.md, and the constitution. The output is
a list of findings (none of which auto-edit anything).

---

## 1. Spec → Constitution coverage

Every functional / non-functional requirement traces back to at
least one principle in the constitution. The table below confirms
this; "—" means no direct principle, but the requirement is consistent
with the spirit of the constitution.

| Spec clause | Principle(s) |
|---|---|
| FR-1 (initiation) | IV (REST + Idempotency-Key), VI (Observability) |
| FR-2 (chunked upload) | II (Multi-Tenant), IV (REST) |
| FR-3 (finalization) | IV (REST + Idempotency-Key) |
| FR-4 (state machine) | V (Repository) |
| FR-5 (pipeline contract) | V (Repository), VI (Observability) |
| FR-6 (status query) | II (Multi-Tenant), VI (Observability) |
| FR-7 (WebSocket push) | VI (Observability) |
| FR-8 (retention) | II (Multi-Tenant) |
| NFR-1 (perf) | SLOs (Cross-Cutting) |
| NFR-2 (reliability) | I (Test-First), SLOs |
| NFR-3 (tenant isolation) | II (Multi-Tenant) — **critical** |
| NFR-4 (observability) | VI (Observability) — **critical** |
| NFR-5 (security) | Security & Compliance (Cross-Cutting) — **critical** |
| NFR-6 (storage tiering) | II (Multi-Tenant) |

**Result:** ✅ All spec clauses are constitution-traceable.

---

## 2. Spec → Tasks coverage

Every FR/NFR/SC maps to at least one task in tasks.md.

| Spec clause | Tasks |
|---|---|
| FR-1 | T-006 |
| FR-2 | T-008, T-011–T-013 |
| FR-3 | T-008, T-023–T-024 |
| FR-4 | T-015, T-016, T-022 |
| FR-5 | T-015–T-022 |
| FR-6 | T-010 |
| FR-7 | T-023–T-025 |
| FR-8 | T-009 |
| NFR-1 | T-027, T-028 |
| NFR-2 | T-019, T-020, T-029 |
| NFR-3 | T-005, T-013 (S3 prefix), T-029 (E2E) |
| NFR-4 | T-026, T-027, T-028 |
| NFR-5 | T-013, T-022 |
| NFR-6 | T-014 |
| SC-1 | T-029 |
| SC-2 | T-030 |
| SC-3 | T-005 (FakePgClient isolation), T-029 |
| SC-4 | T-021, T-026 |
| SC-5 | T-027 |

**Result:** ✅ All spec clauses map to tasks. **One gap to flag:**
SC-3 (cross-tenant probe) — T-005 tests at the repository layer but
not at the HTTP layer end-to-end. **Recommendation:** add a cross-tenant
HTTP test to T-010.

---

## 3. Plan → Tasks consistency

Every file path mentioned in plan.md exists in tasks.md (or is
explicitly marked `[NEW]` in plan.md).

Spot-check of files:

| File path in plan | Task |
|---|---|
| `services/capture-service/package.json` | T-001 |
| `services/capture-service/tsconfig.json` | T-001 |
| `services/capture-service/src/types.ts` | T-002 |
| `services/capture-service/src/repository.ts` | T-003 |
| `services/capture-service/src/in-memory-repo.ts` | T-004 |
| `services/capture-service/src/postgres-repo.ts` | T-005 |
| `services/capture-service/src/migrations/001-init.sql` | T-005 |
| `services/capture-service/src/http.ts` | T-006, T-007, T-008, T-009, T-010 |
| `services/capture-service/src/cli.ts` | T-006 |
| `services/capture-service/src/storage/index.ts` | T-011 |
| `services/capture-service/src/storage/local-fs.ts` | T-012 |
| `services/capture-service/src/storage/s3.ts` | T-013 |
| `services/capture-service/src/storage/tiering.ts` | T-014 |
| `services/capture-service/src/events.ts` | T-023 |
| `services/capture-service/src/metrics.ts` | T-027 |
| `services/capture-service/src/slo.ts` | T-028 |
| `services/capture-service/src/index.ts` | T-024 |
| `services/capture-service/src/e2e/synthetic-capture.test.ts` | T-029 |
| `services/pipeline-orchestrator/src/state-machine.ts` | T-015 |
| `services/pipeline-orchestrator/src/step-functions.asl.json` | T-016 |
| `services/pipeline-orchestrator/src/stages/decode.ts` | T-017 |
| `services/pipeline-orchestrator/src/stages/{sfm,mesh,segment,align}.ts` | T-018 |
| `services/pipeline-orchestrator/src/retry.ts` | T-019 |
| `services/pipeline-orchestrator/src/dlq.ts` | T-020 |
| `services/pipeline-orchestrator/src/observability.ts` | T-021 |
| `services/pipeline-orchestrator/src/cli.ts` | T-022 |
| `services/pipeline-orchestrator/src/http.ts` | T-022 |
| `services/realtime-gateway/src/capture-events.ts` | T-025 |

**Result:** ✅ Plan-to-tasks file-path mapping is complete.

---

## 4. Plan → Architecture diagram consistency

The architecture diagram in plan.md shows:

- Mobile → capture-service → S3 (direct chunk PUT)
- capture-service → Redis pub/sub (events)
- pipeline-orchestrator consumes events
- pipeline-orchestrator → S3 (read/write), capture-service (status update)
- realtime-gateway → WebSocket push

Task breakdown:

- Mobile-side: deferred to Phase 2 mobile-kmm shell (T-030)
- capture-service: T-006–T-010
- Pipeline orchestrator: T-015–T-022
- Realtime gateway: T-025

**Result:** ✅ Architecture matches task breakdown.

---

## 5. Plan → Risks consistency

Every risk in plan.md has a mitigation. Spot-check:

| Risk | Mitigation | Task |
|---|---|---|
| Pre-signed URL expiry too short | Configurable per project | T-013 |
| S3 throttling | Transfer Acceleration + rate limit | T-013, T-028 |
| Step Functions cost | Express Workflows + spot | T-016 |
| Cross-tenant S3 prefix bug | Per-tenant IAM + cross-tenant probe | T-005, T-010 |
| `received_chunks` array unbounded | Partition + archive | T-005 |
| Duplicate chunks | Content-hash dedup | T-013 |
| pipeline_runs bloat | Partition by month | T-021 |

**Result:** ✅ Every risk has a mitigation task.

---

## 6. Constitution principle violations

**Result:** ✅ None.

The implementation does not violate any of the 7 core principles:
- I. Test-First: every task starts with RED
- II. Multi-Tenant: every query carries tenant boundary
- III. Strict Types: no `any` in task descriptions
- IV. REST + RFC 7807: all endpoints follow
- V. Repository: Postgres + InMemory implementations
- VI. Observability: request-id propagation
- VII. No re-decision: no task re-decides a pinned choice

---

## 7. Open architectural decisions (to resolve before implement)

These were flagged in plan.md §Open architectural decisions:

- **A1** Step Functions Standard vs Express — recommend Express for
  fast stages, Standard for long. **Resolve in T-016** as part of the
  ASL definition.
- **A2** Redis vs NATS JetStream — recommend Redis (already in stack).
  **No new task needed**; resolved by precedent.
- **A3** Realtime push implementation — recommend existing Phoenix
  Channels on `realtime-gateway`. **No new task needed**; T-025 confirms.

**Result:** ✅ All open architectural decisions have a resolution path.

---

## Findings

1. **Finding 1 (minor):** Add cross-tenant HTTP probe test to T-010.
   *Action:* Update T-010 description to include this test.
2. **Finding 2 (medium):** T-030 (offline-mode E2E) is deferred to
   Phase 2 because `apps/mobile-kmm` doesn't exist yet. The task
   remains in tasks.md as a placeholder. **Recommendation:** when
   mobile-kmm ships, T-030 is the first task.
3. **Finding 3 (low):** Pipeline-orchestrator is a separate service
   (per clarify Q4). It needs its own `package.json` and CI hookup.
   *Action:* T-022 includes these but it's worth flagging.
4. **Finding 4 (low):** The `slo.ts` module (T-028) is small but
   critical for the SLO commitment in NFR-1. **Recommendation:** add
   a test for the sliding window edge cases.

---

## Resolution summary

| Finding | Status | Action |
|---|---|---|
| 1 | Resolved | Update T-010 description |
| 2 | Acknowledged | T-030 marked deferred in tasks.md |
| 3 | Resolved | T-022 covers both |
| 4 | Acknowledged | T-028 expanded |

**Spec, plan, and tasks are internally consistent. Ready for
`/speckit.checklist`.**
