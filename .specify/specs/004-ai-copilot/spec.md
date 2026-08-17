# Feature Specification — AI Copilot

**Feature ID:** 004-ai-copilot
**Phase:** 4 (fourth feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Source schemas consumed:**
- `services/capture-service/` — capture status, point clouds
- `services/field-service/` — issues, comments, status history
- `services/bim-viewer-service/` — BIM models, element lookup, deviations
- `packages/tokens/` — design palette

---

## 1. Summary

The **AI Copilot** is the conversational interface that ties captures, issues, and BIM into one queryable layer. Field crews and PMs ask natural-language questions like *"What's blocking Level 3 walk-through?"* or *"List every critical issue from the last 30 days"* and get grounded answers pulled from the existing services.

**Why now:** Phase 1 + 2 + 3 give us the data plane (captures, issues, BIM). Without AI Copilot, the user has to know which API to query. The AI Copilot turns that into "just ask" — the product moment for everyone who isn't a power user.

---

## 2. Functional Requirements (FRs)

### FR-1 — Submit a query
**As** a field crew member or PM
**I want** to ask a natural-language question
**So that** I get a grounded answer from the platform data.

- `POST /v1/conversations/:conversationId/messages`
- Body: `{ messageId: string, text: string, attachments?: [{ type: 'capture' | 'issue' | 'bim', id: string }] }`
- Returns: `{ replyMessageId: string, intent: QueryIntent, toolCalls: [...], text: string }`
- Headers: `x-tenant-id`, `x-idempotency-key`
- 201 first / 200 on replay / 400 invalid input

### FR-2 — Get conversation history
**As** a user
**I want** to see the full history of my conversation
**So that** I can scroll back through prior questions and answers.

- `GET /v1/conversations/:conversationId`
- Returns: `{ id, title, createdAt, messages: [...] }`
- 200 with message list, 404 on unknown conversation
- Cross-tenant probe → 404

### FR-3 — List conversations
**As** a user
**I want** to list my conversations
**So that** I can pick up where I left off.

- `GET /v1/conversations`
- Returns: `{ data: [{ id, title, lastMessageAt, messageCount }] }`
- Paginated via HMAC cursor (NFR-7, same pattern as field-service)
- 200 with data array + nextCursor

### FR-4 — Intent classification
**As** the system
**I want** to classify each user message into an intent
**So that** the right tool is called.

Intents:
- `list_captures` — list captures with filters
- `list_issues` — list issues with filters
- `lookup_element` — BIM element lookup
- `summarize_project` — aggregate stats (issue counts, capture counts, deviations)
- `find_blockers` — what's preventing a project from progressing
- `clarify` — message is ambiguous, ask user to clarify

Returns `intent` and `slots` (extracted filter values).

### FR-5 — Tool calls
**As** the system
**I want** to call the right downstream service based on intent
**So that** the answer is grounded in real data.

Tool call format: `{ tool: 'capture.list' | 'issue.list' | 'bim.lookup_element' | ..., input: {...}, output: {...} }`
Each tool call has a deterministic boundary — no hallucination.

### FR-6 — Reply generation
**As** the system
**I want** to generate a reply from the tool call outputs
**So that** the user sees a natural-language answer.

Reply is composed from tool outputs (no LLM invented facts). When the data is incomplete, the reply says so.

### FR-7 — Streaming reply (SSE)
**As** a user
**I want** to see the reply stream in real-time
**So that** the UI feels responsive.

- `GET /v1/conversations/:conversationId/messages/:messageId/stream`
- Emits: `intent.detected`, `tool.call.start`, `tool.call.end`, `text.delta`, `message.complete`
- Each event carries conversationId + messageId for ordering
- Tenant-scoped at delivery

### FR-8 — Pin a message
**As** a user
**I want** to pin a message to a project
**So that** I can reference it later.

- `POST /v1/conversations/:conversationId/messages/:messageId/pin`
- Returns: `{ pinned: true, pinnedAt: ISO }`
- 200 on success, 404 on unknown message

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every query is scoped to the calling tenant. Cross-tenant conversations return 404. Tool calls include the tenant context.

### NFR-2 — Determinism
The intent classifier is a **pure function** of (text + slots + context). Same input → same intent. Tests are reproducible.

### NFR-3 — Idempotency
POST endpoints honor `x-idempotency-key` (Constitution §IV). Replay returns 200 with the original response.

### NFR-4 — RFC 7807 errors
All errors return `application/problem+json` with 6-field shape: `{ type, status, title, detail, trace_id, code }`.

### NFR-5 — Observability
- `x-request-id` on every response
- Structured logs at every intent classification + tool call
- `/v1/metrics` exposes: `copilot_queries_total{intent, outcome}`, `copilot_tool_calls_total{tool, outcome}`, `copilot_reply_duration_ms_bucket`

### NFR-6 — Pagination
Conversations list paginated via HMAC cursor (max 200/page, default 50).

### NFR-7 — Authorization
Reads (GET) — any authenticated org member. Writes (POST) — same as Phase 2/3: `project_member` role for submissions, `project_manager` for pins/deletes.

### NFR-8 — Privacy
AI Copilot does not send user prompts to external LLM services in Phase 4. The intent classifier is deterministic (regex + slot extraction). The reply composer assembles from tool outputs. **External LLM is Phase 5.**

---

## 4. User scenarios

### Scenario A — Issue listing
1. Field lead asks: *"Show all open high-severity issues"*
2. Intent classified as `list_issues` with slots `{ status: 'open', severity: 'high' }`
3. Tool call: `issue.list({ status: 'open', severity: 'high' })` → calls field-service HTTP
5. Reply: *"Found 7 open high-severity issues. The most recent is `iss_abc123` — Missing MEP detail at (1.5, 2.5, 0.5)."*

### Scenario B — Element lookup
1. PM asks: *"What element is at (1.5, 2.5, 0.5)?"*
2. Intent: `lookup_element` slots `{ x, y, z }`
3. Tool call: `bim.lookup_element` → bim-viewer-service
4. Reply: *"That point is inside element `beam_001` (Level 3 East Beam, IfcBeam). Distance from element edge: 0.03m."*

### Scenario C — Project summary
1. PM asks: *"How is Phase 3 going?"*
2. Intent: `summarize_project` slots `{ projectId: 'prj_1' }`
3. Tool calls (parallel): `capture.list`, `issue.list`, `bim.listDeviations`
4. Reply: *"Phase 3 has 4 captures (3 ready, 1 in progress), 23 issues (5 open, 14 resolved, 4 in_progress), and 12 BIM deviations (3 critical, 5 major, 4 minor)."*

---

## 5. Out of scope (for this Phase 4 MVP)

- **External LLM** — Phase 5. Phase 4 uses deterministic intent + slot extraction + reply composition from tool outputs.
- **Multi-modal input** — image/PDF attachments in messages. Phase 5.
- **Voice input** — Phase 6.
- **Proactive suggestions** — the Copilot won't pop up "did you mean" without user asking. Phase 6.
- **Conversation across tenants** — explicitly forbidden (Constitution §II).

---

## 6. Open questions (will resolve in /speckit.clarify)

1. **Intent classifier implementation** — pure regex/keyword match? Or a small rules engine? **Default: keyword matcher + slot extractor (pure functions).**
2. **Tool call failure handling** — if a tool call 4xx/5xx, do we return partial answer or fail the whole query? **Default: partial answer with explicit "tool X failed" note.**
3. **Conversation persistence** — Postgres or Redis? **Default: Postgres (audit trail); Redis cache in Phase 4.b.**
4. **Streaming protocol** — SSE? WebSocket? **Default: SSE (matches Phase 1/2/3 pattern).**
5. **Pin scope** — can a pin be project-wide or org-wide? **Default: project-wide.**
6. **Max conversation length** — what's the cap on messages per conversation? **Default: 1000.**
7. **Conversation titles** — auto-generated from first message or user-set? **Default: auto-generated from first 80 chars of first message.**

