# Phase 13 — Quality Checklist

**Date:** 2026-08-20

---

## TypeScript Build
- [ ] `pnpm run build` succeeds with no errors
- [ ] No `any` types outside test files
- [ ] All imports use `.js` extension (NodeNext)
- [ ] `tsconfig.json` extends base + adds `exactOptionalPropertyTypes`,
      `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`

## Tests (TDD)
- [ ] Every slice has tests written FIRST (RED), then implementation (GREEN)
- [ ] No production code without a failing test
- [ ] Tests use `node:test` + `assert/strict`
- [ ] Test coverage: repository 100%, service 90%+, HTTP 80%+

## Repository Pattern
- [ ] `AdminRepository` interface in `repository.ts`
- [ ] `InMemoryAdminRepository` implements interface in `repo-memory.ts`
- [ ] Tests inject repository via constructor (not module-level)

## Multi-Tenant (Bypassed)
- [ ] Admin endpoints accept only `admin-role` JWTs
- [ ] Standard tenant JWTs → 403
- [ ] Every cross-tenant action creates AuditEntry

## RFC 7807 Errors
- [ ] All error responses follow RFC 7807
- [ ] `type` is a URL pointing to docs
- [ ] `title` is human-readable
- [ ] `status` is the HTTP status code
- [ ] `instance` is the request path

## Idempotency-Key
- [ ] All POST endpoints require `Idempotency-Key` header
- [ ] Missing → 400 with `missing_idempotency_key` error
- [ ] Replay returns same response without re-executing

## Pagination
- [ ] All list endpoints support `cursor` query param
- [ ] Cursors are HMAC-signed (tamper detection)
- [ ] Default limit 50, max 200

## Rate Limiting
- [ ] 60 requests / minute per admin user
- [ ] 10 mutations / minute per admin user
- [ ] Returns 429 with `Retry-After` header

## Observability
- [ ] `installRequestIdPlugin` applied
- [ ] Structured JSON logs via observability package
- [ ] Audit writes logged with `audit.write` event

## Deployment
- [ ] Dockerfile is multi-stage node:22-alpine
- [ ] Image binds to 0.0.0.0 (NOT 127.0.0.1) for Docker DNS
- [ ] Service added to `docker-compose.integration.yml`
- [ ] Service depends on Postgres + Redis + all 12 other services

## Documentation
- [ ] `tasks.md` has completion banner at bottom
- [ ] Commit messages reference slice number

## Out-of-Scope Verification
- [ ] No billing code in MVP
- [ ] No email notifications in MVP
- [ ] No bulk operations in MVP
