# Phase 13 — Tasks

**Service:** admin-service
**Slice Plan:** 5 slices, 16 tasks, ~58 tests

---

## Slice 1 — Foundations (RED→GREEN)

- [x] **T-001:** Create `services/admin-service/{package.json, tsconfig.json}`
- [x] **T-002:** Create `src/types.ts` + `types.test.ts` (5 tests)
- [x] **T-003:** Create `src/repository.ts` + `src/repo-memory.ts` + 5 tests
- [x] **T-004:** Create `src/audit.ts` + 3 tests

## Slice 2 — Core Logic

- [x] **T-005:** Create `src/tenants.ts` + 6 tests
- [x] **T-006:** Create `src/users.ts` + 6 tests
- [x] **T-007:** Create `src/feature-flags.ts` + 4 tests
- [x] **T-008:** Create `src/health.ts` + 3 tests

## Slice 3 — Service + Auth + Rate Limit

- [x] **T-009:** Create `src/service.ts` (AdminService) + 8 tests
- [x] **T-010:** Create `src/jwt-admin.ts` (admin-role JWT validator) + 4 tests
- [x] **T-011:** Create `src/rate-limit.ts` (token bucket) + 3 tests

## Slice 4 — HTTP + CLI

- [x] **T-012:** Create `src/http.ts` (10 routes) + 18 tests
- [x] **T-013:** Create `src/cli.ts` (startInMemoryServer)
- [x] **T-014:** Create `src/cli-e2e.test.ts`

## Slice 5 — Deployment

- [x] **T-015:** Create `Dockerfile`
- [x] **T-016:** Add to `docker-compose.integration.yml` on port 9100

---

**Status:** Phase 13 — COMPLETE (2026-08-20)
**All 13 features shipped. ~1,000+ tests passing across the platform.**
