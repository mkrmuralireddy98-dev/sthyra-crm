# Clarifications — Mobile iOS

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — Auth model?

**Decision:** Shared-secret JWT for Phase 5 MVP. OAuth in Phase 5.b.

**Rationale:** Same pattern as the rest of the platform. Mobile client gets a long-lived JWT signed with `MOBILE_JWT_SECRET`. Server validates signature + claims. Phase 5.b can layer OAuth on top without breaking existing clients.

**Impact:** `Authorization: Bearer <jwt>` header. JWT payload: `{ orgId, userId, deviceId, exp }`. Server middleware verifies + extracts claims.

## Q2 — Chunk size default?

**Decision:** 32MB chunks.

**Rationale:** iOS captures at ~10MB/sec for a 360° 4K stream. 32MB = ~3 seconds of recording per chunk. Balances retry granularity against request overhead.

**Impact:** Server rejects chunks > 32MB with 413. Client chunks at 32MB.

## Q3 — Max session size?

**Decision:** 8GB.

**Rationale:** Largest iOS Pro session we want to support is ~2 hours of 360° capture. 8GB is comfortable headroom (4K 360° ≈ 4GB/hour).

**Impact:** Server tracks total session size; rejects with 413 + cleanup hint if exceeded.

## Q4 — APNs vs FCM?

**Decision:** APNs only for Phase 5 (iOS app). Android + FCM is Phase 6.

**Rationale:** One notification channel per phase keeps the spec focused.

**Impact:** iOS app registers APNs tokens. Server stores them for Phase 5.b to actually send.

## Q5 — Mobile-scope vs shared endpoints?

**Decision:** Dedicated `/v1/mobile/*` namespace.

**Rationale:** Mobile contract differs from server-to-server contract (multipart upload, JWT auth, APNs tokens). Dedicated namespace makes the mobile API clear.

**Impact:** Routes: `/v1/mobile/sessions`, `/v1/mobile/issues`, `/v1/mobile/copilot`, `/v1/mobile/devices`. All other services (capture/field/bim/copilot) keep their `/v1/*` endpoints.

## Q6 — Chunk ordering?

**Decision:** Permissive. Server accepts out-of-order chunks.

**Rationale:** Offline-first (FR-7) means chunks can arrive in any order. Server uses (sessionId, chunk index) as the unique key + SHA256 for dedup.

**Impact:** Server accepts chunk N=5 even if N=4 hasn't arrived yet. `finalize` is the only call that requires all chunks present.

## Q7 — Background capture?

**Decision:** Yes, app can keep recording when backgrounded.

**Rationale:** iOS supports this with the Background Modes capability (audio recording + processing). Crew can lock the phone and keep walking.

**Impact:** Mobile app declares `audio` Background Mode capability. Server-side: no change (chunks just keep arriving).

