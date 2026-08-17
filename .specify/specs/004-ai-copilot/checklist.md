# Quality Checklist — AI Copilot

**Feature ID:** 004-ai-copilot
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0

## Pre-implementation checklist
- [x] FR-1 to FR-8 defined (8 functional requirements)
- [x] NFR-1 to NFR-8 defined (tenant, determinism, idempotency, RFC 7807, observability, pagination, auth, privacy)
- [x] 3 user scenarios written
- [x] Out-of-scope explicit (no external LLM in Phase 4)
- [x] 7 open questions resolved in clarifications.md

## Constitution compliance
- [x] §I Test-First — every FR will have a failing test first
- [x] §II Multi-Tenant — every method takes orgId
- [x] §III Strict TypeScript
- [x] §IV REST + RFC 7807 + Idempotency-Key
- [x] §V Repository Pattern — CopilotRepository contract
- [x] §VI Observability — request-id, structured logs, /v1/metrics
- [x] §VII No Re-Decision — SSE pattern, HMAC pagination, repository pattern reused

## Architecture quality
- [x] Pure intent classifier (deterministic)
- [x] Pure slot extractor (deterministic)
- [x] Pure reply composer (no LLM)
- [x] Cross-tenant probes return 404
- [x] Tool router with explicit failure handling

## Test coverage targets
- [ ] 8+ intent tests
- [ ] 8+ slot-extractor tests
- [ ] 8+ reply-composer tests
- [ ] 6+ tool-router tests
- [ ] 8+ state-machine tests
- [ ] 6+ postgres-repo tests
- [ ] 8+ service tests
- [ ] 30+ http tests
- [ ] 5+ SSE tests
- [ ] 4+ CLI E2E tests
- [ ] 5+ structural tests

## Post-implementation checklist
- [ ] All tests green (target ~120 new tests, total ~720)
- [ ] Typecheck clean
- [ ] Build clean
- [ ] CLI boots, /v1/health 200
- [ ] docker-compose integration
- [ ] CI ai-copilot-service validation job
- [ ] No regressions in 3 prior services
