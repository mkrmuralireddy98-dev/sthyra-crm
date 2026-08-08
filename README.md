# Plumb — Visual Intelligence for the Built World

> **Phase 0 Foundation.** This is the working monorepo. The full product plan
> (18-month roadmap, 13 products, multi-region cloud, FedRAMP Moderate) lives in
> `/Users/muralikrishnamuthokuru/.hermes/plans/2026-08-08_090307-plumb-visual-intelligence-platform.md`
> and its appendix. **Read those documents before touching code.**

## What this repo is (Phase 0)

A real, working monorepo with **71 passing tests across 8 test suites**, an end-to-end-verified HTTP service, real Postgres integration, request-id propagation, a Next.js dashboard shell, and Docker Compose for local dev.

```
plumb/
├── packages/
│   ├── tokens/         # @plumb/tokens — design tokens (color, type, motion)
│   └── observability/  # @plumb/observability — structured logging + request-id
├── services/
│   ├── org-service/    # @plumb/org-service — tenant-scoped orgs (Postgres + in-memory)
│   ├── project-service/# @plumb/project-service — projects belong to orgs, archive FSM
│   └── user-service/   # @plumb/user-service — identity, RBAC, opaque tokens
├── apps/
│   └── dashboard/      # @plumb/dashboard — Next.js 14 App Router (Phase 0 shell)
├── docker-compose.yml  # Postgres 16 + optional pgAdmin
├── .github/workflows/ci.yml  # typecheck + unit + Postgres integration tests
├── .env.example
├── .eslintrc.json + .prettierrc.json
└── package.json (workspace root, pnpm 11)
```

## Quick start

```bash
# 1. Install
pnpm install

# 2. Local Postgres (or skip if you only want in-memory)
docker compose up -d postgres

# 3. Build everything
pnpm build

# 4. Run all tests
pnpm test

# 5. Boot the org-service against Postgres
pnpm --filter=@plumb/org-service start:pg

# 6. Boot the dashboard (in a separate terminal)
pnpm --filter=@plumb/dashboard dev
# → http://localhost:3000
```

## Architectural decisions (read these)

1. **Tenancy is data-modeled.** Every record carries `region`; (name, region) is unique; same name in different regions is allowed. Per master plan §5.
2. **Repository pattern.** Each service defines a `Repository` interface; `InMemory*Repository` for tests/dev, `Postgres*Repository` for prod. Call sites never touch the DB directly.
3. **Postgres-backed with parameterized queries only.** No string concatenation. `UniqueViolationError` typed on the duplicate-key path. Idempotent migrations.
4. **REST + RFC 7807 + Idempotency-Key** at the edge. Every error response has a `trace_id`.
5. **Request-ID propagation** via AsyncLocalStorage + Fastify plugin. Every log line carries the same `request_id` as the response's `trace_id`.
6. **Opaque tokens, SHA-256 hashed at rest.** Phase 1 will swap the `TokenStore` for Redis and add JWT/SVID issuance per the SPIFFE/SPIRE choice.
7. **Teal + amber palette** (Appendix L.1 — PPE-aware). NOT cyan + copper. NEVER safety-orange-as-primary on real sites.
8. **Strict TypeScript** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.

## TDD discipline

Every PR follows RED → GREEN → REFACTOR. Tests are co-located with source (`foo.ts` + `foo.test.ts`). Run a single test file with:

```bash
cd services/org-service
pnpm test
```

## Where to look first

- **Adding a new service?** Copy `services/org-service/` structure. Repository interface → InMemoryRepo → PostgresRepo → Service → HTTP → tests.
- **Adding a new endpoint?** Update `services/<svc>/src/http.ts` and add a test in `services/<svc>/src/http.test.ts`. Use the existing RFC 7807 helpers.
- **Changing the visual system?** Update `packages/tokens/src/index.ts`. The dashboard pulls CSS vars from `toCssVariables('dark')`. Three modes: light / dark / high-contrast.
- **Tracing a request?** Every log line carries `request_id`. Every error response has `trace_id`. Match them in your dashboard.

## What's NOT here yet (Phase 1+ backlog)

These are documented in the master plan but **deliberately not built** in Phase 0:

- Real OIDC / SAML SSO / SCIM (UserService has a stubbed interface)
- SPIFFE/SPIRE workload identity (decided in plan, Phase 1)
- 360° viewer (three.js + WebGL/WebGPU) — Phase 1
- Capture pipeline (Spatial AI Engine, COLMAP/GLOMAP, 3D Gaussian Splatting) — Phase 1
- AI Copilot (Llama 3, RAG, function-calling, voice I/O) — Phase 1
- Mobile apps (KMM + Swift/Kotlin shells) — Phase 1
- All 20+ integrations (Procore, ACC, BIM 360, P6, Salesforce, etc.) — Phase 1+
- FedRAMP / SOC 2 / ISO 27001 evidence collection — Phase 2+
- Terraform, Kubernetes, multi-region — Phase 2+

## Working agreement (for AI coding agents and humans)

If you are an AI coding agent (Cursor, Aider, Codex, Claude Code, custom Herma agents), read this section carefully before touching code. Humans should follow it too.

### TDD is non-negotiable

```text
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.
```

The full discipline: RED (write failing test) → GREEN (minimal code to pass) → REFACTOR (clean up). Watch each test fail before implementing. If a test passes immediately, you are testing the wrong thing.

### Architectural decisions are pinned — don't re-decide

- **Tenancy is data-modeled.** Every record carries `region`; (name, region) is unique.
- **Repository pattern.** InMemory for tests, Postgres for prod. Interface in the service file.
- **REST + RFC 7807 + Idempotency-Key** at the edge. Use the existing helpers.
- **Request-ID propagation** via `@plumb/observability`. Every log line carries `request_id`.
- **Strict TypeScript.** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
- **Teal + amber** palette. NOT cyan + copper. NEVER safety-orange-as-primary.

If you think you need to change one of these, **don't** — open an issue or discussion first.

### Repository layout

```
packages/<lib>/        # Reusable library code (tokens, observability)
services/<svc>/        # Stateful backend service (org, project, user, capture, etc.)
apps/<app>/            # End-user surface (dashboard, mobile-shell, marketing)
```

A new service? Copy `services/org-service/` structure. A new lib? Copy `packages/tokens/` structure.

### Naming

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions / variables: `camelCase`
- Test files: `*.test.ts` co-located with source
- DB tables: `snake_case` (e.g., `orgs`, `project_members`)
- API endpoints: `/v1/<resource>` REST, plural where possible
- Error responses: `application/problem+json` per RFC 7807

### Tests

- Co-located with source (`foo.ts` + `foo.test.ts`)
- Use `node:test` (not jest, not mocha)
- Use `* as assert from 'node:assert/strict'`
- Test names describe behavior, not implementation.
- One behavior per test.

### Database

- Parameterized queries only. No string concatenation.
- New table = new migration. Idempotent migrations (`CREATE TABLE IF NOT EXISTS`).
- Add an index for any column you query by.

### Logging

- Never `console.log("some debug thing")`. Use `emit('info' | 'warn' | 'error', msg, fields)` from `@plumb/observability`.
- Logs are JSON. One line per event. `request_id` is automatic.
- Don't log PII. Don't log full tokens. Don't log full request bodies.

### Phase discipline

If a task seems to require a Phase 1+ feature (360 viewer, ML pipeline, OIDC, mobile, integrations, etc.), **don't fabricate a half-working version**. Surface it as a Phase 1+ item in your final report and stop.

### Common tasks

**Add an endpoint:** Write the failing test first → run it → add the route in `http.ts` using existing `buildHeaders`/`parseProblem` helpers → add a structured log via `emit()` → commit.

**Add a new service:** Copy `services/org-service/` structure. Service → Repository interface → InMemory impl → Postgres impl (parameterized SQL only) → HTTP → CLI. Tests co-located.

**Add a design token:** Edit `packages/tokens/src/index.ts`. Add to `SemanticColor` interface + all 3 modes (light/dark/high-contrast). Add a test case verifying all 3 modes have the new token.

### Commit format

`<scope>: <imperative summary>` — `feat(org-service): add Postgres repository`.

## License

Proprietary. © 2026 Plumb. All rights reserved.
