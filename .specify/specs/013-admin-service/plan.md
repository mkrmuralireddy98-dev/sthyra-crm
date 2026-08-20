# Phase 13 — Implementation Plan

**Service:** `admin-service` (NEW)
**Port:** 9100
**Repo:** `services/admin-service/`

---

## Slice 1 — Foundations (T-001 to T-004)

- **T-001:** Create package.json (`@sthyra-crm/admin-service` v0.1.0),
  tsconfig.json (strict + 4 flags), pnpm install
- **T-002:** Create `types.ts` with AdminRole, TenantSummary, UserSummary,
  AuditEntry, FeatureFlag, SystemHealth types + 5 tests
- **T-003:** Create `repository.ts` (AdminRepository interface) +
  `repo-memory.ts` (InMemoryAdminRepository) + 5 tests
- **T-004:** Create `audit.ts` (write-before-return audit logger) + 3 tests

**Slice commit:** `feat(admin): Slice 1 foundations`

---

## Slice 2 — Core Logic (T-005 to T-008)

- **T-005:** `tenants.ts` — list/create/suspend/resume logic + 6 tests
- **T-006:** `users.ts` — list/force-logout/reset-password logic + 6 tests
- **T-007:** `feature-flags.ts` — get/toggle logic + 4 tests
- **T-008:** `health.ts` — system health aggregator (calls all services
  /v1/health in parallel) + 3 tests

**Slice commit:** `feat(admin): Slice 2 core logic`

---

## Slice 3 — Service Layer (T-009 to T-011)

- **T-009:** `service.ts` — AdminService orchestrator + 8 tests
- **T-010:** `jwt-admin.ts` — admin-role JWT validator + 4 tests
- **T-011:** `rate-limit.ts` — token bucket rate limiter + 3 tests

**Slice commit:** `feat(admin): Slice 3 service + auth + rate limit`

---

## Slice 4 — HTTP + CLI (T-012 to T-014)

- **T-012:** `http.ts` — 10 Fastify routes (FR-1 to FR-10) + 18 tests
- **T-013:** `cli.ts` — startInMemoryServer with admin JWT validation
- **T-014:** `cli-e2e.test.ts` — CLI smoke test

**Slice commit:** `feat(admin): Slices 4+5 HTTP + CLI`

---

## Slice 5 — Deployment (T-015 to T-016)

- **T-015:** Dockerfile (multi-stage node:22-alpine, same pattern as
  other services)
- **T-016:** Wire to docker-compose.integration.yml on port 9100,
  update tasks.md with completion banner

**Slice commit:** `feat(admin): Slice 5 Dockerfile + docker-compose`

---

## Total test target: ~58 admin-service tests
