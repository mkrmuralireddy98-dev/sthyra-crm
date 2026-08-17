# Implementation Plan — Field Service

**Feature ID:** 002-field-service
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source spec:** `spec.md` + `clarifications.md`

## Tech Stack

Same as Phase 1 — no new dependencies.

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`)
- Node.js 22 + tsx (tests) + esbuild (transforms)
- Fastify 5 (HTTP), @sthyra-crm/observability (request-id + structured logs)
- Postgres 16 (production) / InMemory (tests) via `CaptureRepository` pattern
- pnpm workspaces — new package `services/field-service/`

## Architecture (mirrors capture-service)

```
services/field-service/
├── src/
│   ├── types.ts              — Issue, Comment, Coordinates, enums
│   ├── repository.ts         — IssueRepository interface
│   ├── repo-memory.ts        — InMemoryIssueRepository (Phase 2 MVP)
│   ├── postgres-repo.ts      — PostgresIssueRepository (Phase 2.b)
│   ├── service.ts            — IssueService domain layer
│   ├── http.ts               — Fastify HTTP layer (8 routes)
│   ├── state-machine.ts      — Pure status transition function
│   ├── pagination.ts         — HMAC-signed cursor encode/decode
│   ├── events.ts             — DomainEvent types + bus subscriber
│   ├── cli.ts                — Boot in-memory + postgres modes
│   ├── cli-e2e.test.ts       — End-to-end smoke tests
│   └── *.test.ts             — Per-module tests
├── package.json
├── tsconfig.json
└── migrations/
 └── 001-init.sql             — Schema for issues, comments
```

## File paths (concrete)

| Path | Purpose |
|---|---|
| `services/field-service/src/types.ts` | Issue, Comment, IssueStatus, Severity enums |
| `services/field-service/src/repository.ts` | IssueRepository interface + IdempotencyStore reuse |
| `services/field-service/src/repo-memory.ts` | In-memory implementation (Phase 2 MVP) |
| `services/field-service/src/postgres-repo.ts` | Postgres implementation (Phase 2.b) |
| `services/field-service/src/postgres-repo.test.ts` | 6+ tests with FakePgClient |
| `services/field-service/src/state-machine.ts` | Pure function `transition(state, event) → state` |
| `services/field-service/src/state-machine.test.ts` | 10+ tests covering all valid + invalid transitions |
| `services/field-service/src/service.ts` | IssueService (orchestrates repo, state machine, events, pagination) |
| `services/field-service/src/service.test.ts` | 8+ tests with InMemoryIssueRepository |
| `services/field-service/src/http.ts` | Fastify routes (FR-1 through FR-8) |
| `services/field-service/src/http.test.ts` | 20+ tests including cross-tenant probes |
| `services/field-service/src/pagination.ts` | HMAC cursor encode/decode + tests |
| `services/field-service/src/events.ts` | DomainEvent types + EventBus subscriber |
| `services/field-service/src/realtime.ts` | SSE endpoint for issue events (FR-8) |
| `services/field-service/src/realtime.test.ts` | 5+ SSE tests including cross-tenant filter |
| `services/field-service/src/cli.ts` | Boot CLI (in-memory + postgres modes) |
| `services/field-service/src/cli-e2e.test.ts` | 4+ E2E tests via fetch |
| `services/field-service/migrations/001-init.sql` | Schema: issues, comments, status_history |

## Architecture decisions

### A1 — IssueRepository contract (Constitution §V stable interface)

```typescript
export interface IssueRepository {
 insertIssue(issue: Issue): Promise<void>;
 findIssue(orgId: string, id: string): Promise<Issue | null>;
 listIssues(orgId: string, projectId: string, filter?: IssueFilter, cursor?: Cursor, limit?: number): Promise<{ items: Issue[]; nextCursor: Cursor | null }>;
 updateIssue(orgId: string, id: string, patch: IssuePatch): Promise<Issue>;
 insertComment(comment: Comment): Promise<void>;
 listComments(orgId: string, issueId: string, cursor?: Cursor, limit?: number): Promise<{ items: Comment[]; nextCursor: Cursor | null }>;
 insertStatusHistory(entry: StatusHistoryEntry): Promise<void>;
 listStatusHistory(orgId: string, issueId: string): Promise<readonly StatusHistoryEntry[]>;
 softDeleteIssue(orgId: string, id: string): Promise<void>;
}
```

### A2 — Status state machine (Phase 1.4 pattern)

Pure function: `transition(state: IssueStatus, event: StatusEvent, at: Date) → { status: IssueStatus; reason?: string } | never`. No I/O. Throws on invalid transitions.

### A3 — Pagination cursor (HMAC)

```typescript
interface Cursor {
 createdAt: string; // ISO 8601
 id: string;        // UUID v7
 dir: 'next' | 'prev';
}

encode(cursor: Cursor, secret: string): string
  // Returns: base64url(json(cursor)) + '.' + base64url(HMAC-SHA256(json, secret))
decode(token: string, secret: string): Cursor
  // Throws on tampered/expired token.
```

### A4 — EventBus reuse

Field-service subscribes to capture-service events via the in-process bus (Phase 1 pattern). When a `capture.ready` event arrives, field-service updates any open issues tied to that capture with a `capture_ready` activity entry.

### A5 — Issue ID generation

ULID: .iss_<26-char-base32-of-(timestamp_ms << 16 | random)>..
Generated via the same ULID pattern as capture-service.

### A6 — Authorization (deferred from clarifications.md Q7)

Field-service uses the **same RBAC model as the rest of the platform**:
- Membership-service is the source of truth for roles.
- field-service calls `membership-service.getRole(orgId, userId, projectId)` to authorize.
- For Phase 2 MVP, we use a simple role check: any org member can create/comment; only `project_manager` role can resolve.

### A7 — Schema (postgres-repo)

```sql
CREATE TABLE issues (
 id              TEXT        PRIMARY KEY,
 org_id          TEXT        NOT NULL,
 project_id      TEXT        NOT NULL,
 capture_id      TEXT        NULL,
 client_issue_id TEXT        NULL,
 title           TEXT        NOT NULL,
 description     TEXT        NOT NULL,
 severity        TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
 status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wont_fix')),
 assigned_to     TEXT        NULL,
 coordinates     JSONB       NULL,
 due_date        TIMESTAMPTZ NULL,
 created_by      TEXT        NOT NULL,
 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 resolved_at     TIMESTAMPTZ NULL,
 deleted_at      TIMESTAMPTZ NULL,
 CONSTRAINT issues_org_not_empty CHECK (length(org_id) > 0)
);

CREATE INDEX issues_org_project_status_created_idx ON issues (org_id, project_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX issues_org_project_client_uq ON issues (org_id, project_id, client_issue_id) WHERE client_issue_id IS NOT NULL;

CREATE TABLE comments (
 id              TEXT        PRIMARY KEY,
 org_id          TEXT        NOT NULL,
 issue_id        TEXT        NOT NULL,
 author_id       TEXT        NOT NULL,
 text            TEXT        NOT NULL,
 attachments     JSONB       NOT NULL DEFAULT '[]',
 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT comments_org_not_empty CHECK (length(org_id) > 0)
);

CREATE INDEX comments_org_issue_idx ON comments (org_id, issue_id, created_at DESC);

CREATE TABLE status_history (
 id              BIGSERIAL   PRIMARY KEY,
 org_id          TEXT        NOT NULL,
 issue_id        TEXT        NOT NULL,
 from_status     TEXT        NOT NULL,
 to_status       TEXT        NOT NULL,
 reason          TEXT        NULL,
 actor_id        TEXT        NOT NULL,
 occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX status_history_org_issue_idx ON status_history (org_id, issue_id, occurred_at DESC);
```

### A8 — Routes (8 total)

```
POST   /v1/projects/:projectId/issues           (FR-1)
GET    /v1/projects/:projectId/issues           (FR-2)
GET    /v1/projects/:projectId/issues/:id       (FR-3)
PATCH  /v1/projects/:projectId/issues/:id       (FR-4)
POST   /v1/projects/:projectId/issues/:id/comments (FR-5)
POST   /v1/projects/:projectId/issues/:id/resolve (FR-6)
POST   /v1/projects/:projectId/issues/:id/reopen (FR-7)
GET    /v1/projects/:projectId/issues/:id/events (FR-8)
```

Plus health + metrics + OpenAPI stub.

## Test coverage

Target: ~100 new tests across the field-service package.

- 10+ state-machine tests
- 6+ postgres-repo tests
- 8+ service tests
- 20+ http tests (per route, including cross-tenant probes)
- 5+ pagination tests (HMAC encode/decode/tamper detection)
- 5+ realtime tests
- 4+ CLI E2E tests
- 5+ observability tests

