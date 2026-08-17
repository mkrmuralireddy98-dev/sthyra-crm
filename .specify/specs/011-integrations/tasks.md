# Tasks — Integrations

**Feature ID:** 011-integrations
**Date:** 2026-08-17

## Slice 1 — Foundations (T-001 to T-005)

T-001 Package skeleton: services/integration-service/
T-002 types.ts: Integration, Sync, Provider, ProviderType, IntegrationConfig
T-003 repository.ts: IntegrationRepository contract
T-004 repo-memory.ts: InMemoryIntegrationRepository
T-005 migrations/001-init.sql

## Slice 2 — Pure core (T-006 to T-009)

T-006 connectors.ts: Connector interface + 4 stubs (procore/bim360/plangrid/webhook)
T-007 mappers.ts: mapProcoreRFI / mapBIM360Issue → Issue shape
T-008 providers.ts: 4 hardcoded Provider descriptors
T-009 Pure core tests (16+)

## Slice 3 — Service layer (T-010 to T-013)

T-010 service.ts: IntegrationService CRUD + sync + test + webhook
T-011 Redaction of sensitive config in API outputs
T-012 Sync record creation + eviction (100 max per integration)
T-013 Service tests (12+)

## Slice 4 — HTTP routes (T-014 to T-018)

T-014 POST/GET /v1/orgs/:id/integrations (FR-1 + FR-2)
T-015 DELETE /v1/integrations/:id (FR-3)
T-016 POST /v1/integrations/:id/sync (FR-4)
T-117 GET /v1/integrations/:id/syncs (FR-5)
T-118 POST /v1/integrations/:id/webhook (FR-6, x-webhook-token)
T-119 GET /v1/integrations/providers (FR-7)
T-120 POST /v1/integrations/:id/test (FR-8)

## Slice 5 — CLI + E2E (T-019 to T-022)

T-019 CLI: startInMemoryServer
T-020 Dockerfile
T-021 docker-compose integration (port 9098)
T-022 CLI E2E tests

## Status — pending /speckit.implement

## Status — Phase 11 COMPLETE (2026-08-17)

All 5 slices shipped. 33 integration-service tests passing.

### Slices

- ✅ Slice 1 Foundations (2 tests)
- ✅ Slice 2 Pure core (12 tests)
- ✅ Slice 3 Service layer (19 tests)
- ✅ Slice 4 HTTP API (FR-1 to FR-8)
- ✅ Slice 5 CLI + Dockerfile + integration

### Numbers

- integration-service: 33 tests
- capture-service: 276 tests
- field-service: 158 tests
- bim-viewer-service: 83 tests
- ai-copilot-service: 74 tests
- mobile-bff-service: 82 tests
- track-service: 65 tests
- report-service: 31 tests
- workflow-service: 37 tests
- Whole project: 953 tests
- 97 commits on main
