# Tasks — QA / Punch List

**Feature ID:** 007-qa-punch-list
**Date:** 2026-08-17

## Slice 1 — Schema + types (T-001 to T-005)

T-001 Extend types.ts: + IssueKind, + Trade, + PunchData, + IssuePhoto
T-002 Extend Issue interface with kind + punchData
T-003 CloseoutReport type + computeCloseoutReport function
T-004 Extend state-machine.ts: add 'closed' state, valid transitions
T-005 Migration 002-punch-list.sql

## Slice 2 — Service + repository (T-006 to T-010)

T-006 Extend repo-memory.ts with photo storage
T-007 Extend postgres-repo.ts (BYETEA placeholder)
T-008 Extend IssueService: createPunchItem + addPhoto + inspect
T-009 Extend existing list/find to return kind + punchData
T-010 Service tests (10+ tests)

## Slice 3 — HTTP routes (T-011 to T-016)

T-011 POST .../issues/:id/photos (multipart)
T-012 POST .../issues/:id/inspect
T-013 GET .../closeout
T-014 GET .../closeout/events (SSE)
T-115 Cross-tenant probes (8+ tests)
T-116 RFC 7807 errors

## Slice 4 — Closeout + Tests (T-017 to T-020)

T-017 closeout.ts module (computeCloseoutReport)
T-018 closeout.test.ts (8+ tests)
T-019 SSE closeout tests (4+ tests)
T-120 CLI E2E + integration

## Status — pending /speckit.implement
