# Analysis — Track

**Feature ID:** 008-track
**Date:** 2026-08-17

## Cross-artifact consistency check

| Check | Status |
|---|---|
| Q1 → new track-service | ✅ plan §A1 |
| Q2 → DFS with memo | ✅ plan §A4 |
| Q3 → 95% threshold | ✅ plan §A2 |
| Q4 → simple actual - planned | ✅ plan §A3 |
| Q5 → server-side trust, manual only MVP | ✅ plan §A5 |
| Q6 → soft-delete | ✅ |
| Q7 → planning default | ✅ plan §A2 |
| FR-1 createMilestone | ✅ |
| FR-2 updateStatus (state machine) | ✅ |
| FR-3 logProgress | ✅ |
| FR-4 projectStatus rollup | ✅ plan §A2 |
| FR-5 variance | ✅ plan §A3 |
| FR-6 dependency graph + cycle | ✅ plan §A4 |
| FR-7 filtering + pagination | ✅ |
| FR-8 SSE | ✅ |
| NFR-1 tenant isolation | ✅ |
| NFR-2 RFC 7807 | ✅ |
| NFR-3 Idempotency | ✅ |
| NFR-4 cycle detection | ✅ plan §A4 |
| NFR-5 metrics | ✅ |
| NFR-6 source validation | ✅ plan §A5 |
| NFR-7 soft delete | ✅ |
| Constitution §VII no re-decision | ✅ new service justified in spec §1 |

## Findings

### F1 — Track is a cross-service aggregator

Track reads closeout completion (Phase 7), capture status (Phase 1), and BIM alignment (Phase 3) to compute project status. In MVP, these come in as ProgressEntry.source = 'auto_*' messages. Phase 8.b: direct cross-service calls.

### F2 — Source validation gates tampering

Phase 8 MVP: only 'manual' is accepted. Phase 8.b: a service-to-service auth token validates 'auto_*' sources.

### F3 — Gantt chart logic is client-side

Track serves the data (milestones with planned/actual dates). The visualization is Phase 12 (Dashboard).

