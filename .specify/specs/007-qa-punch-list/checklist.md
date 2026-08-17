# Quality Checklist — QA / Punch List

**Feature ID:** 007-qa-punch-list
**Date:** 2026-08-17

## Pre-implementation checklist
- [x] FR-1 to FR-8 defined (8 functional requirements)
- [x] NFR-1 to NFR-7 defined (tenant, RFC 7807, photo limits, soft delete, observability, auth, backward compat)
- [x] 4 user scenarios written
- [x] Out-of-scope explicit (S3 migration, geo-fencing, templates, QR, scheduling)
- [x] 7 open questions resolved

## Constitution compliance
- [x] §I Test-First
- [x] §II Multi-Tenant
- [x] §III Strict TypeScript
- [x] §IV REST + RFC 7807
- [x] §V Repository Pattern
- [x] §VI Observability
- [x] §VII No Re-Decision (extends Phase 2)

## Test coverage targets
- [ ] 6+ trade union tests
- [ ] 6+ punch state machine tests
- [ ] 10+ createPunchItem tests
- [ ] 8+ photo upload tests (with size validation)
- [ ] 8+ inspect (pass/fail) tests
- [ ] 8+ closeout report tests
- [ ] 4+ SSE closeout tests
- [ ] 4+ CLI E2E tests

## Post-implementation
- [ ] ~50-60 new tests
- [ ] Total ~810 tests
- [ ] No regressions in Phase 2 (still 130 tests)
