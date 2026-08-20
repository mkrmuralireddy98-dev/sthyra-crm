# Feature Specification — Admin Service

**Feature ID:** 013-admin-service
**Phase:** 13 (thirteenth feature spec — final of 13)
**Date:** 2026-08-20
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Phase 13 architectural decision:** NEW service `admin-service` on port 9100

---

## 1. Summary

**Admin Service** is the cross-tenant operations console. It provides
super-admin capabilities that span all tenants in the Sthyra CRM platform:

- **Tenant management** — list, create, suspend, resume tenants (orgs)
- **User management** — list users across tenants, force logout, reset password
- **Audit log** — platform-wide audit trail of administrative actions
- **Feature flags** — per-tenant feature toggles (kill switches)
- **System health** — aggregated status of all microservices
- **Metrics rollups** — usage stats per tenant (issues created, captures uploaded, etc.)

**Why now:** Phases 1-12 deliver the per-tenant product surface. Phase 13
provides the platform-team surface needed to operate the SaaS — the
internal tooling for customer success, support, and SRE.

**Architectural decision:** NEW `admin-service` on port 9100. Rationale:
- Admin operations are fundamentally **cross-tenant** — violates the
  per-tenant boundary enforced by all other services (Constitution §II)
- Admin operations are **read-mostly with rare mutations** — different
  traffic profile than per-tenant CRUD
- Admin access requires a **separate admin-role JWT** (not a tenant JWT)
- Per Constitution §VII — distinct domain (platform ops vs tenant product)

**Scope discipline:** Phase 13 MVP ships **5 functional areas** (tenants,
users, audit, feature flags, health). Phase 13.b can add metrics rollups,
billing, support ticket integration.

---

## 2. Functional Requirements (FRs)

### FR-1: List Tenants
`GET /v1/admin/tenants` — returns paginated list of all orgs in the platform.
Query params: `cursor`, `limit`, `region`, `status`.
Response: `{ data: TenantSummary[], nextCursor: string | null }`

### FR-2: Create Tenant
`POST /v1/admin/tenants` — creates new org. Requires `admin-role: super`.
Body: `{ name: string, region: string, plan: 'starter' | 'pro' | 'enterprise' }`
Response: 201 with `{ id, name, region, plan, status: 'active', createdAt }`

### FR-3: Suspend / Resume Tenant
`POST /v1/admin/tenants/:id/suspend` and `/resume` — toggles tenant status.
Reason required for audit. Returns updated tenant summary.

### FR-4: List Users (cross-tenant)
`GET /v1/admin/users` — paginated list of all users across all tenants.
Query: `cursor`, `limit`, `tenantId?`, `role?`.
Response: `{ data: UserSummary[], nextCursor: string | null }`

### FR-5: Force Logout User
`POST /v1/admin/users/:id/logout` — invalidates all JWTs for a user (across
all tenants they belong to). Records audit entry.

### FR-6: Reset User Password
`POST /v1/admin/users/:id/reset-password` — generates a one-time password,
returns it ONCE in response. User must change on next login.

### FR-7: Audit Log
`GET /v1/admin/audit` — paginated list of admin actions.
Query: `cursor`, `limit`, `actorId?`, `actionType?`, `since?`.
Response: `{ data: AuditEntry[], nextCursor: string | null }`
Where `AuditEntry = { id, actorId, actionType, targetType, targetId,
reason, occurredAt, metadata }`

### FR-8: Feature Flags
`GET /v1/admin/feature-flags` — list all flags.
`PUT /v1/admin/feature-flags/:key` — toggle flag for specific tenant or globally.
Body: `{ tenantId?: string, enabled: boolean, reason: string }`

### FR-9: System Health
`GET /v1/admin/health` — aggregated health of all microservices.
Internally calls `/v1/health` on each service, returns summary:
```
{
 status: 'healthy' | 'degraded' | 'unhealthy',
 services: { 'capture-service': 'healthy', ... },
 checkedAt: '2026-08-20T12:00:00Z'
}
```

### FR-10: Tenant Stats
`GET /v1/admin/tenants/:id/stats` — usage stats for a tenant:
- issues.created (last 7d)
- captures.uploaded (last 7d)
- workflows.triggered (last 7d)
- activeUsers (last 24h)
- storageBytes (total)
Computed by querying other services or reading from cached rollups.

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1: Authentication
**Admin endpoints require admin-role JWT.** Standard tenant JWTs (with
`tenant_id` claim) are REJECTED. Admin JWT carries `admin_role: 'super'`
or `'support'` claim.

### NFR-2: Audit Trail
Every mutation (create/suspend/resume/force-logout/reset-password/flag-toggle)
writes an immutable AuditEntry before returning response. Audit writes
are best-effort but **block the response** (audit-first pattern).

### NFR-3: Rate Limiting
Admin endpoints have stricter rate limits than tenant endpoints:
- 60 requests / minute per admin user
- 10 mutations / minute per admin user
- Returns 429 with `Retry-After` header on excess.

### NFR-4: Pagination
All list endpoints use cursor-based pagination (HMAC-signed cursors,
same scheme as field-service). Default limit 50, max 200.

### NFR-5: Idempotency
All POST endpoints require `Idempotency-Key` header (per Constitution §IV).

### NFR-6: RFC 7807 Errors
All errors follow RFC 7807 (Problem Details for HTTP APIs).

### NFR-7: Tenant Isolation Bypass — Audited
Admin endpoints explicitly bypass tenant isolation (Constitution §II).
This is the ONE exception. Every cross-tenant read/write is audited.

---

## 4. Data Model

### TenantSummary
```typescript
{
 id: string;            // org_xxxxxxxxxxxx
 name: string;
 region: string;        // 'us-east' | 'us-west' | etc.
 plan: 'starter' | 'pro' | 'enterprise';
 status: 'active' | 'suspended' | 'trial';
 createdAt: Date;
 userCount: number;
}
```

### UserSummary (admin view)
```typescript
{
 id: string;            // usr_xxxxxxxxxxxx
 email: string;
 name: string;
 role: 'owner' | 'admin' | 'member' | 'viewer';
 tenantIds: string[];   // user may belong to multiple
 lastLoginAt: Date | null;
 status: 'active' | 'suspended' | 'invited';
}
```

### AuditEntry
```typescript
{
 id: string;            // aud_xxxxxxxxxxxx
 actorId: string;       // admin user who performed the action
 actionType: 'tenant.create' | 'tenant.suspend' | 'user.logout' |
 'user.reset_password' | 'feature_flag.toggle' | ...;
 targetType: 'tenant' | 'user' | 'feature_flag';
 targetId: string;
 reason: string;
 metadata: Record<string, unknown>;
 occurredAt: Date;
}
```

### FeatureFlag
```typescript
{
 key: string;           // 'capture.gpu_acceleration', etc.
 description: string;
 defaultEnabled: boolean;
 overrides: Map<string, boolean>; // tenantId -> enabled
 updatedAt: Date;
 updatedBy: string;
}
```

---

## 5. Architecture

```
admin-service (port 9100)
├── Repository (in-memory MVP, Postgres later)
├── Service (business logic + audit writes)
├── HTTP layer (Fastify, 9 routes)
├── JWT validator (admin-role only)
├── Rate limiter (token bucket)
├── Audit logger (write-before-return)
└── Health checker (aggregates /v1/health from all services)
```

**Dependencies:**
- `org-service` (port 9103) — list/create/suspend orgs
- `user-service` (port 9104) — list users, force logout
- `membership-service` (port 9102) — user→tenant mapping
- `field-service` (port 9091) — issue counts for stats
- `capture-service` (port 9090) — capture counts for stats
- All other services — health checks

---

## 6. Out of Scope (Phase 13.b)

- Billing / invoicing
- Support ticket integration
- Email notifications (when admin acts on a tenant, user gets email)
- Bulk operations (batch tenant migration)
- Custom dashboards / charts
- ML-based anomaly detection

These are deferred to Phase 13.b or later.

---

## 7. Acceptance Criteria

1. ✅ Admin JWT with `admin_role: 'super'` can list/create/suspend tenants
2. ✅ Standard tenant JWT is rejected with 403 on admin endpoints
3. ✅ Every mutation creates an AuditEntry before responding
4. ✅ Rate limiting returns 429 after 60 req/min
5. ✅ All list endpoints support cursor pagination
6. ✅ All POST endpoints require Idempotency-Key
7. ✅ System health endpoint reports status of all 12 services
8. ✅ Feature flag toggle persists and affects subsequent tenant requests
9. ✅ Force logout invalidates JWT across all tenants for that user
10. ✅ Audit log shows all admin actions with timestamp + actor + reason

---

**Status:** Phase 13 — Admin Service (final feature spec)
