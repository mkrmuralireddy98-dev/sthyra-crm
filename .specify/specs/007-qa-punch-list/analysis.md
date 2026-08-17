# Analysis — QA / Punch List

**Feature ID:** 007-qa-punch-list
**Date:** 2026-08-17

## Cross-artifact consistency check

| Check | Status |
|---|---|
| Q1 → extend field-service | ✅ plan §A1 |
| Q2 → BYTEA Phase 7, S3 Phase 7.b | ✅ plan §A3 |
| Q3 → 6 trades | ✅ plan §A2 |
| Q4 → simple % formula | ✅ plan §A6 |
| Q5 → no auto-archive | ✅ |
| Q6 → list returns all | ✅ |
| Q7 → en-US captions only | ✅ |
| FR-1 createPunchItem | ✅ plan §A1 |
| FR-2 multipart photo upload | ✅ plan §A3 |
| FR-3 resolve (existing route, extended) | ✅ |
| FR-4 inspect (pass/fail) | ✅ new route |
| FR-5 closeout report | ✅ plan §A6 |
| FR-6 trade union | ✅ |
| FR-7 location binding | ✅ |
| FR-8 SSE | ✅ |
| NFR-1 tenant isolation | ✅ unchanged |
| NFR-3 photo limits | ✅ enforced in upload |
| NFR-5 metrics | ✅ counter exposed |
| NFR-6 authorization | ✅ role check per route |
| Constitution §VII no re-decision | ✅ extends Phase 2 |

## Findings

### F1 — Photo storage scale

BYTEA for MVP. Phase 7.b migrates to S3 to handle TB-scale photo archives.

### F2 — State machine: new 'closed' terminal

The existing state machine in field-service/src/state-machine.ts only has open/in_progress/resolved/wont_fix. Phase 7 adds 'closed' as a terminal state reachable from 'resolved'.

### F3 — IssueKind backfill

Phase 7 migration (`migrations/002-punch-list.sql`) sets `kind = 'standard'` for all existing rows.

