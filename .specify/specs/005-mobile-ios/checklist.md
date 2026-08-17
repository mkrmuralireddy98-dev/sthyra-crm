# Quality Checklist — Mobile iOS

**Feature ID:** 005-mobile-ios
**Date:** 2026-08-17

## Pre-implementation checklist
- [x] FR-1 to FR-8 defined (8 functional requirements)
- [x] NFR-1 to NFR-8 defined (tenant, JWT, offline, RFC 7807, observability, push, idempotency, size limits)
- [x] 4 user scenarios written
- [x] Out-of-scope explicit (native app, APNs sending, real LiDAR)
- [x] 7 open questions resolved

## Constitution compliance
- [x] §I Test-First
- [x] §II Multi-Tenant (orgId in every query)
- [x] §III Strict TypeScript
- [x] §IV REST + RFC 7807 + Idempotency-Key
- [x] §V Repository Pattern
- [x] §VI Observability
- [x] §VII No Re-Decision (reuses patterns from phases 1-4)

## Test coverage targets
- [ ] 8+ jwt tests
- [ ] 8+ service tests
- [ ] 6+ postgres-repo tests
- [ ] 8+ repo-memory tests
- [ ] 30+ http tests (per route, JWT, cross-tenant, idempotency, chunk ordering)
- [ ] 4+ CLI E2E tests
- [ ] 5+ structural tests

## Post-implementation
- [ ] ~100 new tests, ~770 total
- [ ] Typecheck clean
- [ ] Build clean
- [ ] CLI boots, /v1/health 200
- [ ] docker-compose integration
- [ ] No regressions in 4 prior services
