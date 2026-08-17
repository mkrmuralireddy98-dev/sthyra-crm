# Feature Specification — Workflow Automation

**Feature ID:** 010-workflow-automation
**Phase:** 10 (tenth feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Phase 10 architectural decision:** NEW service `workflow-service` (justified in §1)

---

## 1. Summary

**Workflow Automation** is the rules engine. It listens to events from the existing services and triggers actions:

- **Triggers** — conditions based on events (e.g., "issue created", "milestone overdue")
- **Conditions** — filters (e.g., "severity is critical", "trade is plumbing")
- **Actions** — effects (e.g., "send notification", "assign to user X", "log to audit")

**Why now:** Phases 1-9 give us the data plane. Workflows automate the manual coordination between events and actions.

**Architectural decision:** NEW `workflow-service` on port 9097. Rationale:
- Workflow Automation is event-driven, asynchronous — fundamentally different from CRUD
- Per Constitution §VII — distinct domain (rules engine vs execution)
- 13-product roadmap explicitly listed Workflow Automation as a separate product

**Scope discipline:** Phase 10 MVP ships **3 trigger types** (event, schedule, threshold) + **3 action types** (notify, assign, log). Phase 10.b can add more.

---

## 2. Functional Requirements (FRs)

### FR-1 — Create a workflow rule
**As** an admin
**I want** to define a workflow rule
**So that** the system automates repetitive tasks.

- `POST /v1/orgs/:orgId/workflows`
- Body: `{ name, trigger: Trigger, condition?: Condition, action: Action, enabled: boolean }`
- Returns: `{ workflowId, enabled, lastRunAt: null }`
- Headers: `x-tenant-id`, `x-idempotency-key`
- 201 first / 200 on replay

### FR-2 — List workflow rules
**As** an admin
**I want** to list all my org's workflows
**So that** I can manage them.

- `GET /v1/orgs/:orgId/workflows`
- Returns: `{ items: Workflow[] }`
- 200 with paginated list

### FR-3 — Update a workflow
**As** an admin
**I want** to enable/disable or modify a workflow
**So that** I can iterate on the rule.

- `PATCH /v1/workflows/:id`
- Body: `{ name?, trigger?, condition?, action?, enabled? }`
- 200 on success / 404 on cross-tenant / 422 on invalid trigger/condition/action

### FR-4 — Delete a workflow
**As** an admin
**I want** to delete a workflow
**So that** I can clean up obsolete rules.

- `DELETE /v1/workflows/:id`
- 204 on success / 404 on cross-tenant

### FR-5 — Manual run
**As** an admin
**I want** to manually trigger a workflow
**So that** I can test it.

- `POST /v1/workflows/:id/run`
- Body: `{ context: Record<string, unknown> }` (sample event payload)
- Returns: `{ runId, status: 'completed' | 'failed', actionsApplied: number, errors?: string[] }`
- 200 on success / 422 if trigger can't be invoked manually

### FR-6 — Workflow run history
**As** an admin
**I want** to see a workflow's run history
**So that** I can debug failures.

- `GET /v1/workflows/:id/runs?limit=20`
- Returns: `{ items: WorkflowRun[] }`
- 200; runs include status, context snapshot, actions applied, errors

### FR-7 — Event subscription (internal)
**As** an upstream service
**I want** to publish an event to workflow-service
**So that** workflows can listen.

- `POST /v1/internal/events`
- Body: `{ eventType, orgId, projectId?, payload: Record<string, unknown> }`
- Returns: `{ delivered: number }` (count of workflows that matched)
- Headers: `x-service-token` (server-to-server auth, Phase 10.b)
- 200 on success / 401 on bad token

### FR-8 — Template library
**As** an admin
**I want** to start from a template
**So that** I don't write every rule from scratch.

- `GET /v1/orgs/:orgId/workflows/templates`
- Returns: `{ items: Template[] }` — built-in templates like "Escalate critical issues after 7 days"
- 200 with hardcoded template list

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every endpoint enforces `x-tenant-id` (or `:orgId` path). Cross-tenant = 404.

### NFR-2 — RFC 7807 errors
All errors return `application/problem+json` with 6-field shape.

### NFR-3 — Idempotency
POST endpoints require `x-idempotency-key`. Replay returns 200 with same id.

### NFR-4 — Audit trail
Every workflow run is logged (WorkflowRun record) with context snapshot, actions applied, errors.

### NFR-5 — Service-to-service auth
FR-7 requires `x-service-token`. Phase 10 MVP: stub token from env var.

### NFR-6 — Rate limiting
Each workflow has max 100 runs/day. Phase 10.b: per-tenant rate limits.

### NFR-7 — Soft delete
Workflows and runs are never hard-deleted. Use `deletedAt`.

---

## 4. Trigger / Condition / Action types (Phase 10 MVP)

### Trigger types (3)

```typescript
type Trigger =
 | { type: 'event'; eventType: string; orgId?: string }
 | { type: 'schedule'; cron: string; timezone?: string }
 | { type: 'threshold'; entity: 'issues'; metric: 'days_open'; op: '>' | '>=' | '<' | '<=' | '=='; value: number };
```

### Condition types (3)

```typescript
type Condition =
 | { type: 'equals'; field: string; value: unknown }
 | { type: 'in'; field: string; values: readonly unknown[] }
 | { type: 'and'; conditions: readonly Condition[] };
```

### Action types (3)

```typescript
type Action =
 | { type: 'notify'; recipients: readonly string[]; template: string }
 | { type: 'assign'; assignee: string }
 | { type: 'log'; message: string };
```

---

## 5. User scenarios

### Scenario A — Auto-escalate stale critical issues
1. Admin creates workflow:
 - trigger: threshold (issues, days_open > 7)
 - condition: severity == critical
 - action: notify (project_manager@example.com, "issue_escalation")
2. Background worker runs every hour, scans open critical issues, fires `days_open > 7` trigger
3. Worker evaluates condition → severity is critical → true
4. Worker applies action → sends notification
5. Audit log records: workflow_run with actionsApplied=1

### Scenario B — Notify on capture ready
1. Admin creates workflow:
 - trigger: event ("capture.ready")
 - action: notify (inspector@example.com, "capture_ready")
2. capture-service publishes event on capture ready
3. workflow-service receives event, matches workflow, evaluates (no condition = true), applies action
4. Notification sent

### Scenario C — Scheduled daily report trigger
1. Admin creates workflow:
 - trigger: schedule (cron: "0 8 * * *", timezone: "UTC")
 - action: log ("daily summary ready")
2. Cron worker fires at 8 AM daily
3. Action logged
4. (Phase 10.b: actually generate report via report-service)

### Scenario D — Manual run for testing
1. Admin clicks "Test" on a workflow
2. Server creates a WorkflowRun with the provided context
3. Evaluates trigger (returns "manual" type, skips trigger evaluation)
4. Evaluates condition, applies actions
5. Returns: { runId, status, actionsApplied, errors }

### Scenario E — AI Copilot creates a workflow
1. PM asks AI Copilot: "Set up escalation for critical issues"
2. AI Copilot (Phase 4) routes to workflow-service via POST /v1/orgs/X/workflows with template "escalate_critical"
3. Server applies the template + small adjustments
4. Returns: workflowId

---

## 6. Out of scope (for this Phase 10 MVP)

- **Cron worker** — Phase 10.b. Schedules are stored; cron execution is a separate worker.
- **Threshold worker** — Phase 10.b. Periodic scans are a separate worker.
- **Notification transport** (email, SMS, push) — Phase 10.b. Stub: log to audit only.
- **Multi-step actions** ("if this fails, do that") — Phase 10.b.
- **Workflow versioning** — Phase 10.b.
- **Visual workflow builder** — Phase 12 (Dashboard).

---

## 7. Open questions (will resolve in /speckit.clarify)

1. **New service or extend field-service?** — new workflow-service or extend field-service? **Default: new workflow-service (per A-decision justification).**
2. **Action execution?** — actual transport or just log? **Default: log only (Phase 10.b transport).**
3. **Schedule cron execution?** — actually run or just store? **Default: just store (Phase 10.b worker).**
4. **Threshold execution?** — actually scan or just store? **Default: just store (Phase 10.b worker).**
5. **Template library size?** — 5 or 10 templates? **Default: 5 hardcoded (Phase 10.b can add more).**
6. **Service token format?** — UUID or JWT? **Default: UUID (Phase 10.b can move to JWT).**
7. **Run history limit?** — 100 or 1000? **Default: 100 runs retained per workflow (oldest are evicted).**

