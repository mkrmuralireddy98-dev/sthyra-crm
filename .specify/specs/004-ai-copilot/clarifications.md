# Clarifications — AI Copilot

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — Intent classifier implementation?

**Decision:** Pure keyword matcher + regex slot extractor. Pure functions, no external dependencies.

**Rationale:** Determinism (NFR-2) requires reproducibility. A small rules engine that maps keyword patterns → intent + extracts slots via regex is fully testable. Phase 5 may swap in an LLM, but the Phase 4 version is fully deterministic.

**Impact:** `intentClassify(text, context) → { intent, slots, confidence }`. Tests verify each intent's pattern triggers correctly.

## Q2 — Tool call failure handling?

**Decision:** Partial answer with explicit failure note.

**Rationale:** The user benefits from seeing what worked. Failing the whole query because one tool 4xx'd is bad UX.

**Impact:** Reply includes a `toolErrors: [{ tool, error }]` array. Reply text mentions which tools failed and continues with the rest.

## Q3 — Conversation persistence?

**Decision:** Postgres (Phase 4 MVP). Redis cache layer in Phase 4.b.

**Rationale:** Conversations are audit artifacts (Constitution §VII — same pattern as field-issue comments). The Postgres schema is straightforward; Redis is an optimization.

**Impact:** `Conversation` table with `messages JSONB` or normalized `Message` table. Phase 4 MVP uses normalized table for cleaner queries.

## Q4 — Streaming protocol?

**Decision:** SSE (matches Phase 1/2/3 pattern).

**Rationale:** Reusing the established SSE pattern (Constitution §VII).

**Impact:** FR-7 endpoint emits SSE events. Frontend uses EventSource.

## Q5 — Pin scope?

**Decision:** Project-wide.

**Rationale:** Pins are project-scoped references; cross-project pins would muddle org-level context.

**Impact:** `pin` field on the Message table. Filter by projectId on list.

## Q6 — Max conversation length?

**Decision:** 1000 messages per conversation.

**Rationale:** Most conversations should be <50. 1000 is the safety cap to prevent runaway storage.

**Impact:** POST returns 422 if conversation is at cap. Test verifies.

## Q7 — Conversation titles?

**Decision:** Auto-generated from first 80 chars of first message.

**Rationale:** Reduces user friction. Users can rename later (Phase 5).

**Impact:** `createConversation` strips whitespace, takes first 80 chars, prefixes with "Q: " for clarity.

