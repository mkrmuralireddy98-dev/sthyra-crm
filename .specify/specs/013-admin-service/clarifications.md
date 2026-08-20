# Phase 13 — Clarifications

**Session:** 2026-08-20

---

## Q1: Where is admin auth coming from?

**Decision:** Admin JWTs are issued by `user-service` with a special
`admin_role` claim. Standard JWT issuance (HS256, 32-byte secret from
`JWT_SECRET` env var) is extended to include `admin_role: 'super'` or
`'support'`. The `admin-service` only validates — it does not issue tokens.

## Q2: Does admin-service own the audit log?

**Decision:** Yes. Admin-service has its own audit table (in-memory for MVP,
Postgres table in Phase 13.b). All cross-tenant reads/writes from admin
go through audit. Per-tenant audit logs (e.g., field-service issue
history) remain in their respective services.

## Q3: How does admin-service call other services without breaking tenant isolation?

**Decision:** Admin endpoints pass an `x-admin-bypass: true` header to
downstream services. Each downstream service (capture, field, etc.)
checks for this header in its auth middleware and accepts the call
without a tenant JWT, recording an audit correlation ID instead.

In Phase 13 MVP, we use a simpler approach: admin-service calls internal
endpoints (`/v1/internal/...`) that bypass tenant checks but require an
admin JWT. Phase 13.b will introduce proper internal mTLS.

## Q4: Should feature flags be in admin-service or a separate service?

**Decision:** Phase 13 ships feature flags inside admin-service (one
service, simpler). Phase 14 (post-MVP) can extract to a `flag-service`
if needed. Same code path for the data plane — just different scope.

## Q5: What is the MVP scope vs deferred?

**Decision:** MVP ships the 5 functional areas in spec §2 (FR-1 to FR-9)
plus FR-10 stats. Phase 13.b adds billing, email notifications, bulk ops.
