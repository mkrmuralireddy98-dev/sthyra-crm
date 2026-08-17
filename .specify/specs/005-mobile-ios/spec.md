# Feature Specification — Mobile iOS

**Feature ID:** 005-mobile-ios
**Phase:** 5 (fifth feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Source schemas consumed:**
- `services/capture-service/` — capture lifecycle
- `services/field-service/` — issue creation + status
- `services/ai-copilot-service/` — natural-language queries

---

## 1. Summary

The **Mobile iOS** app is the field crew's primary capture surface. iPhone + iPad, native UIKit + SwiftUI, 360° capture via AVFoundation, LiDAR-assisted depth (iPhone Pro / iPad Pro). It writes to capture-service, raises field issues via field-service, and queries AI Copilot — all from the device.

**Why now:** Phase 1 + 2 + 4 give the field crew a working backend. Without mobile, the entire product is desktop-only. Phase 5 brings the product to where the work happens — the field.

---

## 2. Functional Requirements (FRs)

### FR-1 — Capture session
**As** a field crew member
**I want** to start a 360° capture session
**So that** my walkthrough is recorded as a single multi-chunk capture.

- `POST /v1/mobile/sessions` (mobile-only endpoint, scoped to the device's user)
- Body: `{ projectId, kind: 'walkthrough_360' | 'preconstruction' | 'postconstruction' | 'incident' }`
- Returns: `{ sessionId, captureId, kind, startedAt, deviceMeta }`
- Headers: `Authorization: Bearer <jwt>`, `Idempotency-Key`
- 201 first / 200 on replay / 409 on duplicate

### FR-2 — Chunk upload
**As** the mobile app
**I want** to upload each chunk as it's recorded
**So that** I don't lose data if the network drops mid-capture.

- `POST /v1/mobile/sessions/:sessionId/chunks/:n` (mobile-only)
- Multipart upload (binary chunk data + JSON metadata)
- Returns: `{ chunkId, n, sha256, sizeBytes, receivedAt }`
- 201 on accept / 409 if n out of range / 413 if chunk too big

### FR-3 — Finalize session
**As** the mobile app
**I want** to mark the capture as complete
**So that** the server starts processing.

- `POST /v1/mobile/sessions/:sessionId/finalize`
- Body: `{ actualChunkCount, totalSizeBytes, sha256Root }`
- Returns: `{ captureId, status: 'processing', estimatedReadyAt }`
- 200 on success / 409 if chunk count mismatches

### FR-4 — Live status polling
**As** the mobile UI
**I want** to poll the capture status
**So that** I can show progress as it moves through decode → sfm → mesh → segment → align.

- `GET /v1/mobile/captures/:captureId`
- Returns: `{ status, pipelineStage, progress: 0..100, error?: string, completedAt?: ISO }`
- 404 on unknown / 200 with state

### FR-5 — Raise an issue from the camera
**As** the field crew
**I want** to tap a point in the capture and raise an issue
**So that** the issue is tied to the 3D point I was looking at.

- `POST /v1/mobile/issues`
- Body: `{ captureId, title, description, severity, coordinates: {x,y,z} }`
- Returns: `{ issueId, status: 'open', clientIssueId }`
- 201 first / 409 on duplicate client_issue_id

### FR-6 — AI Copilot on the device
**As** the field crew
**I want** to ask a question from the device
**So that** I don't have to wait until I'm at a desk.

- `POST /v1/mobile/copilot` (mobile-shorthand for `conversations//messages`)
- Same body as Phase 4 FR-1
- Returns: `{ replyText, intent, toolCalls, latencyMs }`
- Latency budget: p95 < 2s (mobile clients are impatient)

### FR-7 — Offline-first
**As** the field crew
**I want** to capture even with no network
**So that** connectivity gaps don't block work.

- Client queues chunks locally (SQLite on device)
- On reconnect: uploads queued chunks in order
- Server accepts out-of-order chunks (FR-2 doesn't require sequential numbers)
- 410 Gone if capture session was archived server-side

### FR-8 — Push notification on capture ready
**As** the field crew
**I want** to be notified when a capture is ready
**So that** I can pull up the BIM viewer / point cloud immediately.

- APNs device token registration: `POST /v1/mobile/devices`
- Server publishes `capture.ready` SSE event → APNs bridge (Phase 4.b)
- Mobile receives push notification, deep-links to capture view

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every mobile endpoint enforces `x-tenant-id` from JWT claims. Cross-tenant device tokens return 404.

### NFR-2 — Authorization (mobile JWT)
Mobile endpoints require `Authorization: Bearer <jwt>` header. JWT carries `{ orgId, userId, deviceId }`. The server validates signature + expiry. **Default JWT secret = mobile-jwt-secret-32b (rotated quarterly).**

### NFR-3 — Offline-first resilience
Server accepts chunks even if client is offline. Each chunk has a SHA256 hash; server verifies + dedups. Re-uploading same chunk returns 200 with same `chunkId`.

### NFR-4 — RFC 7807 errors
All mobile endpoints return `application/problem+json` with 6-field shape (same as capture/field/bim/copilot).

### NFR-5 — Observability
- `x-request-id` on every response
- Structured logs at every chunk upload + finalize
- `/v1/metrics` exposes: `mobile_sessions_total{kind}`, `mobile_chunks_total{outcome}`, `mobile_issues_total{severity}`, `mobile_copilot_latency_ms_bucket`

### NFR-6 — Push notification channels
APNs tokens stored per (orgId, userId, deviceId). Token rotation supported (DELETE old, POST new). Phase 5 ships the registration endpoint; APNs sending is Phase 5.b.

### NFR-7 — Idempotency
All POST endpoints honor `x-idempotency-key`. Replay returns 200 with original body. New attempt with different params returns 409.

### NFR-8 — File size limits
Per-chunk max size: 64MB (configurable). Reject larger with 413. Session max size: 8GB. Server returns 413 + cleanup hint if exceeded.

---

## 4. User scenarios

### Scenario A — On-site walk-through
1. Crew member opens app, picks project, taps "Start Capture"
2. App POSTs `POST /v1/mobile/sessions` → captureId + sessionId
3. App records 360° video, splitting into 5-second chunks
4. After each chunk: `POST /v1/mobile/sessions/:id/chunks/:n` (multipart upload)
5. Server processes chunks in background (capture pipeline)
6. Crew member taps "Stop" → `POST /v1/mobile/sessions/:id/finalize`
7. App polls `GET /v1/mobile/captures/:id` until status='ready'
8. When ready, app deep-links to the 3D viewer

### Scenario B — Raise issue from capture
1. After a capture finishes, crew member opens it
2. Taps on a point in the 360° preview
3. App POSTs `POST /v1/mobile/issues` with coordinates tied to that point
4. Issue is created in field-service, status='open'
5. Server returns issueId; app navigates to the issue detail

### Scenario C — AI Copilot on device
1. Crew member taps the AI icon
2. Speaks or types "what's blocking the east wing?"
3. App POSTs `POST /v1/mobile/copilot`
4. Server classifies intent (Phase 4 pattern), routes to capture/field/bim
5. App receives reply, displays text + a list of relevant issues/captures/elements
6. Crew member taps an issue → navigates to that issue

### Scenario D — Offline capture
1. Crew member loses connectivity mid-capture
2. App keeps recording, queues chunks in local SQLite
3. Reconnects → app uploads queued chunks
4. Server accepts (chunks are SHA256-tagged + idempotent)
5. Finalize + poll work as usual

---

## 5. Out of scope (for this Phase 5 MVP)

- **Android app** — Phase 6 (separate, but the spec mirrors this one)
- **APNs sending** — Phase 5.b. Phase 5 ships the token registration endpoint only.
- **Real-time LiDAR depth** — Phase 5.b. Phase 5 captures standard RGB video + uses approximate depth from phone movement.
- **3D rendering on device** — Phase 5.b. Phase 5 sends captures to server, displays thumbnails.
- **Background sync policy** — Phase 5.b. Phase 5 queues chunks in SQLite but doesn't optimize retry.

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **Auth model** — JWT signed with shared secret, or OAuth? **Default: shared-secret JWT (Phase 5.b migrates to OAuth).**
2. **Chunk size default** — 5MB? 64MB? **Default: 32MB chunks.**
3. **Max session size** — 2GB? 8GB? **Default: 8GB.**
4. **APNs vs FCM in Phase 5** — APNs only (iOS app)? Or both? **Default: APNs only for Phase 5; Android + FCM is Phase 6.**
5. **Mobile-scope vs regular endpoints** — dedicated `/v1/mobile/*` namespace, or share with `/v1/*`? **Default: dedicated namespace (clearer mobile contract).**
6. **Chunk ordering** — strict or permissive? **Default: permissive (out-of-order accepted) for offline-first.**
7. **Background capture** — when app is backgrounded, can it keep recording? **Default: yes (iOS allows it with Background Modes capability).**

