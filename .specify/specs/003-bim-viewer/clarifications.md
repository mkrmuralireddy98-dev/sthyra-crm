# Clarifications — BIM Viewer

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — IFC schema coverage?

**Decision:** IFC 4x3 only for Phase 3 MVP. IFC 2x3 / IFC 4 deferred to Phase 4.

**Rationale:** IFC 4x3 (the modern Industry Foundation Classes, published 2024) is the current standard. Real-world BIM tools are migrating. We pick one version to keep the validation surface small; legacy schema support is a separate, opt-in migration story.

**Impact on tests:** `parseIfcModel()` returns `{ schema: 'IFC4X3' }` or throws. Tests assert both happy path (valid IFC 4x3) and rejection of legacy.

## Q2 — Storage tier?

**Decision:** S3 standard tier. LocalFs fallback for dev (mirrors capture-service).

**Rationale:** BIM files are accessed frequently during the active project but archived after. S3 Standard is the right tradeoff. (S3 Intelligent-Tiering would auto-classify but adds cost variance.)

**Impact:** Reuses `BlobStorage` interface from capture-service/src/storage. Storage key: `bim/{orgId}/{projectId}/{modelHash}.ifc`.

## Q3 — Alignment algorithm?

**Decision:** ICP (Iterative Closest Point) via our existing `IcpAlignStage` from capture-service Phase 1.4.

**Rationale:** Reuses already-implemented code (§VII — no re-decision of established patterns).

**Impact:** Bim-viewer-service calls into capture-service's `IcpAlignStage` rather than implementing a new algorithm. The align API is essentially "trigger IcpAlignStage on this capture against the BIM model".

## Q4 — Cache strategy?

**Decision:** Precomputed bbox tree per model, in-memory for Phase 3 MVP; Redis in Phase 3.b.

**Rationale:** Per-org tenant isolation means a single model is unlikely to be hot-shared across many tenants. In-memory works for v1; Redis adds a multi-instance hot-cache path in Phase 3.b (mirrors capture-service's pattern).

**Impact:** `BboxTree` interface with `findNearest(x, y, z) → ElementId | null`. Tests use a fake tree.

## Q5 — Diff accuracy (point-to-mesh distance threshold)?

**Decision:** 0.05m (5cm) default, configurable per request via query param.

**Rationale:** Below 5cm is "construction tolerance" — most real-world field-vs-model discrepancies are larger than that and represent actual deviations. Configurable per request because different trades have different tolerances.

**Impact:** `GET .../diff?captureId=X` accepts `?thresholdMeters=0.05`. Default 0.05m. Tests assert both default and explicit threshold.

## Q6 — Authorization?

**Decision:** Phase 3 MVP uses the same RBAC pattern as Phase 2 (deferred-to-A6):
- Read (GET): any authenticated org member
- Upload, Delete, Re-align (POST/DELETE): `project_manager` role from membership-service

**Rationale:** Same as Phase 2 §A6 — reuse the pattern. membership-service is the source of truth for org roles.

**Impact:** Bim-viewer-service has a thin `MembershipChecker` interface; the HTTP layer gates writes. Phase 3 MVP provides an in-memory fake; Phase 3.b wires the real `GET /v1/orgs/:orgId/members` from membership-service.

## Q7 — Versioning (keep history or replace on new upload)?

**Decision:** Keep history (soft-delete old, add new). New model becomes `currentModelId`; old models remain queryable for audit/replay.

**Rationale:** Audit + reproducibility. If a field crew's BIM is wrong, having the history of uploads makes "what changed" answerable.

**Impact:** Schema has `isCurrent BOOLEAN` flag per model row. The "current" constraint enforces only one `isCurrent=true` per (orgId, projectId). Historical queries allowed.

## Spec impact

The 7 clarifications all lock in choices that map directly to implementation. None require plan amendments (no scope change, no FR additions). The plan.md below reflects these decisions.

