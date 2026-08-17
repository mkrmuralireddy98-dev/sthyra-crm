# Clarifications — Dashboard

**Date:** 2026-08-17
**Source:** `spec.md` §6 (7 open questions)

## Q1 — New service or static site?

**Decision:** NEW dashboard-service. Per spec §1.

**Rationale:** Server-side rendering keeps deployment simple.

**Impact:** New microservice on port 9099.

## Q2 — CSS approach?

**Decision:** Inlined `<style>` per page.

**Rationale:** No external stylesheet to serve.

**Impact:** CSS lives in `src/css.ts` as exported string constants.

## Q3 — Page count?

**Decision:** 8 pages (FR-1 to FR-8).

**Rationale:** Coverage of all 11 backend services.

**Impact:** 8 HTTP routes serving HTML.

## Q4 — Template engine?

**Decision:** Pure string concat (no deps).

**Rationale:** Keep dependencies minimal.

**Impact:** `renderLayout(title, body)` returns string. No handlebars/JSX.

## Q5 — Cross-service auth?

**Decision:** Internal service tokens.

**Rationale:** Phase 12.b adds full auth.

**Impact:** Dashboard uses `x-tenant-id` + `x-service-token` for downstream calls.

## Q6 — Tenant header on HTML pages?

**Decision:** Header (`x-tenant-id`).

**Rationale:** API compatibility.

**Impact:** Browsers send header via fetch; HTML pages rendered server-side.

## Q7 — Design tokens integration?

**Decision:** Import @sthyra-crm/tokens (workspace dep).

**Rationale:** Single source of truth for colors.

**Impact:** `import { tokens } from '@sthyra-crm/tokens';` in CSS module.

