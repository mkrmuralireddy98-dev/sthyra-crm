---
hide:
  - navigation
---

# Senior Backend Engineer — Sthyra CRM (Construction Visual Intelligence)

**Location:** Remote (US/EU-friendly time zones) · **Reports to:** Tech Lead
**Compensation:** $160k–$200k base + 0.5%–1.0% equity · **Type:** Full-time
**Stack:** Node.js, TypeScript, Fastify, PostgreSQL, AWS (EKS, S3, Lambda, Step Functions)

---

## About the role

Sthyra CRM is a multi-tenant, visual-intelligence platform for the construction industry. We're matching and beating OpenSpace AI's 5-product line (Capture, Field, Track, Air, BIM+) and shipping 8 additional products (Copilot, Voice, Live, Twin, ESG, Claims, Edge, Admin). The **master plan, 18-month roadmap, full marketing positioning, and a working Phase 0 monorepo are already done**.

What's built right now (working code, committed, tested):

- Monorepo with `packages/{tokens, observability, auth}` and `services/{org-service, project-service, user-service, membership-service}` — **114 tests green** across the suite
- DB schema + Postgres repositories for orgs and projects (real `pg.Pool`, parameterized SQL, idempotent migrations, mapped against a `FakePgClient` contract test)
- RFC 7807 problem+json errors with trace IDs, `Idempotency-Key` honored on every mutating endpoint
- Shared bearer-token auth middleware (`@sthyra-crm/auth`) that every service installs
- Structured JSON logging with request-id propagation via AsyncLocalStorage
- Next.js dashboard shell that calls the live services
- Three-stage GitHub Actions CI (unit · Postgres integration · quality gates)
- Docker Compose for local Postgres 16
- Full architectural documentation: master plan, technical appendix, AWS system architecture, visual flowcharts, this JD

**You would be the first backend engineer hired.** You will report directly to the Tech Lead and pair with our existing frontend engineer. We are not hiring a team; we are hiring **one senior engineer who can run the backend**.

---

## What you will own (Phase 0 closeout → Phase 1 MVP)

### Weeks 1–2: TDD fluency + Phase 0 closeout

- Read the master plan, the appendix, and the working agreement in `README.md`
- Run the full test suite locally, fix any flaky tests, close the test coverage gap
- Bring Postgres parity to the user-service and membership-service (you will mirror the pattern already in `services/org-service/src/postgres-repo.ts`)
- Wire real OIDC behind the existing `@sthyra-crm/auth` interface (Auth0 or Okta; the stub is `opaque:hex` in `services/user-service/src/index.ts`)
- Add MFA (TOTP) for admin routes via `@sthyra-crm/auth`'s `req.principal` sthyra-crm-value `mfa_required`
- Stand up the GitHub Actions integration-stage against a real Postgres service container; the yaml is already 3 stages, integration is stage 2

### Weeks 3–6: Phase 1 — Capture pipeline

- Build `services/capture-service/` (mirror `services/org-service/` structure exactly): upload-session endpoint, chunked direct-to-S3 upload, finalize, status transitions
- Wire the **ingestion DAG** as a Step Functions state machine: `Decode → SuperPoint → SfM (GLOMAP) → MVS (OpenMVS) → Poisson → 3DGS → SAM-2 → BIM align` (the GPU stages will be spec'd by the CV/ML contractor — you build the orchestration and the contract)
- Implement the idempotent `Idempotency-Key` cache backed by Redis
- Emit `capture.ready` domain events to EventBridge (or Kafka)
- Build the **realtime gateway** for Capture ready → WebSocket push (Phoenix Channels + Redis Pub/Sub)

### Weeks 7–12: Phase 1 — Field services + Copilot foundation

- `services/field-service/`: field notes, issue tracking, sketch-on-BIM, on-device transcription hooks
- `services/copilot-service/` (Phase 1 chat-only): function-calling LLM with tenant-pinned inference, pre-inference safety pipeline (PII redactor → prompt firewall → context quarantine), refusal-on-no-citation
- Cross-service integrations: **Procore, Autodesk Construction Cloud, Oracle Primavera P6** (priority set from §10 of the master plan)
- Public API surface: OpenAPI 3.1 + Protobuf in CI; rate limiting; webhook delivery with HMAC + replay

### Ongoing (running the company)

- On-call escalation (every other week) once services are in production
- Code review for the frontend engineer on the API surface — they review yours on the UI
- Write **3 ADRs per quarter** — the architecture is pinned, but the second-time-you-meet-a-problem, you write an ADR and update the master plan appendix
- Mentor the frontend engineer on backend topics during paired sessions

---

## What success looks like in 90 days

- 200+ tests passing across the workspace (currently 114)
- Postgres parity for all 5 services; production-readiness score ≥ 80% on the matrix in `README.md`
- A real OIDC provider fully integrated with the existing `@sthyra-crm/auth` plugin
- `services/capture-service` shipped with end-to-end upload → ingest DAG → realtime push — completely unblocks the frontend engineer's "capture workspace" page
- 1 Phase-1 integration in production (Procore CRUD round-trip)
- Zero Sev1 incidents; Sev2 MTTR < 4 h

---

## What we are looking for

### Must-have

- **6+ years writing TypeScript backend services** in production. You have shipped at least one REST API that handles > 10k RPS or > 1 TB/month of uploads
- **Deep Postgres fluency**: you can write a window-functioned query, debug a deadlock, design a row-level security policy, and explain why your last job used a queue on the side
- **AWS-native**: you've shipped services on EC2/EKS, used S3 directly (not just `aws-sdk` called from a function), debugged a CloudWatch log, and understand IAM well enough to write a least-privilege policy from scratch
- **Strict TypeScript**: you've worked with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, or comparable strictness (we use them). You know why `as` is a last resort
- **TDD discipline**: you write the failing test first, then the minimum code to pass. You can defend why in a code review
- **Idempotency + retries**: you've shipped background jobs that survive restarts, work resumes, and clients that retry. You understand the at-least-once vs at-most-once trade-off
- **Multi-tenancy**: you've enforced tenant isolation at every data plane — not just the API. You've shipped PostgreSQL RLS, per-tenant KMS keys, and per-tenant index aliases
- **RFC 7807**: you don't hand-roll error responses; you used the standard

### Strongly preferred

- Kinesis / SQS / EventBridge / Kafka in production
- Step Functions for long-running workflows
- A construction, geospatial, or 3D / 360° / point-cloud product in your history
- Wrote or maintained a public API with a partner-tier SLA
- Comfortable with Elixir / Phoenix (the realtime gateway tech), or willing to learn
- You have read the **Stripe or Linear public engineering blog** and have opinions about it

### Will not move forward

- "Vibe-coded" work history with no test coverage
- "Full-stack" claims where backend is weak (you'll be the only one)
- Cannot clearly explain how they'd enforce tenant isolation in a search index
- Wants to "modernize" the existing stack before delivering Phase 1

---

## What you will work with day-to-day

**Code you will read on day 1:**

- `services/org-service/src/index.ts` — reference implementation of the Repository pattern + tenancy
- `services/org-service/src/postgres-repo.ts` — reference for Postgres parity
- `services/org-service/src/http.ts` — RFC 7807 + Idempotency-Key + request-id wiring
- `packages/auth/src/index.ts` — the auth seam you'll extend with real OIDC
- `packages/observability/src/index.ts` — the logging context to use in every service
- `README.md` — the working agreement
- `~/.hermes/plans/2026-08-08_090307-sthyra-crm-visual-intelligence-platform.md` — the master plan

**Codebase conventions:**

- pnpm workspaces, 3 roots: `packages/`, `services/`, `apps/`
- Node 22, TypeScript strict, ESM, `node:test` + `assert` only
- Every change starts with a failing test (`pnpm test`)
- Commits: `<scope>: <imperative summary>` — `feat(capture-service): add upload session`
- No `console.log` — use `emit('info', 'msg', fields)` from `@sthyra-crm/observability`
- No string-concatenated SQL; parameterized queries only

**Tree right now:**

```
plumb/
├── packages/{tokens, observability, auth}
├── services/{org-service, project-service, user-service, membership-service}
├── apps/dashboard
├── docker-compose.yml
└── .github/workflows/ci.yml
```

You will add `services/{capture-service, field-service, copilot-service, integration-service, integration-procore, integration-acc, integration-p6}` over the next 6 months.

---

## How we work

- **Pair sessions** twice a week with the frontend engineer — you on the API surface, them on the UI
- **Architecture review** every Friday with the Tech Lead (30 min)
- **Async-first**: deep work blocks; Slack is for emergencies; status updates in Linear
- **No "story points"** — we ship vertical slices. A vertical slice is: failing test → passing → reviewed → deployed behind a flag → tested in production → released
- **Working hours**: protect them. No on-call pages after 18:00 local time unless you are on rotation
- **Meetings**: max 2 hours/day

---

## Compensation & benefits

- Base: **$160k–$200k** depending on seniority and location
- Equity: **0.5%–1.0%** (4-year vest, 1-year cliff)
- Health: 100% premium covered (US/EU equivalents)
- PTO: 25 days + 12 company holidays
- Books, courses, conferences — $3k/year, no questions
- MacBook Pro M4 Max, 64 GB RAM, or your preferred equivalent
- Co-working stipend if not remote from a home office

---

## Hiring process

1. **Phone screen (30 min)** — your background, the role, the company
2. **Take-home (3 hours, paid $300)** — implement a tiny backend service that satisfies a spec. You'll be graded on: test coverage, error handling, idempotency, observability. **Submit within 72 hours**
3. **System design (90 min)** — design a chunked-resumable upload service in conversation. We want to see how you reason about idempotency, retries, partial failures, and failure modes
4. **Pair programming (90 min)** — pair with the Tech Lead on a real codebase task. You'll see how we work; we'll see how you work
5. **Founder chat (45 min)** — meet the CEO. Mutual fit. No pitch
6. **Offer within 48 hours** of the final round

We aim to close in **2 weeks from first contact**. No panel of 6 people. No whiteboard algorithms.

---

## How to apply

Email `engineering@sthyra-crm.dev` with:

- A 200-word cover note answering: **"What's the most subtle tenant-isolation bug you've debugged, and what did you learn?"**
- Your GitHub or GitLab
- A specific project you shipped where you were the only backend engineer (this is what you'll be doing here)

**No recruiters. No agencies. No LinkedIn Easy Apply.**

---

## Why this is a unique role

- You will be the **first backend engineer** at a company that has already made the difficult decisions: brand, positioning, product line, pricing, architecture, tech stack. There is no "Phase 0 to design" — only Phase 1 to ship
- Your pair (the frontend engineer) is already in seat. You will have a real working partner from day 1
- The full Phase 1 backlog is in the master plan. You will read it, slice it, and ship it. You will not be in endless planning meetings
- Equity is real. The company has 12 founding-team slots remaining; you would be hire #2
- The codebase is small and clean. You will not be paying down 8 years of legacy tech debt
- The other 12 products assume Phase 1 ships. **You are the bottleneck.** That is high-leverage and high-visibility

If you are the engineer who reads a spec like this and starts writing `git init` in your head, we want to talk.

---

*Sthyra CRM is an equal-opportunity employer. We hire on the basis of merit and potential. We do not discriminate on race, color, religion, gender, gender identity, sexual orientation, national origin, age, disability, veteran status, or any other characteristic protected by law.*
