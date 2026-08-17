# Analysis — BIM Viewer

**Feature ID:** 003-bim-viewer
**Date:** 2026-08-17
**Source:** spec.md + clarifications.md + plan.md + checklist.md + constitution.md v1.0.0

## Cross-artifact consistency check

| Check | Status | Notes |
|---|---|---|
| Spec FR-1 through FR-8 map to plan routes | ✅ | 8 FRs → 8 routes in plan §A7 |
| Clarifications Q1-Q7 all reflected in plan | ✅ | Q1→IFC parser scope; Q2→BlobStorage reuse; Q3→IcpAlignStage reuse; Q4→in-memory bbox tree; Q5→thresholdMeters query param; Q6→RBAC pattern; Q7→isCurrent schema field |
| NFRs all addressable by plan architecture | ✅ | NFR-1 tenant isolation in repo (org_id first); NFR-3 storage key prefix; NFR-7 observability; NFR-8 HMAC pagination |
| State machine is a pure function | ✅ | Same pattern as field-service state-machine.ts |
| Tenant boundary in every SQL | ✅ | CHECK constraint + indexes all start with org_id |
| Idempotency-Key on POST | ✅ | FR-1 |
| RFC 7807 for all errors | ✅ | NFR-5 |
| Request-id propagation | ✅ | NFR-7 |
| No re-decision of Phase 1 / 2 patterns | ✅ | IcpAlignStage reuse (Q3), BlobStorage reuse (Q2), state-machine.ts pattern reused, repo pattern reused |
| Constitution §V interface-stable | ✅ | BimRepository is the contract |
| Soft-delete (Constitution §V) | ✅ | isCurrent=false + deleted_at pattern, not hard delete |

## Findings

### F1 — Cross-service alignment trigger (clarification Q3 follow-up)

The alignment is triggered by calling IcpAlignStage from capture-service. This requires bim-viewer-service to import from capture-service (or call it over HTTP). 

**Decision:** bim-viewer-service imports IcpAlignStage directly (Phase 1.4 already has it as a library). No HTTP hop.

**Risk:** Importing across packages is a code-coupling issue.

**Mitigation:** IcpAlignStage is already a clean interface (FfmpegRunner-style DI). We just compose it.

### F2 — BboxTree persistence (Phase 3.b)

Plan §A1 has `saveBboxTree` and `loadBboxTree` on the repository. Phase 3 MVP in-memory. Phase 3.b migrates to Postgres BYTEA column (binary blob) for the tree.

**Action:** In Phase 3 MVP, saveBboxTree/loadBboxTree are no-ops in the InMemoryBimRepository. The PostgresBimRepository (Phase 3.b) will store the binary tree.

### F3 — IFC parser scope (clarification Q1)

Phase 3 ships a stub. Real IFC parsing (Web-IFC, thatch-services, etc.) is Phase 4.

**Action:** Phase 3 stub handles a small fixture file (~10 elements) for testing. Document the limitation.

### F4 — Diff scope (clarification Q4 follow-up)

Phase 3 diff samples 1k points, not all. Full scan is Phase 3.b.

**Action:** Document the sampling strategy. Tests verify behavior with a small fixture.

### F5 — Authorization (clarification Q6)

Phase 3 MVP uses an in-memory `MembershipChecker` fake. Phase 3.b wires real membership-service.

**Action:** Define MembershipChecker interface in plan §A7. Phase 3 ships the fake; Phase 3.b replaces with real call.

## Status

All findings resolved or documented. Ready for /speckit.tasks.

