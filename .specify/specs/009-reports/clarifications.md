# Clarifications — Reports

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — New service or extend track-service?

**Decision:** NEW report-service. Per spec §1 justification.

**Rationale:** Reports is read-only, cross-service aggregator. Track is a CRUD domain (milestones, progress). Distinct concerns.

**Impact:** New microservice on port 9096. Same monorepo.

## Q2 — Daily report generation?

**Decision:** On-demand with 5-min in-memory cache.

**Rationale:** Most projects don't generate traffic 24/7. Cache hits cost nothing.

**Impact:** Cache key = `${orgId}:${projectId}:${date}`. Hit on second request within 5 min.

## Q3 — Cross-service auth?

**Decision:** Stub token (Phase 9.b for real auth).

**Rationale:** Phase 9 MVP doesn't have a service-to-service auth flow yet. Stub token (e.g., "REPORT_SERVICE_TOKEN") for now.

**Impact:** Hardcoded token in env. Phase 9.b: OIDC + scopes.

## Q4 — Custom report entity enum?

**Decision:** 3 entities: 'issues' | 'captures' | 'milestones'.

**Rationale:** Covers the core data plane. Phase 9.b can add 'photos', 'comments', etc.

**Impact:** Union type. Phase 9.b can extend.

## Q5 — Cache invalidation?

**Decision:** 5-min TTL only. No active invalidation.

**Rationale:** Reports are eventually consistent. PMs don't need millisecond freshness.

**Impact:** In-memory Map with `expiresAt`. Background sweep not needed (Map entries get cleaned on access).

## Q6 — Schedule execution?

**Decision:** Just store. Phase 9.b worker fires cron.

**Rationale:** Worker is a separate concern from the report-service. Schedule records are stored now; cron worker is Phase 9.b.

**Impact:** `nextRunAt` field is computed but not acted on.

## Q7 — Schedule recipients?

**Decision:** Email addresses. Phase 9.b: actual SMTP transport.

**Rationale:** Standard for stakeholder reports. Phase 9.b wires SMTP.

**Impact:** `recipients: string[]` validated as email format.

