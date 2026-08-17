# Tasks — Field Service

**Feature ID:** 002-field-service
**Date:** 2026-08-17
**Source:** spec.md + clarifications.md + plan.md + checklist.md

## Conventions

- Every task is one TDD cycle (RED → GREEN → REFACTOR).
- Tasks numbered T-NNN, grouped into 7 slices.
- Files marked [NEW] don't exist yet.
- DoD = Definition of Done (when the task is shippable).

---

## Slice 1 — Foundations (T-001 to T-005)

### T-001 — Package skeleton

- **Files (NEW):** `services/field-service/package.json`, `tsconfig.json`
- **Test:** `node_modules/.pnpm` install succeeds; `pnpm test` command exists.
- **Implementation:** declare `@sthyra-crm/field-service` package, depend on `@sthyra-crm/observability`, `fastify`.
- **DoD:** package installs, has scripts.

### T-002 — Domain types

- **Files (NEW):** `services/field-service/src/types.ts`
- **Test:** `types.test.ts` — covers all union members, readonly invariants, status state machine completeness.
- **Implementation:** `Issue`, `Comment`, `StatusHistoryEntry`, `Coordinates`, `Severity`, `IssueStatus` enums, `IssueFilter`.
- **DoD:** 10+ tests passing.

### T-003 — `IssueRepository` interface

- **Files (NEW):** `src/repository.ts`
- **Test:** type-level test that the contract compiles.
- **Implementation:** IssueRepository interface + IdempotencyStore reuse.
- **DoD:** interface compiles + 5+ type tests.

### T-004 — `InMemoryIssueRepository`

- **Files (NEW):** `src/repo-memory.ts`
- **Test:** 8+ tests with per-capture fixtures + cross-tenant probes.
- **Implementation:** In-memory store with Maps keyed by `(orgId, projectId, captureId)`.
- **DoD:** all CRUD methods + list with cursor pagination working.

### T-005 — `PostgresIssueRepository` skeleton

- **Files (NEW):** `src/postgres-repo.ts`
- **Test:** 6+ tests with FakePgClient.
- **Implementation:** parameterized SQL only; tenant-scoped WHERE on every query.
- **DoD:** compiles; unique violation maps to typed error.

---

## Slice 2 — Status state machine (T-006 to T-009)

### T-006 — Pure transition function

- **Files (NEW):** `src/state-machine.ts`
- **Test:** 10+ tests — happy paths, invalid transitions, terminal states.
- **Implementation:** pure function `transition(state, event, at) → newState | throw`.
- **DoD:** throws on invalid transitions; immutability verified.

### T-007 — State machine + IssueStatus enums

- **Files (NEW):** tests for `IssueStatus` enum values: `open | in_progress | resolved | wont_fix`.
- **Test:** each enum value has a documented transition set.
- **DoD:** enum + transitions matrix documented.

### T-008 — Status history recording

- **Files (NEW):** `src/status-history.ts`
- **Test:** 4+ tests for the recordStatusChange function.
- **Implementation:** appends to status_history table on every transition.
- **DoD:** immutable log; replay works.

### T-009 — Pagination cursor (HMAC)

- **Files (NEW):** `src/pagination.ts`
- **Test:** 5+ tests — encode/decode, tamper detection, expiry.
- **Implementation:** base64url(json(cursor)) + HMAC-SHA256 signature.
- **DoD:** tampered tokens throw; expired tokens throw.

---

## Slice 3 — Service layer (T-010 to T-013)

### T-010 — `IssueService.create`

- **Files (NEW):** `src/service.ts`
- **Test:** 5+ tests including idempotency, duplicate client_issue_id.
- **Implementation:** `create(orgId, projectId, idempotencyKey, input)` — creates issue + emits `issue.created` event.
- **DoD:** 201 first, 200 replay, 409 duplicate.

### T-011 — `IssueService.update` + `resolve` + `reopen`

- **Files (NEW):** tests for update / resolve / reopen.
- **Implementation:** drives the state machine; emits events; writes status_history.
- **DoD:** 3+ tests per action; cross-tenant 404.

### T-012 — `IssueService.comments`

- **Files (NEW):** `commentOnIssue` function.
- **Test:** 4+ tests including attachment references.
- **Implementation:** inserts comment + emits `issue.commented`.
- **DoD:** comments list returns chronologically.

### T-013 — `IssueService.list` with cursor pagination

- **Files (NEW):** tests for pagination edges.
- **Implementation:** list with cursor + filter; returns `nextCursor` when more results exist.
- **DoD:** stable ordering; empty list returns null cursor.

---

## Slice 4 — HTTP API (T-014 to T-021)

### T-014 — POST /v1/projects/:projectId/issues

- **Files (NEW):** `src/http.ts` (initial)
- **Test:** 201/200/409/400/401/403 cases.
- **Implementation:** wire IssueService.create into the route.
- **DoD:** all status codes match spec.

### T-015 — GET /v1/projects/:projectId/issues (list)

- **Files:** `src/http.ts` (extend)
- **Test:** filter combinations, cursor pagination, empty results.
- **Implementation:** cursor encode/decode via pagination.ts.
- **DoD:** 200 with `data` array + `nextCursor`.

### T-016 — GET /v1/projects/:projectId/issues/:id

- **Files:** `src/http.ts` (extend)
- **Test:** 200, 404, cross-tenant 404.
- **Implementation:** include status_history + comments in response.
- **DoD:** full timeline visible.

### T-017 — PATCH /v1/projects/:projectId/issues/:id

- **Files:** `src/http.ts` (extend)
- **Test:** 200, 404, invalid PATCH body → 400.
- **Implementation:** drives state machine.
- **DoD:** only allowed fields updatable.

### T-018 — POST comments, resolve, reopen

- **Files:** `src/http.ts` (extend)
- **Test:** 5+ tests per endpoint.
- **Implementation:** 3 routes, RFC 7807 on errors.
- **DoD:** all routes green.

### T-019 — Cross-tenant probes return 404

- **Files:** extend existing tests
- **Test:** 8+ cross-tenant probes (read, update, comment, resolve, reopen).
- **DoD:** every cross-tenant case verified.

### T-020 — Idempotency-Key contract

- **Files:** extend existing tests
- **Test:** 201 first, 200 replay, 400 missing.
- **DoD:** all 3 cases verified per route.

### T-021 — RFC 7807 errors

- **Files:** extend existing tests
- **Test:** 6+ error scenarios with `application/problem+json` content-type.
- **DoD:** every error has `type + status + title + detail + trace_id + code`.

---

## Slice 5 — Realtime push (T-022 to T-024)

### T-022 — IssueEventBus subscriber

- **Files (NEW):** `src/events.ts`
- **Test:** 5+ tests for subscriber pattern.
- **Implementation:** subscribe by issueId, deliver issue.* events.
- **DoD:** cross-tenant isolation verified.

### T-023 — SSE endpoint

- **Files (NEW):** `src/realtime.ts`
- **Test:** 6+ tests — history replay, live stream, cross-tenant 404.
- **Implementation:** `GET /v1/projects/:projectId/issues/:id/events`.
- **DoD:** SSE wire format matches Phase 1.

### T-024 — Capture-event integration

- **Files:** `src/service.ts` (extend)
- **Test:** 3+ tests — `capture.ready` event triggers activity entry.
- **Implementation:** subscribe to capture-service bus, write activity.
- **DoD:** cross-service events flow.

---

## Slice 6 — Observability (T-025 to T-027)

### T-025 — `@sthyra-crm/observability` integration

- **Files:** `src/http.ts` (extend)
- **Test:** 5+ tests for x-request-id propagation.
- **Implementation:** `installRequestIdPlugin` + structured logs at every route.
- **DoD:** every response has `x-request-id` header.

### T-026 — Structured logging at state transitions

- **Files:** `src/service.ts` (extend)
- **Test:** 5+ tests for `issue.*` log lines.
- **Implementation:** `emit('info', 'issue_created', {...})` etc.
- **DoD:** every state change has a log line with captureId/orgId.

### T-027 — `/v1/metrics` endpoint

- **Files (NEW):** `src/metrics.ts`
- **Test:** 4+ tests for Prometheus format.
- **Implementation:** `issue_created_total{severity=...}`, `issue_resolved_total{...}`, `comments_total`.
- **DoD:** scrape endpoint returns valid text format.

---

## Slice 7 — E2E (T-028 to T-030)

### T-028 — CLI smoke test

- **Files (NEW):** `src/cli-e2e.test.ts`
- **Test:** 4+ tests booting the CLI + fetch.
- **Implementation:** `startInMemoryServer` + `startPostgresServer` exports.
- **DoD:** full lifecycle works over real HTTP.

### T-029 — Phase 2.b Postgres integration

- **Files (NEW):** `migrations/001-init.sql`
- **Test:** Docker compose brings up Postgres + field-service.
- **Implementation:** full SQL schema from plan §A7.
- **DoD:** migrations auto-run; CLI connects.

### T-030 — Docker compose integration

- **Files (NEW):** `services/field-service/Dockerfile`, update `docker-compose.integration.yml`.
- **Test:** CI validates compose YAML.
- **Implementation:** field-service container alongside capture-service.
- **DoD:** docker-compose up brings up the full stack.

---

## Status — to be updated by /speckit.implement

Phase 2 status: pending

## Status — Phase 2 complete (2026-08-17)

All 7 slices shipped. All 30 tasks complete. 130 field-service tests passing.

### Slices

- ✅ Slice 1 — Foundations (T-001 to T-005): package, types, IssueRepository, InMemory + Postgres, SQL migration
- ✅ Slice 2 — State machine + history + pagination (T-006 to T-009): pure transitionStatus, status-history, HMAC pagination
- ✅ Slice 3 — Service layer (T-010 to T-013): IssueService.create / update / resolve / reopen / comment / list
- Slice 4 — HTTP layer (T-014 to T-021): 8 routes, RFC 7807 errors, cross-tenant 404, idempotency replay
- Slice 5 — Realtime (T-022 to T-024): InMemoryEventBus, SSE with history replay
- Slice 6 — Observability (T-025 to T-027): installRequestIdPlugin, structured logs
- Slice 7 — E2E (T-028 to T-030): CLI + Dockerfile + docker-compose integration

### Test counts (2026-08-17)

- Field-service: 130 tests
- Whole project: 520 tests (Phase 1: 387, Phase 2 added 133)
- 44 commits on main, all pushed to https://github.com/mkrmuralireddy98-dev/sthyra-crm
