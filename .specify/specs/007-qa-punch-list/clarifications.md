# Clarifications — QA / Punch List

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — Extend or duplicate field-service?

**Decision:** Extend field-service (Phase 2). Add `kind: 'standard' | 'punch'` discriminator to Issues. Punch items use a `punch_data` JSONB column.

**Rationale:** Constitution §VII — no re-decision. Issue tracking is the same domain.

**Impact:** `Issue` schema migration: add `kind`, `punchData JSONB NULL`. All existing Phase 2 issues keep `kind = 'standard'`.

## Q2 — Photo storage backend?

**Decision:** Phase 7 MVP stores photos in Postgres BYTEA. Phase 7.b migrates to S3 (Phase 1.3 BlobStorage).

**Rationale:** BYTEA keeps Phase 7 MVP simple. S3 is the production-grade story.

**Impact:** `issue_photos` table with `data BYTEA, content_type TEXT, sha256 TEXT`. Photos ≤ 10MB.

## Q3 — Trade enum cardinality?

**Decision:** 6 trades: `plumbing | electrical | structural | hvac | finishes | other`.

**Rationale:** Sufficient coverage for typical construction. Phase 7.b can extend.

**Impact:** TypeScript union `Trade`.

## Q4 — Closeout completion formula?

**Decision:** Simple `(closed / total)`. Also expose breakdown by status + by trade.

**Rationale:** Simple is best. Weighted-by-severity is a Phase 7.b enhancement.

**Impact:** Report returns both overall % and per-bucket counts.

## Q5 — Punch auto-archive?

**Decision:** No. Project status is separate from punch status.

**Rationale:** Closing the project doesn't auto-close all open items.

**Impact:** No automatic state transitions on project close.

## Q6 — Punch items in standard list?

**Decision:** Standard list endpoint returns all (Phase 2 unchanged). Filter by `kind` is a client-side choice.

**Rationale:** Backward compat with existing tooling.

**Impact:** Phase 2 GET `/issues` unchanged. New endpoint `GET /issues?kind=punch` deferred to a future phase.

## Q7 — Photo caption localization?

**Decision:** en-US captions only in MVP. Phase 7.b adds i18n (reusing Phase 6 i18n module from mobile-bff-service).

**Rationale:** Phase 6 i18n is in mobile-bff-service. Phase 7 lives in field-service. Phase 7.b will extract shared i18n.

**Impact:** Photos have `caption: string` (plain en-US text).

