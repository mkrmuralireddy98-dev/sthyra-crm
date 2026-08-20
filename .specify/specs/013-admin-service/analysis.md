# Phase 13 — Analysis

**Date:** 2026-08-20

---

## Constitution Conformance

| Principle | Conformance |
|---|---|
| I. Test-First | All slices RED→GREEN→REFACTOR with tests first |
| II. Multi-Tenant | **Explicitly bypassed for admin operations** (single exception) — audited |
| III. Strict Types | All types in `types.ts`; no `any` outside test files |
| IV. REST + RFC 7807 + Idempotency | All POSTs require Idempotency-Key; errors follow RFC 7807 |
| V. Repository Pattern | AdminRepository interface; InMemoryAdminRepository for MVP |
| VI. Observability | Request-id plugin, structured logs, audit-first pattern |
| VII. No Architectural Re-Decision | NEW service for cross-tenant domain (matches §VII intent) |

## Risk Analysis

### R1: Admin operations bypass tenant isolation (HIGH)
**Mitigation:** Audit-first pattern — every mutation writes audit entry
before responding. Audit log is append-only. Future phase can add
alerting on suspicious admin actions (e.g., bulk suspend).

### R2: Rate limiting adds complexity (MEDIUM)
**Mitigation:** Token bucket in-memory (60 req/min, 10 mut/min).
Phase 13.b can move to Redis-backed.

### R3: JWT validation could let tenant users access admin endpoints (HIGH)
**Mitigation:** Strict check: `claims.admin_role === 'super' ||
'support'`. Tenant JWTs without this claim → 403. Tested explicitly.

### R4: Service-to-service calls during health checks might cascade failures (LOW)
**Mitigation:** Health check uses 5s timeout per service. If a service
is down, it's marked 'unhealthy' but admin-service itself returns 200
with degraded status.

### R5: In-memory audit log lost on restart (MEDIUM)
**Mitigation:** Acceptable for MVP. Phase 13.b ships Postgres audit table
with WAL-based replication for durability.

## Cross-Service Dependencies

```
admin-service depends on:
  org-service       — tenant CRUD
  user-service      — user CRUD + force logout
  membership-service — user→tenant mapping
  field-service     — issue counts (stats)
  capture-service   — capture counts (stats)
  All 10 other services — health checks
```

All downstream services must accept admin-role calls (with `x-admin-bypass`
header). This requires touching ~10 services. Phase 13.b.

For MVP, admin-service is read-only against other services (health +
stats only). Mutations happen only via user-service + org-service
directly, which admin-service proxies.

## MVP vs Full

**MVP (Phase 13):** All 10 FRs in spec. ~58 tests.
**Phase 13.b:** Billing, email notifications, bulk ops, Postgres audit,
internal mTLS.

## Performance

- 60 req/min rate limit per admin = 1 req/sec sustained
- Health check fan-out: ~50ms total (parallel + 5s timeout each)
- Audit write: ~1ms (in-memory Map.set)
- Total p99 target: < 200ms for read endpoints, < 500ms for mutations
