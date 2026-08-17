# Tasks — Workflow Automation

**Feature ID:** 010-workflow-automation
**Date:** 2026-08-17

## Slice 1 — Foundations (T-001 to T-005)

T-001 Package skeleton: services/workflow-service/
T-002 types.ts: Workflow, Trigger, Condition, Action, WorkflowRun, Template
T-003 repository.ts: WorkflowRepository contract
T-004 repo-memory.ts: InMemoryWorkflowRepository
T-005 migrations/001-init.sql

## Slice 2 — Pure core (T-006 to T-009)

T-006 engine.ts: evaluateTrigger, evaluateCondition, applyActions
T-007 templates.ts: 5 hardcoded templates
T-008 Pure core tests (17+)
T-009 EventContext shape

## Slice 3 — Service layer (T-010 to T-013)

T-010 service.ts: WorkflowService CRUD + run + receiveEvent
T-011 Service-to-service auth check (token comparison)
T-012 Audit log + run history with eviction (100 max)
T-013 Service tests (12+)

## Slice 4 — HTTP routes (T-014 to T-018)

T-014 POST/GET /v1/orgs/:id/workflows (FR-1 + FR-2)
T-015 PATCH/DELETE /v1/workflows/:id (FR-3 + FR-4)
T-016 POST /v1/workflows/:id/run + GET /runs (FR-5 + FR-6)
T-017 POST /v1/internal/events (FR-7, x-service-token)
T-018 GET /v1/orgs/:id/workflows/templates (FR-8)

## Slice 5 — CLI + E2E (T-019 to T-022)

T-019 CLI: startInMemoryServer
T-020 Dockerfile
T-021 docker-compose integration (port 9097)
T-022 CLI E2E tests

## Status — pending /speckit.implement
