# Implementation Plan — Workflow Automation

**Feature ID:** 010-workflow-automation
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Architecture Decision — NEW SERVICE

`workflow-service` is a new microservice on port 9097.

## File paths

```
services/workflow-service/
├── package.json
├── tsconfig.json
├── Dockerfile
├── migrations/
│ └── 001-init.sql                            ← workflows + workflow_runs tables
└── src/
 ├── types.ts                                  ← Workflow, Trigger, Condition, Action, WorkflowRun, Template
 ├── types.test.ts                             ← 6 tests
 ├── repository.ts                              ← WorkflowRepository contract
 ├── repo-memory.ts                              ← InMemoryWorkflowRepository
 ├── repo-memory.test.ts                         ← 4 tests
 ├── engine.ts                                   ← PURE: evaluateTrigger / evaluateCondition / applyActions
 ├── engine.test.ts                              ← 12 tests
 ├── templates.ts                                ← 5 hardcoded templates
 ├── templates.test.ts                           ← 5 tests
 ├── service.ts                                  ← WorkflowService (CRUD + run + receive event)
 ├── service.test.ts                              ← 12 tests
 ├── http.ts                                      ← 8 routes
 ├── http.test.ts                                 ← 25 tests
 ├── cli.ts                                       ← startInMemoryServer
 ├── cli-e2e.test.ts                               ← 4 tests
 └── migrations/001-init.sql
```

## Architecture decisions

### A1 — Pure engine

```typescript
export function evaluateTrigger(trigger: Trigger, context: EventContext): boolean;
export function evaluateCondition(condition: Condition | undefined, context: EventContext): boolean;
export function applyActions(actions: readonly Action[], context: EventContext, auditLog: AuditLog): { applied: number; errors: string[] };
```

### A2 — EventContext shape

```typescript
interface EventContext {
 orgId: string;
 projectId?: string;
 eventType: string;
 payload: Record<string, unknown>;
 [key: string]: unknown; // for threshold evaluation (e.g., days_open)
}
```

### A3 — Audit log (in-memory)

```typescript
interface AuditLogEntry {
 runId: string;
 workflowId: string;
 actionType: string;
 target: string;
 message: string;
 timestamp: Date;
}
```

### A4 — Templates

```typescript
const TEMPLATES: Template[] = [
 { id: 'escalate_critical', name: 'Escalate critical issues after 7 days', trigger: { type: 'threshold', entity: 'issues', metric: 'days_open', op: '>', value: 7 }, condition: { type: 'equals', field: 'severity', value: 'critical' }, action: { type: 'notify', recipients: [], template: 'issue_escalation' } },
 { id: 'notify_capture_ready', name: 'Notify on capture ready', trigger: { type: 'event', eventType: 'capture.ready' }, action: { type: 'notify', recipients: [], template: 'capture_ready' } },
 { id: 'milestone_overdue', name: 'Notify on milestone overdue', trigger: { type: 'event', eventType: 'milestone.overdue' }, action: { type: 'notify', recipients: [], template: 'milestone_overdue' } },
 { id: 'punch_completion', name: 'Notify on punch list completion', trigger: { type: 'event', eventType: 'punch.completed' }, action: { type: 'notify', recipients: [], template: 'punch_completed' } },
 { id: 'project_status_change', name: 'Log project status change', trigger: { type: 'event', eventType: 'project.status_changed' }, action: { type: 'log', message: 'Project status changed' } },
];
```

### A5 — Routes (8)

```
POST   /v1/orgs/:orgId/workflows                (FR-1)
GET    /v1/orgs/:orgId/workflows                (FR-2)
PATCH  /v1/workflows/:id                       (FR-3)
DELETE /v1/workflows/:id                       (FR-4)
POST   /v1/workflows/:id/run                   (FR-5)
GET    /v1/workflows/:id/runs?limit=20        (FR-6)
POST   /v1/internal/events                     (FR-7, requires service token)
GET    /v1/orgs/:orgId/workflows/templates     (FR-8)
+ GET  /v1/health
```

### A6 — Service-to-service auth

```typescript
const SERVICE_TOKEN = process.env.WORKFLOW_SERVICE_TOKEN ?? 'sthyra-crm-workflow-service-token';
// POST /v1/internal/events requires x-service-token header matching
```

### A7 — Run history eviction

```typescript
async insertWorkflowRun(run: WorkflowRun): Promise<void> {
 this.runs.set(this.runKey(run.orgId, run.workflowId, run.id), run);
 const allRuns = this.listRunsByWorkflow(orgId, workflowId);
 if (allRuns.length > 100) {
 // Evict oldest
 const sorted = [...allRuns].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
 const toEvict = sorted.slice(0, allRuns.length - 100);
 for (const r of toEvict) this.runs.delete(this.runKey(orgId, workflowId, r.id));
 }
}
```

