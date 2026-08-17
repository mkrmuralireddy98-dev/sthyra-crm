# Analysis — Android

**Feature ID:** 006-android
**Date:** 2026-08-17

## Cross-artifact consistency check

| Check | Status |
|---|---|
| Q1 → extend Phase 5 (not new service) | ✅ plan §A1 |
| Q2 → same JWT secret | ✅ no change to jwt.ts |
| Q3 → JSON files for i18n | ✅ plan §A2 |
| Q4 → plaintext Phase 6, encrypted Phase 6.b | ✅ deferred |
| Q5 → en-US default + 406 on explicit | ✅ plan §A3 |
| Q6 → apns default for backward compat | ✅ plan §A4 |
| Q7 → same BFF APIs, client-side layout | ✅ spec §FR-7 |
| FR-1 pushChannel accepted on POST /devices | ✅ plan §A1 |
| FR-2 Accept-Language header on all routes | ✅ plan §A3 |
| FR-3-FR-8 client-side concerns (out of BFF scope) | ✅ documented |
| NFR-1 tenant isolation | ✅ unchanged |
| NFR-6 backward compat | ✅ plan §A4 |

## Findings

### F1 — Repository migration is in-memory only for Phase 6 MVP

The Phase 5 InMemoryMobileRepository doesn't have a pushChannel field. Phase 6 adds it. Phase 6.b writes a real Postgres migration (`migrations/002-push-channel.sql`).

### F2 — Native Android code is out of scope

Phase 6.c (Kotlin + Jetpack Compose) ships the actual Android app. Phase 6 ships only the BFF additions.

### F3 — i18n scope is small (2 locales)

Phase 6 ships en-US + de-DE. Phase 6.b can add more locales (ja-JP, es-ES, etc.).

