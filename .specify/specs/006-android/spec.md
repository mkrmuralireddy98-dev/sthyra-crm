# Feature Specification — Android

**Feature ID:** 006-android
**Phase:** 6 (sixth feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Source schemas consumed:**
- `services/mobile-bff-service/` (Phase 5 — extends it)
- `services/capture-service/`, `services/field-service/`, `services/ai-copilot-service/`

---

## 1. Summary

The **Android** mobile client is functionally a sibling of iOS — it writes captures, raises issues, queries Copilot — but uses **Material Design 3** instead of Cupertino, **FCM** (Firebase Cloud Messaging) instead of APNs, and a few Android-specific nuances (notification channels, scoped storage, WorkManager for background uploads).

**Why now:** Phase 5 ships iOS. ~70% of field crews use Android. Phase 6 closes the gap so the full crew — iPhone or Samsung — has parity.

---

## 2. Functional Requirements (FRs)

Phase 6 reuses Phase 5's 8 mobile endpoints via the same `mobile-bff-service`. The Android BFF is a **thin sibling service** that adds:

### FR-1 — Push channel routing
**As** the Android app
**I want** to register a FCM device token
**So that** the server pushes notifications to FCM (not APNs).

- `POST /v1/mobile/devices` (Android variant)
- Body: `{ pushToken: string, pushChannel: 'fcm', fcmAppId?: string }`
- Returns: `{ deviceId, registeredAt }`
- Server stores the token + channel type
- 201 first / 409 on duplicate (same logic as iOS)

### FR-2 — Locale-aware error messages
**As** an Android user
**I want** error messages in my locale (en-US, de-DE, ja-JP, etc.)
**So that** I understand them.

- All mobile endpoints accept `Accept-Language: <locale>` header
- Server looks up message in i18n table (Phase 6.b — Phase 6 ships the contract)
- 406 Not Acceptable if locale not supported
- RFC 7807's `detail` is localized

### FR-3 — WorkManager push (Android-specific scheduling)
**As** the Android client
**I want** to schedule chunk uploads via WorkManager
**So that** uploads survive app backgrounding.

- Client-side only; no server changes
- Server accepts chunks at any time (per Phase 5's offline-first design)
- Documented in the BFF README

### FR-4 — Background upload verification
**As** the server
**I want** to verify WorkManager-driven uploads are atomic
**So that** partial uploads don't corrupt.

- Same Idempotency-Key on each chunk (per Phase 5 NFR-3)
- Server accepts same chunk twice → returns same chunkId
- Cross-tenant probe still rejected

### FR-5 — Android Material Design wireframes
**As** a designer / field crew member
**I want** Material Design 3 components in the Android UI
**So that** it feels native.

- This is a client-side concern (out of scope for BFF)
- Spec captures the wireframe intent: bottom nav (Capture / Issues / Copilot / Devices), Material FAB for new capture, Material color theme aligned with `@sthyra-crm/tokens`
- Native Android BFF doesn't render UI — that's the Android team's job (Phase 6.c)

### FR-6 — Server-side push priority
**As** the server
**I want** to push notifications with priority metadata
**So that** Android can show high-priority push when appropriate.

- Server pushes include `priority: 'high' | 'normal'`
- Phase 6 MVP: all pushes are normal
- Phase 6.b: configurable priority per event type (e.g., `capture.failed` → high; `capture.ready` → normal)

### FR-7 — Tablet-optimized layout
**As** an Android tablet user (Galaxy Tab, Pixel Tablet)
**I want** a multi-pane layout
**So that** I see issues + capture + copilot side-by-side.

- Client-side concern (Material 3 responsive layout)
- BFF does NOT deliver different APIs for tablets — same endpoints, same per-resource access

### FR-8 — Scope storage compliance (Android 11+)
**As** the Android app
**I want** to comply with Android 11+ scoped storage
**So that** chunks upload correctly.

- Client-side concern (uses `MediaStore` API on Android 11+)
- BFF doesn't change — accepts multipart chunks regardless of source

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Same as Phase 5: every endpoint enforces `orgId` from JWT claims. Cross-tenant → 404.

### NFR-2 — JWT auth (HS256, shared with iOS)
Phase 6 ships the same JWT as Phase 5. Android client gets a JWT signed with `MOBILE_JWT_SECRET` (same secret as iOS clients). Keeps the BFF contract simpler.

### NFR-3 — FCM token storage
`MobileDeviceToken` table adds `pushChannel: 'apns' | 'fcm'` column (Phase 6 migration). Existing APNs tokens keep working.

### NFR-4 — RFC 7807 errors
All endpoints return `application/problem+json` with 6-field shape. `detail` is localized per FR-2.

### NFR-5 — Observability
Same as Phase 5: `x-request-id` on every response, structured logs, `/v1/metrics`.

### NFR-6 — Push channel=apns backward compat
Existing iOS devices keep their APNs tokens working. New code uses generic `pushToken` + `pushChannel` discriminator. Migration script (Phase 6.b).

---

## 4. User scenarios

### Scenario A — Android field crew installs app
1. Field member installs APK, signs in via SSO (Phase 6.b — out of scope for this Phase 6 spec)
2. App gets JWT signed with `MOBILE_JWT_SECRET`
3. App POSTs `POST /v1/mobile/devices` with `{ pushToken: <fcm-token>, pushChannel: 'fcm' }`
4. Server stores; FCM bridge (Phase 6.b) registered for this device
5. Crew member starts a capture

### Scenario B — Material Design gestures
1. Crew opens app → Material Design bottom nav (Capture / Issues / Copilot / Devices)
2. Taps FAB → starts capture session (`POST /v1/mobile/sessions`)
3. App records 360°, WorkManager chunks in background
4. App finalizes via WorkManager constraints (WiFi only or unmetered)

### Scenario C — Tablet split view
1. Crew opens app on Galaxy Tab
2. Material 3 responsive layout shows issues list + capture detail side-by-side
3. BFF serves same APIs — client uses window size class to decide layout (no BFF changes)

### Scenario D — Localized error
1. Crew member in Berlin triggers a 413 (chunk too large)
2. Server returns RFC 7807 with `Accept-Language: de-DE` header
3. `detail` field: "Chunk zu groß: 33 MB > 32 MB"
4. App shows German error in snackbar

---

## 5. Out of scope (for this Phase 6 MVP)

- **Native Android UI code** — that's Phase 6.c (Kotlin + Jetpack Compose)
- **FCM push sending** — Phase 6.b. Phase 6 ships token registration only.
- **Material Design 3 wireframes** — out of BFF scope (FR-5 is documentation only)
- **SSO integration** — Phase 6.c (client + auth-service)
- **WorkManager setup** — client-side

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **Share or duplicate BFF?** — extend Phase 5 mobile-bff-service or new mobile-android-bff-service? **Default: extend Phase 5; add pushChannel discriminator.**
2. **JWT secret reuse?** — same secret as iOS or different? **Default: same secret (one mobile BFF, one secret).**
3. **i18n source?** — JSON files in repo, or external service? **Default: JSON files in repo (Phase 6.b can move to external service).**
4. **FCM token encryption at rest?** — encrypt before storing? **Default: yes, AES-256-GCM with key from KMS (Phase 6.b). Phase 6 MVP stores plaintext.**
5. **Locale fallback** — when Accept-Language is missing or unsupported? **Default: English (en-US). 406 only if explicit locale requested and not supported.**
6. **Phase 5 backward compat?** — when pushChannel column added, do existing iOS devices need migration? **Default: no — existing APNs tokens treated as pushChannel=apns at read time.**
7. **Tablet-specific features?** — different from phone, or just different layout? **Default: just different layout; same BFF APIs.**

