# Analysis — Field Service

**Feature ID:** 002-field-service
**Date:** 2026-08-17
**Source:** spec.md + plan.md + clarifications.md + .specify/memory/constitution.md

## Cross-artifact consistency check

| Check | Status | Notes |
|---|---|---|
| Spec FRs map to plan routes | ✅ | 8 FRs → 8 routes in plan §A8 |
| Clarifications all resolved in spec | ✅ | Q1-Q7 closed in clarifications.md |
| Status state machine is a pure function | ✅ | Plan §A2, matches Phase 1.4 pattern |
| Cursor uses HMAC (no Redis lookup) | ✅ | Plan §A3 |
| Tenant boundary in every SQL | ✅ | Plan §A7 (CHECK constraint + indexes all start with org_id) |
| Idempotency-Key required on POST | ✅ | FR-1, FR-5, FR-6, FR-7 |
| RFC 7807 for all errors | ✅ | NFR-5 |
| Request-id propagation | ✅ | NFR-6 |
| No re-decision of Phase 1 patterns | ✅ | Plan §A1, §A4 reuse Repository + EventBus |
| Constitution §V (interface-stable) | ✅ | IssueRepository is the contract |
| Soft delete (NFR-8) | ✅ | Schema includes deleted_at; list filter |
| Pagination max 200/page | ✅ | Plan §A3 |
| UUID v7 for IDs (clarification Q2) | ✅ | Plan §A5 |
| Severity = 4 levels (clarification Q3) | ✅ | Plan §A7 (CHECK constraint) |
| Status = 4 states (clarification Q4) | ✅ | Plan §A2 + §A7 |
| Comment attachments = chunk refs (clarification Q5) | ✅ | Plan §A7 (JSONB array of chunk keys) |

## Findings

### F1 — Authorization model is underspecified (clarification Q7 deferred)

The spec says "any org member can create/comment; only assignees + managers can resolve." Plan §A6 says "project_manager role" but the spec didn't explicitly authorize this. **Resolved by A6**: project_manager role from membership-service gates resolve/reopen. The membership-service is the source of truth; field-service just calls it.

### F2 — Cross-service event subscription not yet wired

A4 mentions subscribing to `capture.ready` events from the capture-service bus. This is an integration concern — Phase 2.b work. For Phase 2 MVP, we'll skip the cross-service subscription and let the dashboard poll both services.

### F3 — Status history is in the schema but not in the FRs

The plan adds `status_history` table (good for audit trail) but the spec doesn't FR it. **Action**: add implicit FR for status history visibility — covered under FR-3 ("full timeline"). No change needed.

### F4 — UUID v7 generation

Plan §A5 mentions the `uuid` npm package. The capture-service doesn't use UUID v7 (it uses prefixed ULIDs). **Decision**: for consistency, use the same ULID-based ID format as capture-service. Update plan §A5: `iss_<ULID>` instead of UUID v7.

## Status

All findings resolved or documented. Ready for /speckit.tasks.

