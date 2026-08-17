# Clarifications — Track

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — New service or extend field-service?

**Decision:** New `track-service`. Per spec §1 justification.

**Rationale:** Track's domain (milestones, schedule variance, project status) is distinct from field-service (issues, comments, status history). Extending field-service would mix concerns.

**Impact:** New microservice on port 9095. Same monorepo.

## Q2 — Cycle detection algorithm?

**Decision:** DFS with memo. O(V + E).

**Rationale:** Sufficient for the size of milestone graphs (typically < 100 per project).

**Impact:** `topologicalSort(milestones)` helper; rejects cycles on creation with 422.

## Q3 — Auto-status thresholds?

**Decision:** `progressPct < timeElapsedPct × 0.95` triggers `at_risk`. `progressPct < timeElapsedPct × 0.5` after planned end date → `delayed`.

**Rationale:** Standard construction industry heuristic: 5% slack before at_risk.

**Impact:** `computeProjectStatus(milestones, progress, now)` pure function.

## Q4 — Variance formula?

**Decision:** Simple `actualDate - plannedDate` per milestone. Project variance = max(milestone variances).

**Rationale:** PMs think in days. Simple is best.

**Impact:** `varianceDays = actualDate.getTime() - plannedDate.getTime() / 86_400_000`.

## Q5 — Source validation?

**Decision:** Server-side trust only. Auto sources are emitted by internal hooks. `manual` is the only user-driven source.

**Rationale:** Prevents tampering with auto-completion percentages.

**Impact:** POST /progress: validate `source` matches the caller's role. Phase 8 MVP: only `manual` is accepted.

## Q6 — Milestone deletion?

**Decision:** Soft-delete via `deletedAt`. NFR-7.

**Rationale:** Audit trail preserved.

**Impact:** `DELETE /v1/projects/:id/milestones/:mid` sets `deletedAt = now`. List endpoint filters out deleted.

## Q7 — Project status initial value?

**Decision:** `planning` on project creation. Transitions to `active` when first milestone becomes `in_progress`. `completed` when all milestones are `completed` or `skipped`. `cancelled` is a manual transition.

**Rationale:** Standard project lifecycle.

**Impact:** `computeProjectStatus` derives from milestone states. Manual `cancelled` transition requires `project_manager` role (Phase 12 enforces).

