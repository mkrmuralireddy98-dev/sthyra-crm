# Tasks — Mobile iOS

**Feature ID:** 005-mobile-ios

## Slice 1 — Foundations (T-001 to T-005)
T-001 Package skeleton
T-002 Domain types
T-003 MobileRepository interface + jwt.ts
T-004 InMemoryMobileRepository
T-005 PostgresMobileRepository skeleton

## Slice 2 — Service layer (T-006 to T-009)
T-006 MobileSessionService.startSession
T-007 MobileSessionService.uploadChunk (idempotent + size validation)
T-008 MobileSessionService.finalizeSession (verify all chunks present)
T-009 MobileSessionService issues + copilot proxy

## Slice 3 — HTTP API (T-010 to T-017)
T-010 POST /v1/mobile/sessions (FR-1)
T-011 POST .../chunks/:n (FR-2 multipart)
T-012 POST .../finalize (FR-3)
T-013 GET /v1/mobile/captures/:id (FR-4)
T-014 POST /v1/mobile/issues (FR-5)
T-015 POST /v1/mobile/copilot (FR-6)
T-016 POST /v1/mobile/devices + DELETE (FR-8)
T-017 RFC 7807 errors + cross-tenant probes + JWT enforcement

## Slice 4 — Realtime + observability (T-018 to T-019)
T-018 InMemoryEventBus + SSE for capture.ready push (Phase 5.b)
T-019 /v1/metrics endpoint

## Slice 5 — E2E + Dockerfile + integration (T-020 to T-022)
T-020 CLI smoke test
T-021 Dockerfile + docker-compose integration
T-022 CI validation job

## Status — pending /speckit.implement
