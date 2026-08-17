# Analysis — AI Copilot

**Feature ID:** 004-ai-copilot
**Date:** 2026-08-17

## Cross-artifact consistency check

| Check | Status |
|---|---|
| Spec FR-1 to FR-8 map to plan routes | ✅ |
| Q1 → pure intent classifier | ✅ plan §A1 |
| Q2 → partial-answer tool errors | ✅ plan §A2 |
| Q3 → Postgres persistence | ✅ plan §A4 |
| Q4 → SSE streaming | ✅ plan §A6 |
| Q5 → project-wide pins | ✅ schema pin in messages table |
| Q6 → 1000 message cap | ✅ POST validates |
| Q7 → auto-generated titles | ✅ Conversation.title from first message |
| NFR-1 tenant isolation | ✅ every method takes orgId |
| NFR-2 determinism | ✅ pure intent classifier |
| NFR-4 RFC 7807 errors | ✅ HTTP layer mirrors Phase 1/2/3 |
| Constitution §VII no re-decision | ✅ SSE pattern, HMAC pagination, repository pattern reused |

## Findings

### F1 — Cross-service HTTP calls

The tool router calls capture-service, field-service, bim-viewer-service over HTTP. For Phase 4 MVP, we use `fetch` directly. Phase 4.b introduces a service-discovery abstraction (DNS-resolved internal addresses).

**Mitigation:** Tests use mock fetch (module-scoped variable).

### F2 — Streaming latency

SSE gives best UX for streaming replies. Phase 4 MVP emits events at each tool call boundary. Phase 4.b can stream per-token if we swap to an LLM.

### F3 — Reply composer determinism

The reply is composed deterministically from tool outputs (no LLM). This is intentional per NFR-2 and NFR-8.

