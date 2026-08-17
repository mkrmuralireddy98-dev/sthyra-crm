# Implementation Plan — Track

**Feature ID:** 008-track
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Architecture Decision — NEW SERVICE

`track-service` is a new microservice on port 9095.

## File paths

```
services/track-service/
├── package.json                              ← @sthyra-crm/track-service
├── tsconfig.json
├── Dockerfile
├── migrations/
│ └── 001-init.sql                            ← milestones + progress tables
└── src/
 ├── types.ts                                  ← Milestone, ProgressEntry, ProjectStatus
 ├── types.test.ts                             ← 6+ tests
 ├── repository.ts                              ← TrackRepository contract
 ├── repo-memory.ts                              ← InMemoryTrackRepository
 ├── repo-memory.test.ts                         ← 4+ tests
 ├── status.ts                                  ← pure: computeProjectStatus(milestones, progress, now)
 ├── status.test.ts                              ← 10+ tests
 ├── variance.ts                                ← pure: computeVariance(milestones, now)
 ├── variance.test.ts                            ← 6+ tests
 ├── graph.ts                                   ← pure: topologicalSort + cycle detection
 ├── graph.test.ts                              ← 8+ tests
 ├── service.ts                                 ← TrackService.createMilestone + logProgress + updateStatus
 ├── service.test.ts                             ← 12+ tests
 ├── http.ts                                     ← 8 routes
 ├── http.test.ts                                ← 30+ tests
 ├── cli.ts                                      ← startInMemoryServer
 ├── cli-e2e.test.ts                              ← 4 tests
 ├── realtime/
 │ ├── index.ts                                  ← InMemoryEventBus
 │ └── sse.ts                                    ← project-scoped SSE
 └── migrations/
 └── 001-init.sql
```

## Architecture decisions

### A1 — Milestone state machine

```
pending --start--> in_progress
in_progress --complete--> completed
in_progress --skip--> skipped
pending --skip--> skipped (allowed; e.g. milestone no longer relevant)
completed: terminal
skipped: terminal
```

### A2 — Project status derivation

```typescript
export type ProjectStatus = 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';

export function computeProjectStatus(
 milestones: readonly Milestone[],
 progress: readonly ProgressEntry[],
 now: Date,
): ProjectStatus {
 const active = milestones.filter(m => m.status === 'in_progress');
 const completed = milestones.filter(m => m.status === 'completed' || m.status === 'skipped');
 const overdue = milestones.filter(m => m.plannedDate.getTime() < now.getTime() && m.status !== 'completed' && m.status !== 'skipped');

 if (milestones.length === 0) return 'planning';
 if (completed.length === milestones.length) return 'completed';
 if (overdue.length > 0 && progressPct(progress) < 50) return 'delayed';

 const totalProgress = progressPct(progress);
 const timeElapsed = timeElapsedPct(milestones, now);
 if (totalProgress < timeElapsed * 0.95) return 'at_risk';

 if (active.length > 0) return 'active';
 return 'planning';
}
```

### A3 — Variance formula

```typescript
export interface VarianceReport {
 readonly plannedEndDate: Date | null;
 readonly currentEndDate: Date | null;
 readonly varianceDays: number;
 readonly atRiskCount: number;
 readonly delayedCount: number;
 readonly overdueMilestones: readonly Milestone[];
}

export function computeVariance(
 milestones: readonly Milestone[],
 progress: readonly ProgressEntry[],
 now: Date,
): VarianceReport { ... }
```

### A4 — Cycle detection

```typescript
export function detectCycle(milestones: readonly Milestone[], candidate: Milestone): boolean {
 // DFS from candidate.dependsOn[*], check if any reachable node has an edge back to candidate or its ancestors.
}
```

### A5 — Source validation

```typescript
const ALLOWED_SOURCES = ['manual'] as const;
type ProgressSource = (typeof ALLOWED_SOURCES)[number];

export function validateProgressSource(source: string, isSystemCaller: boolean): void {
 if (!ALLOWED_SOURCES.includes(source as ProgressSource) && !isSystemCaller) {
 throw new Error('invalid source: ' + source);
 }
}
```

### A6 — Routes

```
POST   /v1/projects/:projectId/milestones           (FR-1)
PATCH  /v1/projects/:projectId/milestones/:id      (FR-2)
POST   /v1/projects/:projectId/progress             (FR-3)
GET    /v1/projects/:projectId/status               (FR-4)
GET    /v1/projects/:projectId/variance             (FR-5)
GET    /v1/projects/:projectId/milestones/graph     (FR-6)
GET    /v1/projects/:projectId/milestones           (FR-7)
GET    /v1/projects/:projectId/events               (FR-8, SSE)
+ GET  /v1/health
```

