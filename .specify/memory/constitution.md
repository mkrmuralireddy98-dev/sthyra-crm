<!--
SYNC IMPACT REPORT
==================
Version change: (template/unratified) → 1.0.0
Bump rationale: Initial ratification of Sthyra CRM's binding principles.
  Derived from the Phase 0 README working agreement, the master plan's
  "Architecture decisions" pinned table (§4 of the engineering playbook),
  and the 13-product scope. MAJOR baseline because it establishes binding
  governance for a multi-tenant SaaS targeting FedRAMP Moderate.

Principles modified since prior version:
  - Added: I (Test-First), II (Multi-Tenant by Design), III (Strict Types),
    IV (REST + RFC 7807 + Idempotency-Key), V (Repository Pattern),
    VI (Observability by Default), VII (No Architectural Re-Decision)
  - Added cross-cutting sections: Security & Compliance, Performance & SLOs
  - Added Governance section with the amendment process
-->

# Sthyra CRM Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)

TDD mandatory. RED → GREEN → REFACTOR strictly enforced. **No production
code without a failing test first.** Tests are written, observed to fail,
then implementation follows minimum to pass, then refactored.

**Evidence required:** every commit's test run output, every PR showing
the failing test that drove the implementation, coverage ≥ 80% on changed
lines for release-candidate builds.

### II. Multi-Tenant by Design (NON-NEGOTIABLE)

Tenancy is a **data-model concern**, not an application concern. Every
record in the system of record carries `region` (one of: `us-east`,
`us-west`, `us-fedramp`, `eu-west`, `eu-central`, `ap-southeast`,
`ap-northeast`, `ksa`). `(name, region)` is unique — the same org name
in different regions is allowed and expected.

Tenant isolation is enforced at **every data plane**, not just the API:
- **API:** JWT carries `tenant_id`; per-request context propagates to all
  downstream calls.
- **Postgres:** Row-Level Security policies filter by `current_setting('app.tenant_id')`.
- **Redis:** keys prefixed `tenant:<id>:`; ACLs deny cross-tenant access.
- **S3:** per-tenant access points; object keys carry `tenant_id`.
- **Search (OpenSearch):** index alias per tenant; queries enforce filter.
- **Vector store:** per-tenant namespace; embeddings isolated.
- **KMS:** per-tenant Customer Managed Keys (CMK); envelope encryption.

**Evidence required:** automated tenant-isolation tests across all data
planes in CI; cross-tenant probe tests that **must fail** (no leak).

### III. Strict TypeScript

`tsconfig.base.json` enables `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, and
`noFallthroughCasesInSwitch`. **`as` is a last resort, not a tool.**

Every code change that loosens strictness requires a security review and
a documented reason in the PR description.

**Evidence required:** CI runs `tsc --noEmit` with strict flags; `any` is
flagged at lint level.

### IV. REST + RFC 7807 + Idempotency-Key at the Edge

Public surface is REST. Every mutating endpoint honors `Idempotency-Key`.
Every error response is `application/problem+json` per RFC 7807 with
`type`, `title`, `status`, `detail`, `instance`, `trace_id`, `code`.

gRPC is permitted for service-to-service hot paths. WebSocket is the
soft-realtime plane. GraphQL is permitted for the dashboard BFF only.

**Evidence required:** every error response in tests must include a
`trace_id`; every mutating endpoint has an idempotency test.

### V. Repository Pattern

Each service defines a `Repository` interface in its own package. Two
implementations: `InMemory*Repository` (tests, dev) and
`Postgres*Repository` (production). Tests run against a `FakePgClient`
contract; production uses `pg.Pool` directly. **Call sites never touch
the DB.**

Postgres SQL is parameterized-only — no string concatenation, ever.
Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`).

**Evidence required:** every service has both implementations; parameterized
queries are lint-enforced; migrations are replay-safe.

### VI. Observability by Default

Every service uses `@plumb/observability`'s `installRequestIdPlugin` on
boot. Every log line is structured JSON carrying `request_id`, `service`,
`ts`, `level`, `msg`, and `fields`. **No `console.log` in production code.**

The same `request_id` appears in:
- Every log line emitted during the request
- Every RFC 7807 problem+json response (as `trace_id`)
- The `x-request-id` HTTP response header

SLOs are pinned: API p99 < 500ms, availability 99.9%, capture ingest 99.5%.
**Alert on symptoms, not on causes.**

**Evidence required:** every service emits structured logs; SLO dashboards
exist; SLO burn alerts route to on-call.

### VII. No Architectural Re-Decision

The following decisions are **pinned** in the master plan and must not be
re-decided without an explicit conversation and an ADR:

| Decision | Why |
|---|---|
| pnpm workspaces (not Yarn/npm) | Already running; switching costs weeks |
| Monorepo layout: `packages/*`, `services/*`, `apps/*` | New top-level dirs require ADR |
| TypeScript strict mode | Real bugs caught during dev |
| Teal + amber palette (NOT cyan + copper) | Field-safety: amber reserved for warnings |
| REST at edge + RFC 7807 + Idempotency-Key | Standard |
| Repository pattern + parameterized SQL | Contract-tested |
| Postgres (Aurora in production) | Pinned |
| Elixir / Phoenix Channels for realtime | BEAM VM fault tolerance |
| SPIFFE / SPIRE for service-to-service mTLS (Phase 2) | Auto-rotated SVIDs |
| Per-tenant KMS CMK | Compliance invariant |
| FedRAMP-from-day-one posture | Compliance is built-in, not bolted-on |

**To re-decide any of these:** open a PR with the new proposal, a
documented cost of changing, and a sign-off from the Tech Lead + the
CEO. Default = keep.

## Cross-Cutting Constraints

### Security & Compliance

- **TLS 1.3** for all traffic; ACM-managed certs auto-rotated.
- **AES-256-GCM** (or ChaCha20-Poly1305) at rest, per-tenant CMKs.
- **OIDC + SAML SSO + SCIM** for tenant identity (Phase 1+).
- **FIDO2 / TOTP MFA** for admin routes; step-up on sensitive operations.
- **Right-to-erasure** mechanics: 4-tier (field-level redact → redaction →
  whole-project destructive → contractual-hold conflict).
- **Audit log** is append-only, hash-chained, WORM-exported (Object Lock
  Compliance mode, 7-year retention).
- **SOC 2 Type II** audit prep starts Phase 1.
- **FedRAMP Moderate** authorization in Phase 2 (US-Gov cloud isolated).
- **No standing access.** All admin access via SSO + SSM Session Manager.

**Vulnerability SLAs:** Critical 24h, High 7d, Medium 30d, Low 90d.
**GDPR breach notification:** 72h. **FedRAMP US-CERT notification:** 1h.

### Performance & SLOs

| Service | SLO | Error budget |
|---|---|---|
| All HTTP APIs | p99 latency < 500ms | 0.1%/month |
| All HTTP APIs | availability ≥ 99.9% | 43 min/month |
| Capture ingest | chunk upload success ≥ 99.5% | 0.5%/month |
| Spatial AI pipeline | p50 ≤ 1.3h, p95 ≤ 3h | n/a (latency-bound) |
| Copilot | p95 query latency < 4s | n/a |
| Realtime gateway | WebSocket stability ≥ 99.5% | 0.5%/month |

**Cost-per-capture target:** ≤ $15 fully-loaded at scale (compute $13 +
storage $0.40 + LLM $0.85 + telemetry $0.25).

### Quality Gates (per PR)

- Lint passes (ESLint + Prettier)
- Typecheck passes (strict TS)
- All unit tests pass
- Coverage ≥ 80% on changed lines
- No new Sev1/Sev2 lint violations

**Quality Gates (per Release Candidate):**
- All PR gates green
- SLO budget intact for previous 7 days
- Security scan + SBOM diff clean
- Accessibility audit passed (axe-core)
- Performance budget (Lighthouse CI)
- DR drill within 30 days

## Development Workflow

### TDD discipline (mandatory)

```
RED    → Write failing test. Verify RED (it fails for the right reason).
GREEN  → Write minimum code to pass. Verify GREEN.
REFACTOR → Clean up. Verify GREEN still.
COMMIT → Conventional format: feat(<scope>): <imperative summary>
```

### Commit format

`<scope>: <imperative summary>` — e.g., `feat(capture-service): add upload session`.
Scopes: `org-service`, `project-service`, `user-service`, `membership-service`,
`capture-service`, `copilot-service`, `dashboard`, `tokens`, `observability`,
`auth`, `ci`, `docs`.

### Per-PR review

- 1 reviewer minimum
- Sensitive-path PRs (auth, KMS, RLS, audit log) require 2 reviewers
- CI must be green before merge
- Squash-merge to main

### Per-release promotion

PR → ephemeral preview env (4h TTL) → staging (canary 1%→5%→25%→50%→100%)
→ production (canary 1%→5%→25%→50%→100% with SLO gates; auto-rollback on
burn > 2x).

## Governance

### Amendment process

This constitution is a **living document**. To amend:

1. Open a PR titled `constitution: amend <section>`.
2. Include the proposed change, the rationale, and a **Sync Impact Report**.
3. Version bump per spec-kit rules:
   - **MAJOR** — removing or relaxing a principle (e.g., dropping TDD).
   - **MINOR** — adding a new principle or section.
   - **PATCH** — wording clarification with no semantic change.
4. Requires sign-off from Tech Lead + CEO. Sensitive areas (security,
   tenancy) require sign-off from Security Lead too.

### Compliance

Every PR that touches auth, KMS, RLS, audit log, or billing requires
explicit sign-off from the Security Lead in addition to the standard
code review. These areas are the **critical path** for FedRAMP Moderate
authorization and SOC 2 Type II attestation.

### Override

There are **no overrides** for Principles I (Test-First), II
(Multi-Tenant by Design), and the security/tenancy clauses. If a task
seems to require violating them, **stop and surface it** — do not
ship a workaround.

For all other principles, deviation requires:
1. A documented reason in the PR.
2. Sign-off from the Tech Lead.
3. A tracking ticket to bring it back into compliance.

---

*This constitution is the binding governance for Sthyra CRM. When in
doubt, read this before re-deciding.*
