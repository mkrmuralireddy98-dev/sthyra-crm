# Analysis — Mobile iOS

**Feature ID:** 005-mobile-ios
**Date:** 2026-08-17

## Cross-artifact consistency check

| Check | Status |
|---|---|
| FR-1 to FR-8 map to plan routes | ✅ A8 |
| Q1 → JWT shared secret | ✅ A2 |
| Q2 → 32MB chunks | ✅ A5 |
| Q3 → 8GB session | ✅ A5 |
| Q4 → APNs only | ✅ A6 |
| Q5 → /v1/mobile/* namespace | ✅ |
| Q6 → permissive chunk ordering | ✅ A4 |
| NFR-1 tenant isolation | ✅ JWT claim |
| NFR-2 JWT auth | ✅ A2 |
| NFR-3 idempotent chunks | ✅ A4 |
| NFR-4 RFC 7807 errors | ✅ http layer |
| Constitution §VII no re-decision | ✅ reuses pagination + SSE patterns |

## Findings

### F1 — Mobile-iOS native app is out of scope

Spec §5 explicitly excludes the Swift/UIKit code. Phase 5 ships the BFF endpoints only. The native iOS app would be a separate project (Phase 5.c).

### F2 — Capture-service integration

When mobile uploads a finalized session, the BFF should call capture-service to actually create the capture + trigger processing. Phase 5 MVP keeps this stub (just records the session); Phase 5.b wires the call.

### F3 — Offline-first requires server-side out-of-order support

Q6's permissive ordering means the server tracks chunks by (sessionId, chunkIndex). At finalize time, the server checks all expected chunks are present before declaring "uploading complete".

