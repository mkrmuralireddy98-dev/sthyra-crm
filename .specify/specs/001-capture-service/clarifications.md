# Clarifications — Capture Service

**Date:** 2026-08-14
**Source:** `spec.md` § Open Questions
**Bound:** ≤5 questions per spec-kit /speckit.clarify contract

## Q1 — Reprocess endpoint scope for Phase 1 MVP?

> Default: yes, but a Phase 1.b endpoint. For Phase 1 MVP, this is
> out of scope.

**Resolution:** Out of scope for MVP. Added to Phase 1.b backlog.

**Reasoning:** Reprocess requires idempotent pipeline state +
artifact replacement logic. Adding it to MVP doubles the surface area
for marginal value (real failures are rare; users can re-upload). MVP
ships with first-attempt-only; reprocess is a clean follow-up.

---

## Q2 — `capture_metrics` granularity: per-capture or per-stage?

> Default: per-stage, rolled up to per-capture.

**Resolution:** Per-stage. Schema:
`capture_metrics(capture_id, stage_name, compute_seconds,
storage_bytes, egress_bytes, cost_usd)` rolled up to per-capture via
`captures.aggregate_cost_usd` (computed on every stage complete).

**Reasoning:** Per-stage gives us FinOps drill-down ("which stage is
expensive?") AND per-capture rollup. Per-capture only would lose the
drill-down. Cost: a few extra rows per capture, ~$0/yr at expected
volumes.

---

## Q3 — Capture whose project is deleted mid-pipeline?

> Default: pipeline continues; capture becomes orphaned; retention
> policy applies; cleanup is a separate batch job.

**Resolution:** Adopted as proposed.

**Reasoning:** Stopping a running pipeline mid-stage would waste GPU
hours already burned. Letting it complete and become orphaned is
correct — the batch job cleans up the row + artifacts later per the
retention policy. This also keeps the pipeline stateless w.r.t. project
lifecycle, which simplifies reasoning.

---

## Q4 — Pipeline orchestrator: own service or embedded?

> Default: separate `pipeline-orchestrator` service. Capture service
> emits events; orchestrator consumes.

**Resolution:** Adopted as proposed.

**Reasoning:** The orchestrator will eventually own **many** pipeline
types (capture, BIM, drone, ESG). Embedding it in the capture service
now would force a costly refactor when adding the second pipeline.
Separate service = clean abstraction over AWS Step Functions.

---

## Q5 — Pipeline idempotency?

> Default: idempotent — same input + same model version produces the
> same artifact URLs.

**Resolution:** Adopted as proposed.

**Reasoning:** Idempotent pipelines are a precondition for safe
re-processing (Phase 1.b) and for retry-on-failure. Content-addressable
artifact storage (sha256-named keys in S3) makes this trivial.

---

## Summary of changes to spec.md

None of the Q1–Q5 resolutions change the spec's FRs or NFRs. They
clarify scope and architecture. **No spec update required**; these
decisions flow forward into `/speckit.plan` as architectural guidance.
