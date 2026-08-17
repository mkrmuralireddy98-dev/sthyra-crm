# Feature Specification — Integrations

**Feature ID:** 011-integrations
**Phase:** 11 (eleventh feature spec)
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0 (re-affirmed)
**Phase 11 architectural decision:** NEW service `integration-service` (justified in §1)

---

## 1. Summary

**Integrations** bridges Sthyra CRM with external construction industry tools:

- **Procore** — project management, RFI sync, daily log import
- **BIM 360** — model sync, issue sync
- **PlanGrid** — punch list sync (alternative to Phase 7's native punch list)
- **Custom HTTP** — webhook receiver for any external system

**Why now:** PMs and field crews already use Procore/PlanGrid daily. Sthyra CRM is a richer replacement for the visual intelligence layer; Integrations lets it coexist with these tools during transition.

**Architectural decision:** NEW `integration-service` on port 9098. Rationale:
- Integrations are external-system adapters — fundamentally different from internal CRUD
- Per Constitution §VII — distinct domain justifies distinct service
- 13-product roadmap explicitly listed Integrations

**Scope discipline:** Phase 11 MVP ships **3 connectors** (Procore, BIM 360, Webhook) + a **sync log** for auditability. Real OAuth flows and bidirectional sync deferred to Phase 11.b.

---

## 2. Functional Requirements (FRs)

### FR-1 — Connect an external system
**As** an admin
**I want** to connect Sthyra to Procore/BIM360/etc.
**So that** data flows between systems.

- `POST /v1/orgs/:orgId/integrations`
- Body: `{ provider: 'procore' | 'bim360' | 'plangrid' | 'webhook', config: { apiKey?, oauthToken?, webhookUrl?, projectMapping?: Record<string, string> } }`
- Returns: `{ integrationId, provider, status: 'connected', connectedAt }`
- Headers: `x-tenant-id`, `x-idempotency-key`
- 201 first / 200 on replay / 422 on invalid provider

### FR-2 — List integrations
**As** an admin
**I want** to list all connected integrations
**So that** I can manage them.

- `GET /v1/orgs/:orgId/integrations`
- Returns: `{ items: Integration[] }` (excludes sensitive config fields)
- 200 with paginated list

### FR-3 — Disconnect
**As** an admin
**I want** to disconnect an integration
**So that** data stops flowing.

- `DELETE /v1/integrations/:id`
- 204 on success / 404 on cross-tenant

### FR-4 — Trigger sync
**As** an admin
**I want** to manually trigger a sync
**So that** I can force data pull.

- `POST /v1/integrations/:id/sync`
- Body: `{ direction: 'pull' | 'push' | 'both', entityTypes: readonly string[] }`
- Returns: `{ syncId, status: 'completed' | 'failed', itemsProcessed: number, errors?: string[] }`
- 200 on success / 422 on invalid direction

### FR-5 — Sync history
**As** an admin
**I want** to see sync history
**So that** I can debug failures.

- `GET /v1/integrations/:id/syncs?limit=20`
- Returns: `{ items: Sync[] }` with status, itemsProcessed, errors, startedAt, completedAt

### FR-6 — Webhook receiver
**As** an external system
**I want** to push events to Sthyra
**So that** two-way sync works.

- `POST /v1/integrations/:id/webhook`
- Body: `{ eventType: string, payload: Record<string, unknown> }`
- Headers: `x-webhook-signature` (HMAC of body, Phase 11.b)
- Returns: `{ received: true, processed: boolean }`
- 200 on success / 401 on bad signature

### FR-7 — Available providers
**As** an admin
**I want** to list supported providers
**So that** I can decide what to connect.

- `GET /v1/integrations/providers`
- Returns: `{ items: Provider[] }` — hardcoded list of providers with their requirements
- 200 with metadata

### FR-8 — Connection test
**As** an admin
**I want** to test an integration's connection
**So that** I know it's working.

- `POST /v1/integrations/:id/test`
- Returns: `{ ok: boolean, latencyMs: number, error?: string }`
- 200 with results

---

## 3. Non-Functional Requirements (NFRs)

### NFR-1 — Tenant isolation
Every endpoint enforces `x-tenant-id` (or `:orgId` path). Cross-tenant = 404.

### NFR-2 — RFC 7807 errors
All errors return `application/problem+json` with 6-field shape.

### NFR-3 — Idempotency
POST endpoints require `x-idempotency-key`. Replay returns 200 with same id.

### NFR-4 — Audit trail
Every sync run is logged via Sync record. Errors are captured.

### NFR-5 — Secret storage
Sensitive config (`apiKey`, `oauthToken`) is encrypted at rest. Phase 11 MVP: plain text + redact in API responses. Phase 11.b: AES-256-GCM with KMS.

### NFR-6 — Rate limiting
Each integration has max 100 syncs/day. Phase 11.b: per-tenant rate limits.

### NFR-7 — Soft delete
Integrations and syncs are never hard-deleted. Use `deletedAt`.

---

## 4. Provider types (Phase 11 MVP)

```typescript
export const PROVIDER_TYPES = ['procore', 'bim360', 'plangrid', 'webhook'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface Provider {
  readonly type: ProviderType;
  readonly name: string;
  readonly description: string;
  readonly requiredConfig: readonly string[];
  readonly supportedEntityTypes: readonly string[];
}
```

### Phase 11 MVP providers

| Provider | Required Config | Entity Types |
|---|---|---|
| `procore` | `apiKey` | `project`, `rfi`, `daily_log` |
| `bim360` | `oauthToken` | `model`, `issue` |
| `plangrid` | `apiKey` | `punch_list` |
| `webhook` | `webhookUrl` | `any` (custom) |

---

## 5. User scenarios

### Scenario A — Connect Procore
1. Admin opens Integrations page
2. Clicks "Connect Procore"
3. Enters API key + project mapping
4. POST /v1/orgs/X/integrations → returns integrationId
5. Connection test runs automatically → returns ok=true
6. Admin sees status: connected

### Scenario B — Pull Procore RFIs
1. Admin clicks "Sync now" on Procore integration
2. POST /v1/integrations/:id/sync with direction=pull, entityTypes=['rfi']
3. Stub connector pulls 5 RFIs (MVP), creates as Issues in field-service
4. Sync completes: itemsProcessed=5
5. Sync record: status=completed, itemsProcessed=5

### Scenario C — Webhook from external
1. External system POSTs to /v1/integrations/:id/webhook
2. Server validates signature (Phase 11.b), enqueues event
3. Returns: received=true, processed=true
4. Phase 11 MVP: emits internal event for workflow-service consumption

### Scenario D — Connection failure
1. Admin connects Procore with bad API key
2. POST /v1/integrations/:id/test → ok=false, error=401
3. Status remains: connected but with lastError
4. Admin sees clear error in dashboard

### Scenario E — Test sync
1. Admin clicks "Test" before real sync
2. POST /v1/integrations/:id/sync with dryRun=true
3. Server validates config without actually pulling
4. Returns: status=completed, itemsProcessed=0

---

## 6. Out of scope (for this Phase 11 MVP)

- **Real OAuth flows** — Phase 11.b. MVP uses stubbed API keys.
- **Bidirectional sync** — Phase 11.b. MVP only supports pull/push with manual trigger.
- **Field mapping UI** — Phase 11.b. MVP uses default field mappings.
- **Custom fields** — Phase 11.b.
- **Webhook signature verification** — Phase 11.b. MVP accepts unsigned.

---

## 7. Open questions (will resolve in /speckit.clarify)

1. **New service or extend field-service?** — new integration-service or extend field-service? **Default: new integration-service (per A-decision justification).**
2. **Real connectors or stubs?** — real Procore API calls or stubs? **Default: stubs (Phase 11.b for real).**
3. **Sync history limit?** — 100 or 1000? **Default: 100 syncs retained per integration (oldest evicted).**
4. **Webhook auth?** — signature or token? **Default: header token in MVP (Phase 11.b HMAC).**
5. **Provider count?** — 3 or 4? **Default: 4 (procore, bim360, plangrid, webhook).**
6. **Field mapping defaults?** — automatic or manual? **Default: automatic (default field names).**
7. **Cross-tenant data leak protection?** — list excludes sensitive data, doesn't it? **Default: yes, redact in API responses.**

