# Tasks — Android

**Feature ID:** 006-android
**Date:** 2026-08-17

## Slice 1 — Push channel (T-001 to T-003)

T-001 Extend MobileDeviceToken with pushChannel
T-002 Update POST /v1/mobile/devices to accept pushChannel
T-003 Repository persists pushChannel (backward-compat: apns default)

## Slice 2 — i18n (T-004 to T-006)

T-004 src/i18n.ts module + parseAcceptLanguage + formatError
T-005 src/i18n/en-US.json + de-DE.json catalogs
T-006 HTTP layer Accept-Language header parsing + 406 path

## Slice 3 — Tests (T-007 to T-010)

T-007 i18n unit tests (6+)
T-008 pushChannel discriminator tests
T-009 Android compat tests (iOS + Android coexist)
T-010 Phase 5 regression: all 57 prior mobile-bff tests still pass

## Slice 4 — Migration + integration (T-011 to T-012)

T-011 migrations/002-push-channel.sql (Postgres)
T-012 docker-compose integration: same container, new SQL mount

## Status — pending /speckit.implement

## Status — Phase 6 complete (2026-08-17)

All 4 slices shipped. 82 mobile-bff-service tests passing (was 62).

### Slices

- ✅ Slice 1 Push channel (pushChannel + fcmAppId)
- ✅ Slice 2 i18n (en-US + de-DE catalogs)
- ✅ Slice 3 Tests (i18n + android-compat)
- ✅ Slice 4 Migration + integration

### Numbers

- mobile-bff-service: 82 tests
- capture-service: 276 tests
- field-service: 130 tests
- bim-viewer-service: 83 tests
- ai-copilot-service: 74 tests
- Whole project: 759 tests
- 67 commits on main
