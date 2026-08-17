# Implementation Plan — AI Copilot

**Feature ID:** 004-ai-copilot
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Tech Stack

Same as Phase 1 + 2 + 3. No new dependencies.

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Node.js 22 + tsx (tests) + esbuild
- Fastify 5 (HTTP), `@sthyra-crm/observability`
- Postgres 16 / InMemory
- pnpm workspaces — new package `services/ai-copilot-service/`

## Architecture (mirrors bim-viewer-service)

```
services/ai-copilot-service/
├── src/
│ ├── types.ts                — Conversation, Message, Intent, Slot, ToolCall, ToolError
│ ├── repository.ts          — CopilotRepository contract
│ ├── repo-memory.ts         — InMemoryCopilotRepository (Phase 4 MVP)
│ ├── postgres-repo.ts       — PostgresCopilotRepository (Phase 4.b)
│ ├── service.ts             — CopilotService
│ ├── http.ts                — Fastify HTTP layer (8 routes per spec.md FR-1 to FR-8)
│ ├── intent.ts              — Pure intent classifier (keyword + slot regex)
│ ├── intent.test.ts
│ ├── slot-extractor.ts      — Pure slot extractor
│ ├── slot-extractor.test.ts
│ ├── reply-composer.ts      — Pure reply composer (assembles from tool outputs)
│ ├── reply-composer.test.ts
│ ├── tool-router.ts         — Routes intent → tool call (calls downstream services)
│ ├── tool-router.test.ts
│ ├── state-machine.ts       — Pure conversation state (active, archived)
│ ├── state-machine.test.ts
│ ├── pagination.ts          — HMAC-signed cursor (reuses field-service pattern)
│ ├── realtime/index.ts      — InMemoryEventBus
│ ├── realtime/sse.ts        — SSE endpoint for FR-7
│ ├── cli.ts                — startInMemoryServer
│ ├── cli-e2e.test.ts        — 4 E2E tests via fetch
│ └── *.test.ts             — per-module tests
├── package.json
├── tsconfig.json
├── Dockerfile
└── migrations/
 └── 001-init.sql           — conversations + messages
```

## Architecture decisions

### A1 — Intent classifier (Q1)

Pure function. Maps text → intent + slots via keyword + regex patterns.

```typescript
interface Intent { type: 'list_captures' | 'list_issues' | 'lookup_element' | 'summarize_project' | 'find_blockers' | 'clarify'; slots: Record<string, string | number>; confidence: number; }
function classifyIntent(text: string, context?: { projectId?: string }): Intent
```

### A2 — Tool router (Q2)

Maps intent → list of tool calls. Each tool has a deterministic contract.

```typescript
type ToolName = 'capture.list' | 'issue.list' | 'bim.lookup_element' | 'bim.diff_summary' | 'capture.by_id' | 'issue.by_id';
async function routeTools(intent: Intent, ctx: { orgId: string; tenantClient: TenantClient }): Promise<{ calls: ToolCall[]; errors: ToolError[] }>
```

### A3 — Reply composer

Pure function. Assembles final text from tool outputs.

```typescript
interface ReplyOutput { text: string; toolCalls: ToolCall[]; toolErrors: ToolError[]; }
function composeReply(intent: Intent, tools: { calls: ToolCall[]; errors: ToolError[] }): ReplyOutput
```

### A4 — Postgres schema

```sql
CREATE TABLE conversations (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 title TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 archived_at TIMESTAMPTZ NULL,
 -- 'title' is auto-generated from first message first 80 chars (Q7)
 UNIQUE (org_id, user_id, title)
);

CREATE TABLE messages (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 conversation_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
 text TEXT NOT NULL,
 intent TEXT NULL,
 tool_calls JSONB NOT NULL DEFAULT '[]',
 tool_errors JSONB NOT NULL DEFAULT '[]',
 pinned BOOLEAN NOT NULL DEFAULT FALSE,
 pinned_at TIMESTAMPTZ NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_org_conversation_idx ON messages (org_id, conversation_id, created_at);
CREATE INDEX messages_org_pinned_idx ON messages (org_id, pinned) WHERE pinned = TRUE;
```

### A5 — Routes (8 total)

```
POST   /v1/conversations/:conversationId/messages                  (FR-1)
GET    /v1/conversations/:conversationId                          (FR-2)
GET    /v1/conversations                                           (FR-3)
POST   /v1/conversations/:conversationId/messages/:messageId/pin (FR-8)
POST   /v1/conversations/:conversationId/messages/:messageId/stream -- via SSE
... + GET /v1/health
```

### A6 — Streaming (Q4 + NFR-5)

SSE pattern matches Phase 1/2/3 (Constitution §VII). Each tool call emits `tool.call.start`, `tool.call.end` events. Reply text streams via `text.delta` events.

