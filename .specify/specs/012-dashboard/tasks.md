# Tasks — Dashboard

**Feature ID:** 012-dashboard
**Date:** 2026-08-17

## Slice 1 — Foundations (T-001 to T-005)

T-001 Package skeleton: services/dashboard-service/
T-002 types.ts: PageData, ProjectSummary, IssueSummary, all summary types
T-003 css.ts: inlined CSS as string constants (teal + amber)
T-004 layout.ts: renderLayout + renderError + render404
T-005 Pure rendering tests (10+)

## Slice 2 — Aggregator (T-006 to T-009)

T-006 aggregator.ts: aggregateHomePage, aggregateProjectPage, aggregateIssuesPage
T-007 StubDashboardFetcher interface
T-008 Aggregator tests (8+)
T-009 DashboardService orchestration (8+ tests)

## Slice 3 — HTTP routes (T-010 to T-013)

T-010 GET / (FR-1: home page)
T-011 GET /projects/:id (FR-2: project detail)
T-012 GET /projects/:id/issues + /:id/issues/:issId (FR-3 + FR-4)
T-113 GET/POST /projects/:id/copilot (FR-5)

## Slice 4 — More routes (T-014 to T-017)

T-114 GET /projects/:id/reports/daily (FR-6 daily)
T-115 GET /orgs/:id/reports/weekly (FR-6 weekly)
T-116 GET /projects/:id/milestones (FR-7)
T-117 GET /orgs/:id/workflows + /integrations (FR-8)
T-118 HTTP tests for all routes (20+)

## Slice 5 — CLI + E2E (T-019 to T-022)

T-019 CLI: startInMemoryServer
T-020 Dockerfile
T-021 docker-compose integration (port 9099)
T-022 CLI E2E tests

## Status — pending /speckit.implement
