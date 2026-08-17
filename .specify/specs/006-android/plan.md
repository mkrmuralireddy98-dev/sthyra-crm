# Implementation Plan — Android

**Feature ID:** 006-android
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Architecture Decision — REUSE Phase 5 BFF

**Per Q1:** extend `services/mobile-bff-service/` (Phase 5) instead of creating a new service.

**Rationale:** Constitution §VII — no re-decision. 8 mobile endpoints are identical between iOS and Android. The Android-specific surface is a `pushChannel` discriminator + i18n.

**What gets added to mobile-bff-service:**
1. `pushChannel: 'apns' | 'fcm'` field on `MobileDeviceToken`
2. `POST /v1/mobile/devices` accepts `{ pushToken, pushChannel, fcmAppId? }`
3. `src/i18n/` module + `formatError(code, locale)`
4. `Accept-Language` header parsing in HTTP layer
5. 406 response when explicit locale not supported
6. Migration test: existing iOS devices continue to work (backward compat)

## File paths (additions only)

```
services/mobile-bff-service/
├── src/
│ ├── types.ts                 ← + pushChannel field, + Locale type
│ ├── repository.ts            ← + pushChannel column handling
│ ├── i18n.ts                  ← NEW: formatError + supported locales
│ ├── i18n.test.ts             ← NEW: 6+ tests
│ ├── i18n/
│ │ ├── en-US.json             ← NEW: error message catalog (en-US)
│ │ └── de-DE.json             ← NEW: error message catalog (de-DE)
│ └── http.ts                  ← + Accept-Language parsing, + 406 path
├── migrations/
│ └── 002-push-channel.sql     ← NEW: ALTER TABLE add push_channel column
└── tests/
 └── android-compat.test.ts    ← NEW: 4+ tests verifying iOS + Android
                                  share same BFF + pushChannel works
```

## Architecture decisions

### A1 — pushChannel schema change

```sql
-- migrations/002-push-channel.sql
ALTER TABLE mobile_devices
 ADD COLUMN push_channel TEXT NOT NULL DEFAULT 'apns'
 CHECK (push_channel IN ('apns', 'fcm'));

-- Existing rows: implicit apns
```

Phase 6 MVP: schema is in-memory (Phase 5 InMemoryMobileRepository) — extend the class to track pushChannel. Phase 6.b: real Postgres migration.

### A2 — i18n module

```typescript
// src/i18n.ts
export type SupportedLocale = 'en-US' | 'de-DE';
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en-US', 'de-DE'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export function parseAcceptLanguage(header: string | undefined): SupportedLocale {
 // parses "en-US,en;q=0.9,de;q=0.8" → "en-US"
}

export function formatError(code: string, locale: SupportedLocale): string {
 // reads from src/i18n/{locale}.json
}
```

### A3 — HTTP layer changes

- All mobile endpoints accept `Accept-Language` header
- `406 Not Acceptable` if explicit locale is not in `SUPPORTED_LOCALES`
- Default to `en-US` if missing
- Error responses use `formatError(code, locale)` for the `detail` field

### A4 — Backward compat (Q6)

- `MobileDeviceToken.pushChannel` defaults to `'apns'`
- Existing tests with `apnsToken` field still pass
- New tests with `pushToken` + `pushChannel: 'fcm'` also pass

### A5 — Android-specific test suite

```
android-compat.test.ts:
- iOS-style register (pushChannel=apns) still works
- Android-style register (pushChannel=fcm) works
- FindDeviceToken returns correct pushChannel
- Cross-platform register with same deviceId overwrites
- Accept-Language: de-DE returns German errors
- Accept-Language: xx-YY (unsupported) → 406
- Accept-Language missing → defaults to en-US
```

## Test coverage targets

- [ ] 6+ i18n tests
- [ ] 4+ android-compat tests
- [ ] 2+ i18n JSON validity tests
- [ ] 4+ pushChannel discriminator tests

