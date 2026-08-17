# Tasks — AI Copilot

**Feature ID:** 004-ai-copilot
**Date:** 2026-08-17

## Slice 1 — Foundations (T-001 to T-005)

T-001 Package skeleton
T-002 Domain types
T-003 CopilotRepository interface
T-004 InMemoryCopilotRepository
T-005 PostgresCopilotRepository skeleton

## Slice 2 — Pure core (T-006 to T-009)

T-006 Intent classifier (pure function, 8+ tests)
T-007 Slot extractor (pure function, 8+ tests)
T-008 Reply composer (pure function, 8+ tests)
T-009 State machine (conversation states, 8+ tests)

## Slice 3 — Tool router (T-010 to T-013)

T-010 Tool router contract
T-011 capture.list + capture.by_id implementations
T-012 issue.list + issue.by_id implementations
T-013 bim.lookup_element + bim.diff_summary implementations

## Slice 4 — Service layer (T-014 to T-017)

T-014 CopilotService.submit (drives full pipeline)
T-015 CopilotService.getConversation + list
T-016 CopilotService.pin
T-017 Pagination (HMAC cursor)

## Slice 5 — HTTP API (T-018 to T-025)

T-018 POST /v1/conversations/:id/messages (FR-1)
T-019 GET /v1/conversations/:id (FR-2)
T-020 GET /v1/conversations (FR-3)
T-021 POST .../messages/:id/pin (FR-8)
T-022 SSE streaming (FR-7)
T-023 Cross-tenant probes (8+ tests)
T-024 Idempotency-Key (4+ tests)
T-025 RFC 7807 errors (6+ tests)

## Slice 6 — Realtime + observability (T-026 to T-028)

T-026 InMemoryEventBus + SSE plugin
T-027 observability integration
T-028 /v1/metrics endpoint

## Slice 7 — E2E + Dockerfile + integration (T-029 to T-031)

T-029 CLI smoke test (4+ E2E tests)
T-030 Dockerfile + docker-compose integration
T-031 CI validation job

## Status — pending /speckit.implement

Phase 4 status: pending
