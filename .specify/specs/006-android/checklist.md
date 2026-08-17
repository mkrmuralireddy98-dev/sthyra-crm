# Quality Checklist — Android

**Feature ID:** 006-android
**Date:** 2026-08-17

## Pre-implementation checklist
- [x] FR-1 to FR-8 defined (8 functional requirements)
- [x] NFR-1 to NFR-6 defined
- [x] 4 user scenarios written
- [x] Out-of-scope explicit (native UI, FCM sending, SSO, WorkManager)
- [x] 7 open questions resolved

## Constitution compliance
- [x] §I Test-First
- [x] §II Multi-Tenant (orgId from JWT)
- [x] §III Strict TypeScript
- [x] §IV REST + RFC 7807
- [x] §V Repository Pattern
- [x] §VI Observability
- [x] §VII No Re-Decision (extends Phase 5, not new service)

## Test coverage targets
- [ ] 6+ i18n tests
- [ ] 4+ android-compat tests
- [ ] 4+ pushChannel tests
- [ ] 8+ existing Phase 5 tests still pass (regression)

## Post-implementation
- [ ] ~10-15 new tests; Phase 5 tests still pass
- [ ] Total ~755 tests
- [ ] No regressions in 5 prior services
