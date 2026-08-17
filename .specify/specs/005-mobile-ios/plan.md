# Implementation Plan — Mobile iOS

**Feature ID:** 005-mobile-ios
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Tech Stack

Same as Phase 1 + 2 + 3 + 4. No new server-side dependencies. (The iOS app itself is Swift/Objective-C and out-of-scope for this Phase 5 server work.)

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Node.js 22 + tsx (tests) + esbuild
- Fastify 5 (HTTP), `@sthyra-crm/observability`
- Postgres 16 / InMemory
- pnpm workspaces — new package `services/mobile-bff-service/` (Backend-For-Frontend for the iOS app)

## Architecture (mirrors prior services)

```
services/mobile-bff-service/
├── src/
│ ├── types.ts                 — MobileSession, MobileChunk, MobileDeviceToken, etc.
│ ├── repository.ts            — MobileRepository contract
│ ├── repo-memory.ts           — InMemoryMobileRepository (Phase 5 MVP)
│ ├── postgres-repo.ts         — PostgresMobileRepository (Phase 5.b)
│ ├── service.ts                — MobileSessionService
│ ├── http.ts                   — Fastify HTTP layer (8 routes)
│ ├── jwt.ts                    — Mobile JWT verify (Phase 5.b can swap to OAuth)
│ ├── pagination.ts             — HMAC-signed cursor (Phase 2/3/4 pattern)
│ ├── cli.ts                    — startInMemoryServer
│ ├── cli-e2e.test.ts           — 4 E2E tests via fetch
│ └── *.test.ts                 — per-module tests
├── package.json
├── tsconfig.json
├── Dockerfile
└── migrations/
 └── 001-init.sql               — mobile_sessions + mobile_chunks + mobile_devices
```

## Architecture decisions

### A1 — MobileBffRepository contract

```typescript
export interface MobileRepository {
 insertSession(session: MobileSession): Promise<void>;
 findSession(orgId: string, id: string): Promise<MobileSession | null>;
 insertChunk(chunk: MobileChunk): Promise<void>;
 findChunks(orgId: string, sessionId: string): Promise<readonly MobileChunk[]>;
 insertDeviceToken(token: MobileDeviceToken): Promise<void>;
 deleteDeviceToken(orgId: string, deviceId: string): Promise<void>;
 findDeviceToken(orgId: string, deviceId: string): Promise<MobileDeviceToken | null>;
 nextId(): number;
}
```

### A2 — Mobile JWT (Q1)

Pure HMAC-SHA256 signed JWT. Header: `{ alg: 'HS256', typ: 'JWT' }`. Payload: `{ orgId, userId, deviceId, exp, iat }`. Signature: HMAC of `<header>.<payload>`.

### A3 — Chunk storage

For Phase 5 MVP: store chunks in Postgres BYTEA column. Phase 5.b migrates to S3 (reuse capture-service's BlobStorage pattern).

### A4 — Idempotent chunk upload (FR-2)

Chunk key: `(sessionId, chunkIndex)`. On duplicate upload:
- Same chunk data → return same chunkId (200)
- Different chunk data → 409 conflict
- Out-of-order → accepted (Q6)

### A5 — Chunk size validation (NFR-8)

- Per-chunk max: 32MB (Q2)
- Session max: 8GB (Q3)
- Server returns 413 + Retry-After header on overflow

### A6 — Push notification registration (FR-8)

Phase 5 ships registration endpoint only. APNs sending is Phase 5.b. `MobileDeviceToken` table stores `(orgId, userId, deviceId, apnsToken, registeredAt)`.

### A7 — Schema

```sql
CREATE TABLE mobile_sessions (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 project_id TEXT NOT NULL,
 capture_id TEXT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('walkthrough_360','preconstruction','postconstruction','incident')),
 client_session_id TEXT NULL,
 status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording','uploading','processing','ready','failed','archived')),
 total_size_bytes BIGINT NOT NULL DEFAULT 0,
 sha256_root TEXT NULL,
 actual_chunk_count INTEGER NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX mobile_sessions_org_client_uq ON mobile_sessions (org_id, client_session_id) WHERE client_session_id IS NOT NULL;
CREATE INDEX mobile_sessions_org_capture_idx ON mobile_sessions (org_id, capture_id);

CREATE TABLE mobile_chunks (
 id BIGSERIAL PRIMARY KEY,
 session_id TEXT NOT NULL,
 chunk_index INTEGER NOT NULL,
 sha256 TEXT NOT NULL,
 size_bytes BIGINT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (session_id, chunk_index)
);

CREATE TABLE mobile_devices (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 device_id TEXT NOT NULL,
 apns_token TEXT NOT NULL,
 registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (org_id, device_id)
);
```

### A8 — Routes (8 total)

```
POST   /v1/mobile/sessions                                  (FR-1)
POST   /v1/mobile/sessions/:id/chunks/:n                   (FR-2)
POST   /v1/mobile/sessions/:id/finalize                    (FR-3)
GET    /v1/mobile/captures/:captureId                       (FR-4)
POST   /v1/mobile/issues                                   (FR-5)
POST   /v1/mobile/copilot                                  (FR-6)
POST   /v1/mobile/devices                                  (FR-8)
DELETE /v1/mobile/devices/:deviceId                        (FR-8)
+ GET   /v1/health
```

