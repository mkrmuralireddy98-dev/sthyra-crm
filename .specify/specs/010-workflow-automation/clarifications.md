# Clarifications — Workflow Automation

**Date:** 2026-08-17
**Source:** `spec.md` §7 (7 open questions)

## Q1 — New service or extend field-service?

**Decision:** NEW workflow-service. Per spec §1 justification.

**Rationale:** Workflow Automation is event-driven, asynchronous. Field-service is CRUD.

**Impact:** New microservice on port 9097.

## Q2 — Action execution?

**Decision:** Log only (Phase 10 MVP). Transport deferred to 10.b.

**Rationale:** MVP scope discipline. Real notifications need email/SMS/push providers.

**Impact:** All `Action.type = 'notify' | 'assign' | 'log'` writes to audit log. No external transport.

## Q3 — Schedule cron execution?

**Decision:** Just store. Phase 10.b cron worker fires.

**Rationale:** Worker is a separate concern.

**Impact:** Schedule triggers fire on POST /run only (manual).

## Q4 — Threshold execution?

**Decision:** Just store. Phase 10.b threshold worker scans.

**Rationale:** Periodic scanning is separate.

**Impact:** Threshold triggers fire on POST /run only (manual).

## Q5 — Template library size?

**Decision:** 5 hardcoded templates.

**Rationale:** Cover common patterns; Phase 10.b can extend.

**Impact:** `templates: ['escalate_critical', 'notify_capture_ready', 'milestone_overdue', 'punch_completion', 'project_status_change']`

## Q6 — Service token format?

**Decision:** UUID (Phase 10.b can move to JWT).

**Rationale:** Simpler for MVP. Phase 10.b can add scoped tokens.

**Impact:** `WORKFLOW_SERVICE_TOKEN` env var. POST /v1/internal/events requires matching token.

## Q7 — Run history limit?

**Decision:** 100 runs retained per workflow. Oldest evicted on insert.

**Rationale:** Bounded growth.

**Impact:** `repo.insertWorkflowRun` evicts when count > 100.

