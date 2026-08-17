# Tasks — BIM Viewer

**Feature ID:** 003-bim-viewer
**Date:** 2026-08-17
**Source:** spec.md + clarifications.md + plan.md + analysis.md

## Conventions

- Every task = one TDD cycle (RED → GREEN → REFACTOR)
- Tasks numbered T-NNN, grouped into 7 slices
- [NEW] files don't exist yet

---

## Slice 1 — Foundations (T-001 to T-005)

### T-001 — Package skeleton
- Files: services/bim-viewer-service/package.json, tsconfig.json
- DoD: package installs, scripts work

### T-002 — Domain types
- Files: src/types.ts + types.test.ts
- 8+ tests covering all enums + invariants

### T-003 — BimRepository interface
- Files: src/repository.ts + repository.test.ts
- 5+ type-level tests

### T-004 — InMemoryBimRepository
- Files: src/repo-memory.ts + repo-memory.test.ts
- 8+ tests

### T-005 — PostgresBimRepository skeleton
- Files: src/postgres-repo.ts + postgres-repo.test.ts
- 6+ tests with FakePgClient

---

## Slice 2 — Spatial index + IFC parsing (T-006 to T-010)

### T-006 — BboxTree pure module
- Files: src/bbox-tree.ts + bbox-tree.test.ts
- 8+ tests covering nearest lookup, edge cases

### T-007 — IFC parser stub
- Files: src/ifc-parser.ts + ifc-parser.test.ts
- 6+ tests covering IFC 4x3 happy path + invalid schema rejection

### T-008 — Status state machine
- Files: src/state-machine.ts + state-machine.test.ts
- 8+ tests

### T-009 — Diff scanner
- Files: src/diff.ts + diff.test.ts
- 8+ tests covering threshold, edge cases

### T-010 — SQL migration
- Files: migrations/001-init.sql
- 3 tables (bim_models, bim_deviations, future), all tenant-scoped

---

## Slice 3 — Service layer (T-011 to T-014)

### T-011 — BimService.upload
- Files: src/service.ts + service.test.ts
- 5+ tests

### T-012 — BimService.lookup + diff
- Files: extend service.ts
- 4+ tests per method

### T-013 — BimService.delete + version-management
- Files: extend service.ts
- 4+ tests

### T-014 — listAlignedCaptures
- Files: extend service.ts
- 4+ tests

---

## Slice 4 — HTTP API (T-015 to T-022)

### T-015 — POST /v1/projects/:projectId/bim-model (FR-1)
- 201/200/409/400/401/403
- DoD: all status codes match spec

### T-016 — GET /v1/projects/:projectId/bim-model (FR-2)
- 200/404
- DoD: returns current model state

### T-017 — POST align (FR-3)
- 202/404
- DoD: triggers IcpAlignStage

### T-018 — POST element-lookup (FR-4)
- 200/400/404
- DoD: nearest element returned with distance

### T-019 — GET aligned-captures (FR-5)
- 200/404 with cursor pagination
- DoD: paginated list

### T-020 — GET diff (FR-6)
- 200/202/404
- DoD: deviations returned

### T-021 — DELETE (FR-8) + cross-tenant probes (FR-1 to FR-8)
- 204/404 + 8+ cross-tenant probes

### T-022 — RFC 7807 errors
- 6+ error scenarios

---

## Slice 5 — Realtime push (T-023 to T-024)

### T-023 — InMemoryEventBus for BIM events
- Files: src/realtime/index.ts
- 5+ tests

### T-024 — SSE endpoint (FR-7)
- Files: src/realtime/sse.ts + sse.test.ts
- 8+ tests with history + live + cross-tenant 404

---

## Slice 6 — Observability + Auth (T-025 to T-027)

### T-025 — observability integration
- Files: extend http.ts
- 5+ tests

### T-026 — MembershipChecker (RBAC)
- Files: src/membership.ts + membership.test.ts
- 4+ tests (in-memory fake + role check)

### T-027 — /v1/metrics endpoint
- Files: src/metrics.ts + metrics.test.ts
- 4+ tests

---

## Slice 7 — E2E (T-028 to T-030)

### T-028 — CLI smoke test
- Files: src/cli-e2e.test.ts
- 4+ tests

### T-029 — Docker compose integration
- Files: Dockerfile + update docker-compose.integration.yml
- 3+ structural tests

### T-030 — CI validation
- Files: update .github/workflows/ci.yml

---

## Status — pending /speckit.implement

Phase 3 status: pending

