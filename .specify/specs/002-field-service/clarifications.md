# Clarifications — Field Service

**Date:** 2026-08-17
**Source:** `spec.md` § Open Questions
**Bound:** ≤5 questions per spec-kit `/speckit.clarify` contract

## Q1 — Pagination strategy

**Decision:** Cursor-based with HMAC-signed tokens. Default 50 items per page, max 200. Cursor encodes `(createdAt, id)` and is signed with the org's pagination secret. Tampering returns 400. TTL is 24h — expired cursors return 400 with `code: 'pagination_cursor_expired'`.

**Rejected alternatives:**
- Offset-based (`?page=2`): simple but breaks when items are added/removed during pagination (Constitution §V stable interfaces).
- Opaque server-side cursors stored in Redis: requires Redis lookups on every pagination call. HMAC-signed is stateless and faster.

## Q2 — Issue identifier format

**Decision:** Server-assigned UUID v7 (time-ordered). Format: `iss_<22-char-base32>` (e.g., `iss_01h8x9y4z7w6v5u3t2s1r0`). v7 embeds a millisecond timestamp + random suffix, so sorting by ID gives chronological order without a separate index.

**Rejected:**
- Sequential integers (`ISS-001`): leaks volume and creates contention.
- Pure UUID v4 (random): loses chronological sort; requires sorting on `created_at`.

## Q3 — Severity levels

**Decision:** Fixed enum: `low | medium | high | critical`. No custom severities in v1. Stored as TEXT in Postgres with a CHECK constraint.

**Rejected:**
- Numeric severity (0-100): harder to communicate in UI, no natural grouping.
- Custom per-project severities: complicates reporting across projects.

## Q4 — Status state machine

**Decision:** 4 states: `open → in_progress → resolved`. `resolved → open` via `reopen`. `wont_fix` is a terminal state reachable from `open` or `in_progress` (per project manager decision). The state machine lives is a pure function (Phase 1.4 pattern). Invalid transitions throw.

```
open --claim--> in_progress --resolve--> resolved
                              --wont-fix--> wont_fix
resolved --reopen--> open
wont_fix --reopen--> open
```

## Q5 — Comment attachments

**Decision:** Comments can reference capture-service chunks by `chunkKey` (the S3 key, e.g., `org/org_a/project/prj_1/capture/cap_001/raw/chunk-0017.bin`). The field engineer uploads the new scan via capture-service first, gets back the chunkKey, then references it in the comment. No new upload pipeline in field-service.

**Rejected:**
- Field-service owns its own S3 bucket: doubles S3 IAM policy complexity.
- Inline base64 in comment body: 50MB+ scans don't fit.

## Deferred to plan.md

- **Authorization model** (Q7 in spec): Will be defined in `/speckit.plan` as a concrete RBAC table.
- **Mobile push notifications** — Phase 3 spec, deferred.
- **Multi-language** — i18n spec, deferred.

