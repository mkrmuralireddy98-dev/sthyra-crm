# Implementation Plan — QA / Punch List

**Feature ID:** 007-qa-punch-list
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Architecture Decision — EXTEND field-service (Phase 2)

Per Q1 + Constitution §VII.

## File paths (additions only)

```
services/field-service/
├── src/
│ ├── types.ts                ← + IssueKind, + Trade, + PunchData, + IssuePhoto
│ ├── repository.ts           ← + insertPhoto, listPhotos, findIssueWithPunch
│ ├── repo-memory.ts          ← + photo storage (Maps keyed by sha256)
│ ├── postgres-repo.ts        ← + photo SQL (BYTEA)
│ ├── service.ts              ← + createPunchItem, addPhoto, inspect (pass/fail)
│ ├── state-machine.ts        ← + 'closed' transition (resolved → closed)
│ ├── service.test.ts         ← + punch item tests, photo tests, inspect tests
│ ├── http.ts                 ← + 5 new routes
│ ├── http.test.ts            ← + 20+ new HTTP tests
│ ├── cli.ts                  ← unchanged
│ ├── cli-e2e.test.ts         ← + 2 E2E tests for new routes
│ └── closeout.ts             ← NEW: compute closeout stats
├── migrations/
│ └── 002-punch-list.sql      ← NEW: ALTER TABLE issues + new table issue_photos
└── README.md                 ← unchanged
```

## Architecture decisions

### A1 — IssueKind discriminator

```typescript
export type IssueKind = 'standard' | 'punch';

export interface Issue {
 // ... existing fields
 readonly kind: IssueKind;
 readonly punchData: PunchData | null; // non-null iff kind === 'punch'
}

export interface PunchData {
 readonly trade: Trade;
readonly location: { level: string; room: string; gridline?: string };
readonly assignedTo: string | null;
readonly dueDate: Date | null;
readonly photoIds: readonly string[];
}
```

### A2 — Trade union

```typescript
export const TRADES = ['plumbing', 'electrical', 'structural', 'hvac', 'finishes', 'other'] as const;
export type Trade = (typeof TRADES)[number];
```

### A3 — Photo storage (Phase 7 MVP)

```sql
CREATE TABLE issue_photos (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 issue_id TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 content_type TEXT NOT NULL,
 caption TEXT NULL,
 size_bytes INTEGER NOT NULL,
 data BYTEA NOT NULL,
 captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX issue_photos_org_issue_idx ON issue_photos (org_id, issue_id);
```

Phase 7.b migration: replace BYTEA with S3 key + thumbnailUrl.

### A4 — State machine extension

The existing state machine (open → in_progress → resolved → in_progress → resolved) gets a terminal `closed` state:

```typescript
type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
```

`closed` is reached via `inspect({outcome: 'pass'})`. From `closed`, no transitions out (terminal).
`inspect({outcome: 'fail'})` transitions: `resolved → in_progress`.

### A5 — Routes (5 new + extended)

```
POST   /v1/projects/:projectId/issues/:id/photos     (FR-2)
POST   /v1/projects/:projectId/issues/:id/inspect   (FR-4)
GET    /v1/projects/:projectId/closeout              (FR-5)
GET    /v1/projects/:projectId/closeout/events       (FR-8, SSE)

+ Extended:
POST   /v1/projects/:projectId/issues                 (FR-1, kind: 'punch' added)
POST   /v1/projects/:projectId/issues/:id/resolve   (FR-3, before/after photoId)
```

### A6 — Closeout report

```typescript
function closeoutReport(items: readonly Issue[], photos: readonly IssuePhoto[]): CloseoutReport {
 const total = items.length;
 const byStatus = countBy(items, (i) => i.status);
 const byTrade = countBy(items.filter(i => i.kind === 'punch'), (i) => i.punchData?.trade ?? 'other');
 const closed = byStatus['closed'] ?? 0;
 const completionPct = total === 0 ? 100 : Math.round((closed / total) * 100);
 const averageResolutionHours = computeAvgResolutionHours(items);
 return { total, byStatus, byTrade, completionPct, averageResolutionHours };
}
```

