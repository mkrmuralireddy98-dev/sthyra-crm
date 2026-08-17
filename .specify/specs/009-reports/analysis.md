# Analysis — Reports

**Feature ID:** 009-reports
**Date:** 2026-08-17

## Cross-artifact consistency check

| Check | Status |
|---|---|
| Q1 → new report-service | ✅ |
| Q2 → on-demand + 5-min cache | ✅ plan §A2 |
| Q3 → stub token | ✅ plan §A5 |
| Q4 → 3 entities (issues/captures/milestones) | ✅ plan §A3 |
| Q5 → TTL only | ✅ |
| Q6 → schedule stored, not executed | ✅ plan §A3 |
| Q7 → email recipients | ✅ plan §A3 |
| FR-1 daily | ✅ |
| FR-2 weekly | ✅ |
| FR-3 deep-dive | ✅ |
| FR-4 portfolio | ✅ |
| FR-5 custom | ✅ |
| FR-6 schedule | ✅ |
| FR-7 list schedules | ✅ |
| FR-8 cancel | ✅ |
| NFR-1 tenant isolation | ✅ |
| NFR-2 RFC 7807 | ✅ |
| NFR-3 cacheable | ✅ plan §A2 |
| NFR-4 observability | ✅ |
| NFR-5 idempotency | ✅ |
| NFR-6 cross-service auth stub | ✅ plan §A5 |
| NFR-7 pagination | ✅ (HMAC cursor) |
| Constitution §VII | ✅ new service justified |

## Findings

### F1 — Read-only aggregator

Report-service never writes to other services. All calls are GET. The stub fetcher makes this trivially testable.

### F2 — Cache hit/miss is observable

5-minute TTL means a daily report generated twice within 5 minutes hits the cache. Useful for testing.

### F3 — Schedule execution is Phase 9.b

Schedules are stored but not fired. Cron worker is a separate concern (out of MVP scope).

