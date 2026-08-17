# Clarifications — Android

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — Share or duplicate BFF?

**Decision:** Extend Phase 5 mobile-bff-service. Add `pushChannel` discriminator to the device-token registration.

**Rationale:** Constitution §VII — no re-decision of established patterns. The 8 mobile endpoints are identical between iOS and Android. Adding 2 fields to the device token schema is much cheaper than duplicating the whole BFF.

**Impact:** `MobileDeviceToken` schema migration: add `pushChannel: 'apns' | 'fcm'` column. Mobile-device registration accepts either format.

## Q2 — JWT secret reuse?

**Decision:** Same `MOBILE_JWT_SECRET` for iOS and Android.

**Rationale:** Both clients are mobile workers in the same org. They share the same auth model.

**Impact:** No change to JWT module. Phase 5's `signJwt` / `verifyJwt` are reused.

## Q3 — i18n source?

**Decision:** JSON files in the BFF repo (`src/i18n/{locale}.json`). Phase 6.b can move to external service.

**Rationale:** Self-contained. Easy to maintain. Phase 6 MVP ships English (en-US) + German (de-DE) as the first two.

**Impact:** `src/i18n/en-US.json`, `src/i18n/de-DE.json`. `formatError(code, locale)` returns localized string.

## Q4 — FCM token encryption at rest?

**Decision:** Phase 6 MVP stores plaintext. Phase 6.b adds AES-256-GCM with KMS-managed key.

**Rationale:** FCM tokens are not secrets per se (they can be rotated), but production-grade privacy is required long-term. Phase 6 MVP gets the BFF surface right; encryption is a follow-up.

**Impact:** Schema unchanged in MVP. Phase 6.b migration wraps the field.

## Q5 — Locale fallback?

**Decision:** English (en-US) is the default. 406 only if `Accept-Language: xx-YY` is explicit AND `xx-YY` not in the supported list.

**Rationale:** Most lenient default — don't break clients that don't send Accept-Language. Only reject when the client specifically asks for something we don't have.

**Impact:** `if (locale && !supportedLocales.includes(locale)) → 406; else fall back to en-US`.

## Q6 — Phase 5 backward compat?

**Decision:** No migration needed. Existing APNs tokens are read with `pushChannel = 'apns'` as default.

**Rationale:** Add a default value to the schema column. Old rows are implicitly APNs.

**Impact:** `pushChannel` defaults to `'apns'` in reads. New registrations can pass `'fcm'`.

## Q7 — Tablet-specific features?

**Decision:** Same BFF APIs for phone and tablet. Tablet differs only in client-side layout (Material 3 window size class).

**Rationale:** Backend shouldn't care about screen size.

**Impact:** No new BFF APIs. Phase 6.c (native Android) implements the responsive layout.

