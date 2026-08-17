# Implementation Plan — Reports

**Feature ID:** 009-reports
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Architecture Decision — NEW SERVICE

`report-service` is a new microservice on port 9096.

## File paths

```
services/report-service/
├── package.json
├── tsconfig.json
├── Dockerfile
├── migrations/
│ └── 001-init.sql                            ← schedules table
└── src/
 ├── types.ts                                  ← DailyReport, WeeklyReport, ProjectDeepDive, PortfolioReport, Schedule
 ├── types.test.ts                             ← 6 tests
 ├── repository.ts                              ← ReportRepository contract
 ├── repo-memory.ts                              ← InMemoryReportRepository
 ├── repo-memory.test.ts                         ← 4 tests
 ├── aggregators.ts                              ← PURE: aggregateCaptures/Issues/Progress (testable without HTTP)
 ├── aggregators.test.ts                         ← 12 tests
 ├── cache.ts                                    ← SimpleTTL cache
 ├── cache.test.ts                               ← 4 tests
 ├── service.ts                                  ← ReportService: getDaily/getWeekly/getDeepDive/getPortfolio/runCustom + schedule
 ├── service.test.ts                              ← 12 tests
 ├── http.ts                                      ← 8 routes
 ├── http.test.ts                                 ← 25 tests
 ├── cli.ts                                       ← startInMemoryServer
 ├── cli-e2e.test.ts                               ← 4 tests
 ├── docker-compose.test.ts                        ← structural
 └── migrations/001-init.sql
```

## Architecture decisions

### A1 — Aggregators (pure core)

```typescript
// Aggregators are pure: take pre-fetched data, return report shape.
// Cross-service fetching is in HTTP layer (which has the auth).

export function aggregateDailyReport(
 captures: readonly CaptureSummary[],
 issues: readonly IssueSummary[],
 progress: readonly ProgressSummary[],
 milestones: readonly MilestoneSummary[],
 date: Date,
): DailyReport;
```

### A2 — Cache

```typescript
class SimpleTTLCache<K, V> {
 private entries = new Map<K, { value: V; expiresAt: number }>();
  getOrCompute<K, V>(key: K, ttlSeconds: number, compute: () => V): V { ... }
}
```

### A3 — Service layer

```typescript
class ReportService {
 getDaily(orgId, projectId, date): Promise<DailyReport>;
 getWeekly(orgId, weekStart): Promise<WeeklyReport>;
 getDeepDive(orgId, projectId): Promise<ProjectDeepDive>;
 getPortfolio(orgId): Promise<PortfolioReport>;
 runCustom(orgId, request): Promise<CustomReportResult>;
 scheduleReport(orgId, projectId, input, idempotencyKey): Promise<Schedule>;
 listSchedules(orgId, projectId): Promise<Schedule[]>;
 cancelSchedule(orgId, projectId, id): Promise<void>;
}
```

### A4 — Routes (8)

```
GET    /v1/projects/:projectId/reports/daily?date=YYYY-MM-DD       (FR-1)
GET    /v1/orgs/:orgId/reports/weekly?week=YYYY-Www                 (FR-2)
GET    /v1/projects/:projectId/reports/deep-dive                    (FR-3)
GET    /v1/orgs/:orgId/reports/portfolio                            (FR-4)
POST   /v1/orgs/:orgId/reports/custom                               (FR-5)
POST   /v1/projects/:projectId/reports/schedule                    (FR-6)
GET    /v1/projects/:projectId/reports/schedule                    (FR-7)
DELETE /v1/projects/:projectId/reports/schedule/:id                (FR-8)
+ GET  /v1/health
```

### A5 — Cross-service fetcher (Phase 9 MVP: stubbed)

```typescript
// ReportFetcher interface — tests use a fake; prod wires HTTP clients.
export interface ReportFetcher {
 fetchCaptures(orgId, projectId, from, to): Promise<readonly CaptureSummary[]>;
 fetchIssues(orgId, projectId, from, to): Promise<readonly IssueSummary[]>;
 fetchMilestones(orgId, projectId): Promise<readonly MilestoneSummary[]>;
 fetchProgress(orgId, projectId): Promise<readonly ProgressSummary[]>;
}

// StubReportFetcher returns deterministic data for testing.
class StubReportFetcher implements ReportFetcher { ... }
```

