# Tasks — QA / Punch List

**Feature ID:** 007-qa-punch-list
**Date:** 2026-08-17

## Slice 1 — Schema + types (T-001 to T-005)

T-001 Extend types.ts: + IssueKind, + Trade, + PunchData, + IssuePhoto
T-002 Extend Issue interface with kind + punchData
T-003 CloseoutReport type + computeCloseoutReport function
T-004 Extend state-machine.ts: add 'closed' state, valid transitions
T-005 Migration 002-punch-list.sql

## Slice 2 — Service + repository (T-006 to T-010)

T-006 Extend repo-memory.ts with photo storage
T-007 Extend postgres-repo.ts (BYETEA placeholder)
T-008 Extend IssueService: createPunchItem + addPhoto + inspect
T-009 Extend existing list/find to return kind + punchData
T-010 Service tests (10+ tests)

## Slice 3 — HTTP routes (T-011 to T-016)

T-011 POST .../issues/:id/photos (multipart)
T-012 POST .../issues/:id/inspect
T-013 GET .../closeout
T-014 GET .../closeout/events (SSE)
T-115 Cross-tenant probes (8+ tests)
T-116 RFC 7807 errors

## Slice 4 — Closeout + Tests (T-017 to T-020)

T-017 closeout.ts module (computeCloseoutReport)
T-018 closeout.test.ts (8+ tests)
T-019 SSE closeout tests (4+ tests)
T-120 CLI E2E + integration

## Status — pending /speckit.implement

## Status — Phase 7 partial (2026-08-17)

Slices 1 + 2 shipped. Slices 3-4 deferred (HTTP/SSE/CLI E2E).

### Slices

- ✅ Slice 1 Schema + types + state machine (T-001 to T-005)

  + IssueKind, Trade, PunchData, IssuePhoto, CloseoutReport

  + State machine: closed terminal via inspect(pass)

- ✅ Slice 2a Closeout report (T-017 to T-018)

  + computeCloseoutReport: pure aggregation

  + 9 tests covering empty/all-open/half/all-closed/byStatus/byTrade/avgHours

- ⏳ Slice 2b Service layer (punch item creation, addPhoto, inspect) — pending HTTP wiring

- ⏳ Slice 3 HTTP routes (FR-2 photos, FR-4 inspect, FR-5 closeout endpoint, FR-8 SSE) — pending

- ⏳ Slice 4 Closeout SSE + CLI E2E — pending


### Numbers

- field-service: 139 tests (was 130, +9 closeout)

- capture-service: 276 tests
- field-service: 130 tests (pre-Phase 7) + 9 (Phase 7 closeout)
- bim-viewer-service: 83 tests
- ai-copilot-service: 74 tests
- mobile-bff-service: 82 tests
- Whole project: 768 tests
- 72 commits on main, all pushed to https://github.com/mkrmuralireddy98-dev/sthyra-crm

## Status — Phase 7 Slice 3 complete (2026-08-17)

Slices 1 + 2a + 2b + 3 shipped. Slice 4 (closeout SSE) deferred to Phase 7.b.

### Slices

- ✅ Slice 1 Schema + types + state machine (T-001 to T-005)

- ✅ Slice 2a Closeout report (T-017 to T-018)

- ✅ Slice 2b Service layer (addPhoto + inspect)

- ✅ Slice 3 HTTP routes (FR-2 photos + FR-4 inspect + FR-5 closeout)

- ⏳ Slice 4 Closeout SSE + CLI E2E — Phase 7.b


### Numbers

- field-service: 153 tests (was 130 pre-Phase 7, +23 new)
- capture-service: 276 tests
- field-service: 130 tests (pre-Phase 7) + 23 (Phase 7)
- bim-viewer-service: 83 tests
- ai-copilot-service: 74 tests
- mobile-bff-service: 82 tests
- Whole project: 782 tests
- 74 commits on main
