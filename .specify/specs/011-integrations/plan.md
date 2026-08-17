# Implementation Plan — Integrations

**Feature ID:** 011-integrations
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** spec.md + clarifications.md

## Architecture Decision — NEW SERVICE

`integration-service` is a new microservice on port 9098.

## File paths

```
services/integration-service/
├── package.json
├── tsconfig.json
├── Dockerfile
├── migrations/
│ └── 001-init.sql                            ← integrations + syncs tables
└── src/
 ├── types.ts                                  ← Integration, Sync, Provider, ProviderType
 ├── types.test.ts                             ← 6 tests
 ├── repository.ts                              ← IntegrationRepository contract
 ├── repo-memory.ts                              ← InMemoryIntegrationRepository
 ├── repo-memory.test.ts                         ← 4 tests
 ├── connectors.ts                               ← 4 stub connectors + mapResultToIssue
 ├── connectors.test.ts                          ← 8 tests
 ├── mappers.ts                                  ← mapProcoreRFI/mapBIM360Issue → entity
 ├── mappers.test.ts                             ← 4 tests
 ├── service.ts                                  ← IntegrationService (CRUD + sync + test + webhook)
 ├── service.test.ts                              ← 12 tests
 ├── http.ts                                      ← 8 routes
 ├── http.test.ts                                 ← 25 tests
 ├── cli.ts                                       ← startInMemoryServer
 ├── cli-e2e.test.ts                               ← 4 tests
 └── migrations/001-init.sql
```

## Architecture decisions

### A1 — Connector interface

```typescript
export interface Connector {
  readonly provider: ProviderType;
  testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  pull(entityType: string, config: Record<string, unknown>): Promise<readonly Record<string, unknown>[]>;
  push(entityType: string, items: readonly Record<string, unknown>[], config: Record<string, unknown>): Promise<{ written: number }>;
}
```

### A2 — Stub connectors

```typescript
class StubProcoreConnector implements Connector {
  async testConnection(config) { return { ok: !!config.apiKey, latencyMs: 10 }; }
  async pull(entityType, config) {
 return entityType === 'rfi' ? [stubRFI(config)] : [];
 }
 async push(entityType, items) { return { written: items.length }; }
}
```

### A3 — Sync record

```typescript
interface Sync {
  id: string;
  orgId: string;
  integrationId: string;
  direction: 'pull' | 'push' | 'both';
  entityTypes: readonly string[];
  status: 'completed' | 'failed';
  itemsProcessed: number;
  errors: readonly string[];
  startedAt: Date;
  completedAt: Date | null;
  dryRun: boolean;
}
```

### A4 — Routes (8)

```
POST   /v1/orgs/:orgId/integrations                  (FR-1)
GET    /v1/orgs/:orgId/integrations                  (FR-2)
DELETE /v1/integrations/:id                         (FR-3)
POST   /v1/integrations/:id/sync                    (FR-4)
GET    /v1/integrations/:id/syncs?limit=20         (FR-5)
POST   /v1/integrations/:id/webhook                 (FR-6, x-webhook-token)
GET    /v1/integrations/providers                   (FR-7)
POST   /v1/integrations/:id/test                    (FR-8)
+ GET  /v1/health
```

### A5 — Redaction

```typescript
function redactIntegration(i: Integration): Integration {
 const { config, ...rest } = i;
 const redactedConfig: Record<string, unknown> = {};
 for (const [k, v] of Object.entries(config)) {
 if (k === 'apiKey' || k === 'oauthToken') {
 redactedConfig[k] = '***';
 } else {
 redactedConfig[k] = v;
 }
 }
 return { ...rest, config: redactedConfig };
}
```

### A6 — providers list

4 hardcoded providers:
- procore (apiKey, project/rfi/daily_log)
- bim360 (oauthToken, model/issue)
- plangrid (apiKey, punch_list)
- webhook (webhookUrl, any)

