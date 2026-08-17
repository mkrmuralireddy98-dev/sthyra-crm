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
