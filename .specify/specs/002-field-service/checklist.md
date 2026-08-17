# Quality Checklist — Field Service

**Feature ID:** 002-field-service
**Date:** 2026-08-17

## Pre-implementation checklist

### Spec quality
- [x] FR-1 through FR-10 defined
- [x] NFR-1 through NFR-9 defined
- [x] 3 user scenarios written
- [x] Out-of-scope explicit
- [x] Open questions resolved

### Constitution compliance
- [x] §I Test-First
- [x] §II Multi-Tenant
- [x] §III Strict TypeScript
- [x] §IV REST + RFC 7807 + Idempotency-Key
- [x] §V Repository Pattern
- [x] §VI Observability
- [x] §VII No Re-Decision

### Architecture quality
- [x] Pure status state machine
- [x] HMAC-signed pagination
- [x] Soft-delete (deleted_at)
- [x] Cross-tenant 404
- [x] SSE reuses Phase 1 pattern

### Test coverage targets
- [ ] 10+ state-machine tests
- [ ] 6+ postgres-repo tests
- [ ] 8+ service tests
- [ ] 20+ http tests
- [ ] 5+ pagination tests
- [ ] 5+ realtime tests
- [ ] 4+ CLI E2E tests
- [ ] 5+ observability tests

## Post-implementation checklist

- [ ] All tests green (~100 new, total ~480)
- [ ] Typecheck clean
- [ ] Build clean
- [ ] CLI boots, /v1/health 200
- [ ] No regressions in capture-service
