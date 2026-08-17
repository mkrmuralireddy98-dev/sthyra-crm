# Clarifications — Integrations

**Date:** 2026-08-17
**Source:** `spec.md` §7 (7 open questions)

## Q1 — New service or extend field-service?

**Decision:** NEW integration-service. Per spec §1 justification.

**Rationale:** External adapters are distinct from internal CRUD.

**Impact:** New microservice on port 9098.

## Q2 — Real connectors or stubs?

**Decision:** Stubs in MVP. Real Procore/BIM360 API calls in Phase 11.b.

**Rationale:** MVP scope discipline. Real APIs need OAuth + credentials.

**Impact:** `StubProcoreConnector` etc. return canned data based on inputs.

## Q3 — Sync history limit?

**Decision:** 100 syncs per integration (oldest evicted).

**Rationale:** Bounded growth (same pattern as workflow runs).

**Impact:** `repo.insertSync` evicts when count > 100.

## Q4 — Webhook auth?

**Decision:** Header token in MVP (Phase 11.b HMAC).

**Rationale:** Simpler. HMAC requires server-side secret; out of MVP scope.

**Impact:** `x-webhook-token` header compared to integration's stored token.

## Q5 — Provider count?

**Decision:** 4 providers (procore, bim360, plangrid, webhook).

**Rationale:** Covers typical PM toolset.

**Impact:** Union type. Phase 11.b can add more.

## Q6 — Field mapping defaults?

**Decision:** Automatic (default field names).

**Rationale:** Standard field names match Procore/BIM360.

**Impact:** `mapProcoreRFI(rfi)` returns `Issue` shape with defaults.

## Q7 — Cross-tenant data leak protection?

**Decision:** Yes, redact sensitive config in API responses.

**Rationale:** NFR-5.

**Impact:** `redactIntegration(integration)` strips `apiKey`, `oauthToken` from API outputs.

