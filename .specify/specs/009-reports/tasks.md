# Tasks — Reports

**Feature ID:** 009-reports
**Date:** 2026-08-17

## Slice 1 — Foundations (T-001 to T-005)

T-001 Package skeleton: services/report-service/
T-002 types.ts: DailyReport, WeeklyReport, ProjectDeepDive, PortfolioReport, Schedule, CustomReportRequest
T-003 repository.ts: ReportRepository contract
T-004 repo-memory.ts: InMemoryReportRepository
T-005 migrations/001-init.sql

## Slice 2 — Pure core (T-006 to T-009)

T-006 aggregators.ts: aggregateDaily, aggregateWeekly, aggregateDeepDive, aggregatePortfolio, runCustom
T-007 cache.ts: SimpleTTLCache
T-008 Pure core tests (16+)
T-009 StubReportFetcher

## Slice 3 — Service layer (T-010 to T-013)

T-010 service.ts: ReportService.getDaily/getWeekly/getDeepDive/getPortfolio/runCustom
T-011 Schedule CRUD (create/list/cancel)
T-012 Cache integration (5-min TTL on daily/weekly)
T-013 Service tests (12+)

## Slice 4 — HTTP routes (T-014 to T-017)

T-014 GET /v1/projects/:id/reports/daily (FR-1)
T-015 GET /v1/orgs/:id/reports/weekly (FR-2)
T-016 GET /v1/projects/:id/reports/deep-dive (FR-3)
T-017 GET /v1/orgs/:id/reports/portfolio (FR-4)
T-118 POST /v1/orgs/:id/reports/custom (FR-5)

## Slice 5 — Schedule + E2E (T-019 to T-022)

T-119 POST/GET/DELETE /v1/projects/:id/reports/schedule (FR-6 + FR-7 + FR-8)
T-120 CLI: startInMemoryServer
T-121 Dockerfile
T-122 docker-compose integration (port 9096)

## Status — pending /speckit.implement

## Status — Phase 9 COMPLETE (2026-08-17)

All 5 slices shipped. 31 report-service tests passing.

### Slices

- ✅ Slice 1 Foundations (T-001 to T-005, 2 tests)
- ✅ Slice 2 Pure core (T-006 to T-009, 15 tests)
- ✅ Slice 3 Service layer (T-010 to T-013, 14 tests)
- ✅ Slice 4 HTTP API (T-014 to T-018)
- ✅ Slice 5 CLI + Dockerfile + integration (T-019 to T-022)

### Numbers

- report-service: 31 tests
- capture-service: 276 tests
- field-service: 158 tests
- bim-viewer-service: 83 tests
- ai-copilot-service: 74 tests
- mobile-bff-service: 82 tests
- track-service: 65 tests
- Whole project: 883 tests
- 87 commits on main
