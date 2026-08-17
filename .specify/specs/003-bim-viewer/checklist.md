# Quality Checklist — BIM Viewer

**Feature ID:** 003-bim-viewer
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0

## Pre-implementation checklist

### Spec quality
- [x] FR-1 through FR-8 defined with concrete acceptance criteria
- [x] NFR-1 through NFR-9 defined (security, performance, observability)
- [x] 3 user scenarios written
- [x] Out-of-scope explicit
- [x] 7 open questions resolved in clarifications.md

### Constitution compliance
- [x] §I Test-First — every FR has a failing test first
- [x] §II Multi-Tenant — org_id in every table, every query, every storage key
- [x] §III Strict TypeScript — tsc --noEmit clean
- [x] §IV REST + RFC 7807 + Idempotency-Key — same conventions
- [x] §V Repository Pattern — BimRepository is the contract
- [x] §VI Observability — request-id, structured logs, /v1/metrics
- [x] §VII No Re-Decision — reuses IcpAlignStage, BlobStorage, state-machine pattern

### Architecture quality
- [x] Pure status state machine
- [x] BboxTree is a clean interface (testable with fake)
- [x] Cross-tenant probes return 404
- [x] SSE reuses Phase 1 pattern
- [x] HMAC-signed pagination
- [x] Soft-delete via isCurrent=false + deleted_at

### Test coverage targets
- [ ] 8+ state-machine tests
- [ ] 6+ postgres-repo tests
- [ ] 8+ bbox-tree tests
- [ ] 6+ ifc-parser tests
- [ ] 8+ diff tests
- [ ] 12+ service tests
- [ ] 30+ http tests
- [ ] 8+ realtime tests
- [ ] 4+ CLI E2E tests
- [ ] 5+ structural tests

### Migration safety
- [ ] Schema uses idempotent CREATE TABLE IF NOT EXISTS
- [ ] Indexes use CREATE INDEX IF NOT EXISTS
- [ ] CHECK constraints on every enum column
- [ ] Migrations committed to version control

### Documentation
- [x] spec.md (8 FRs + 9 NFRs + 3 scenarios + out-of-scope)
- [x] clarifications.md (7 Qs resolved)
- [x] plan.md (architecture, file paths, schema)
- [x] analysis.md (cross-artifact consistency, 5 findings)
- [x] tasks.md (this checklist + per-slice task list)

## Post-implementation checklist

- [ ] All tests green (target ~120 new tests, total ~640)
- [ ] Typecheck clean
- [ ] Build clean
- [ ] CLI boots, /v1/health 200
- [ ] docker-compose field-service + bim-viewer-service up
- [ ] CI bim-viewer-service validation job
- [ ] No regressions in capture-service or field-service

