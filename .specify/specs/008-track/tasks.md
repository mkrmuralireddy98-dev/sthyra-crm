# Tasks — Track

**Feature ID:** 008-track
**Date:** 2026-08-17

## Slice 1 — Foundations (T-001 to T-005)

T-001 Package skeleton: services/track-service/
T-002 types.ts: Milestone, ProgressEntry, ProjectStatus, VarianceReport
T-003 repository.ts: TrackRepository contract
T-004 repo-memory.ts: InMemoryTrackRepository
T-005 migrations/001-init.sql

## Slice 2 — Pure core (T-006 to T-009)

T-006 status.ts: computeProjectStatus
T-007 variance.ts: computeVariance
T-008 graph.ts: topologicalSort + detectCycle
T-009 Pure core tests (24+)

## Slice 3 — Service layer (T-010 to T-013)

T-010 service.ts: createMilestone + logProgress + updateStatus
T-011 Source validation (manual only MVP)
T-012 Cycle rejection on createMilestone
T-013 Service tests (12+)

## Slice 4 — HTTP routes (T-014 to T-018)

T-014 POST /v1/projects/:id/milestones (FR-1)
T-015 PATCH /v1/projects/:id/milestones/:id (FR-2)
T-016 POST /v1/projects/:id/progress (FR-3)
T-017 GET /v1/projects/:id/status + /variance + /milestones/graph (FR-4 + FR-5 + FR-6)
T-018 GET /v1/projects/:id/milestones (FR-7)

## Slice 5 — SSE + E2E (T-019 to T-022)

T-019 SSE: GET /v1/projects/:id/events (FR-8)
T-020 CLI: startInMemoryServer
T-021 Dockerfile
T-022 docker-compose integration (port 9095)

## Status — pending /speckit.implement

## Status — Phase 8 COMPLETE (2026-08-17)

All 5 slices shipped. 65 track-service tests passing.

### Slices

- ✅ Slice 1 Foundations (T-001 to T-005, 3 tests)
- ✅ Slice 2 Pure core (T-006 to T-009, 25 tests)
- ✅ Slice 3 Service layer (T-010 to T-013, 16 tests)
- ✅ Slice 4 HTTP API (T-014 to T-018, 18 tests)
- ✅ Slice 5 CLI + E2E + Dockerfile (T-019 to T-022, 3 tests)

### Numbers

- track-service: 65 tests
- capture-service: 276 tests
- field-service: 158 tests
- bim-viewer-service: 83 tests
- ai-copilot-service: 74 tests
- mobile-bff-service: 82 tests
- Whole project: 852 tests
- 82 commits on main
