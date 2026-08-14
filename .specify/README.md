# `.specify/` — Spec-Driven Development artifacts

This directory holds the **constitution** and per-feature **specs** for
Sthyra CRM, following the [GitHub spec-kit](https://github.com/github/spec-kit)
methodology.

## Contents

```
.specify/
├── memory/
│   └── constitution.md       ← binding governance (v1.0.0)
└── specs/
    └── 001-capture-service/
        ├── spec.md            ← what + why
        ├── clarifications.md  ← ≤5 resolved questions
        ├── plan.md            ← how (architecture, file paths)
        ├── tasks.md           ← 30 ordered TDD slices
        ├── analysis.md        ← cross-artifact consistency
        └── checklist.md       ← release-candidate gate
```

## The constitution (`.specify/memory/constitution.md`)

The binding document for every spec. **Every spec clause must trace to
a constitution principle.** Amending the constitution requires a
`constitution: amend <section>` PR with a Sync Impact Report and
sign-off from Tech Lead + CEO.

Pinned principles:

- **I.** Test-First (NON-NEGOTIABLE) — RED → GREEN → REFACTOR
- **II.** Multi-Tenant by Design (NON-NEGOTIABLE) — `region` on every row
- **III.** Strict TypeScript — no `any`, no looser strict flags
- **IV.** REST + RFC 7807 + Idempotency-Key at the edge
- **V.** Repository Pattern — InMemory + Postgres, parameterized SQL only
- **VI.** Observability by Default — request-id propagation, structured logs
- **VII.** No Architectural Re-Decision — pinned decisions need ADR + sign-off

## Per-feature spec

A feature goes through **9 stages** (constitution first, then the rest
in order). Stages 2–7 produce the artifacts above; stages 8–9 are
executed during implementation and convergence.

| Stage | Output |
|---|---|
| 1. `/speckit.constitution` | `memory/constitution.md` |
| 2. `/speckit.specify` | `spec.md` |
| 3. `/speckit.clarify` | `clarifications.md` (≤5 questions) |
| 4. `/speckit.plan` | `plan.md` |
| 5. `/speckit.tasks` | `tasks.md` (ordered, testable) |
| 6. `/speckit.analyze` | `analysis.md` (cross-artifact consistency) |
| 7. `/speckit.checklist` | `checklist.md` (release-candidate gate) |
| 8. `/speckit.implement` | working code + TDD-shaped commits |
| 9. `/speckit.converge` | updated spec/plan/tasks reflecting reality |

## How to add a new feature

```bash
mkdir -p .specify/specs/00N-feature-slug
# 1. Constitution first — read it, ensure your feature aligns
cat .specify/memory/constitution.md
# 2. Write spec.md (what + why, NOT how)
# 3. Resolve clarifications.md (≤5 questions)
# 4. Write plan.md (file paths, architecture)
# 5. Write tasks.md (one TDD slice each, dependency-ordered)
# 6. Run analysis.md check
# 7. Build checklist.md (release gate)
# 8. /speckit.implement — code via the TDD skill
# 9. /speckit.converge — back-port the spec to match reality
```

## Verification

Before any feature PR:

```bash
# All specs have a complete artifact chain
find .specify/specs -name 'spec.md' | wc -l
find .specify/specs -name 'plan.md' | wc -l
find .specify/specs -name 'tasks.md' | wc -l
# Should all be equal
```

The constitution is referenced at every stage. If you find yourself
writing a feature clause that contradicts a principle, **stop and
update the constitution** (with sign-off), don't ship the contradiction.

---

*Specifications are executable. See `specs/001-capture-service/` for
a complete worked example.*
