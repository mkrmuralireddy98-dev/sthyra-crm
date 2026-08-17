# Implementation Plan — BIM Viewer

**Feature ID:** 003-bim-viewer
**Date:** 2026-08-17
**Conformance:** `.specify/memory/constitution.md` v1.0.0
**Source:** `spec.md` + `clarifications.md`

## Tech Stack

Same as Phase 1 + Phase 2. No new dependencies.

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Node.js 22 + tsx (tests) + esbuild
- Fastify 5 (HTTP), `@sthyra-crm/observability` (request-id + structured logs)
- Postgres 16 (production) / InMemory (tests) via `BimRepository`
- pnpm workspaces — new package `services/bim-viewer-service/`

## Architecture (mirrors field-service)

```
services/bim-viewer-service/
├── src/
│ ├── types.ts                    — BimModel, BboxElement, Deviation, enums
│ ├── repository.ts              — BimRepository interface
│ ├── repo-memory.ts             — InMemoryBimRepository (Phase 3 MVP)
│ ├── postgres-repo.ts           — PostgresBimRepository (Phase 3.b)
│ ├── service.ts                 — BimService (orchestrates upload, lookup, align, diff)
│ ├── http.ts                    — 8 Fastify routes (FR-1 to FR-8)
│ ├── bbox-tree.ts               — In-memory spatial index for IfcElement → point lookups
│ ├── ifc-parser.ts              — Pure IFC 4x3 parser stub (entity extraction, bbox compute)
│ ├── diff.ts                    — Capture-vs-model deviation scanner
│ ├── state-machine.ts           — Pure bim model status transitions
│ ├── pagination.ts              — Re-export from field-service? No — keep local; HMAC cursor
│ ├── events.ts                  — InMemoryEventBus (re-export pattern from field-service)
│ ├── cli.ts                     — startInMemoryServer + startPostgresServer
│ ├── cli-e2e.test.ts            — 4 E2E tests via fetch
│ ├── http.test.ts               — 30 tests for HTTP routes
│ ├── service.test.ts            — 12 tests for BimService
│ ├── bbox-tree.test.ts          — 8 tests for spatial index
│ ├── ifc-parser.test.ts         — 6 tests for IFC parsing
│ ├── diff.test.ts               — 8 tests for deviation detection
│ ├── state-machine.test.ts      — 8 tests for status transitions
│ ├── docker-compose.test.ts     — Structural validation
│ └── *.test.ts                  — Per-module tests
├── package.json
├── tsconfig.json
├── Dockerfile
└── migrations/
 └── 001-init.sql                — bim_models + bim_element_deviations
```

## File paths (concrete)

| Path | Purpose |
|---|---|
| `services/bim-viewer-service/src/types.ts` | BimModel, BboxElement, Deviation, enums |
| `services/bim-viewer-service/src/repository.ts` | BimRepository contract + PaginatedResult |
| `services/bim-viewer-service/src/repo-memory.ts` | In-memory implementation |
| `services/bim-viewer-service/src/postgres-repo.ts` | Postgres implementation |
| `services/bim-viewer-service/src/postgres-repo.test.ts` | 6+ tests with FakePgClient |
| `services/bim-viewer-service/src/bbox-tree.ts` | Spatial index for element lookup |
| `services/bim-viewer-service/src/bbox-tree.test.ts` | 8+ tests |
| `services/bim-viewer-service/src/ifc-parser.ts` | IFC 4x3 parser stub (Phase 3 ships a stub; real parser is Phase 4) |
| `services/bim-viewer-service/src/ifc-parser.test.ts` | 6+ tests |
| `services/bim-viewer-service/src/diff.ts` | Deviation scanner |
| `services/bim-viewer-service/src/diff.test.ts` | 8+ tests |
| `services/bim-viewer-service/src/state-machine.ts` | Pure status transitions |
| `services/bim-viewer-service/src/state-machine.test.ts` | 8+ tests |
| `services/bim-viewer-service/src/service.ts` | BimService domain layer |
| `services/bim-viewer-service/src/service.test.ts` | 12+ tests |
| `services/bim-viewer-service/src/http.ts` | 8 routes (FR-1 to FR-8) |
| `services/bim-viewer-service/src/http.test.ts` | 30+ tests |
| `services/bim-viewer-service/src/realtime/index.ts` | InMemoryEventBus (bim events) |
| `services/bim-viewer-service/src/realtime/sse.ts` | SSE endpoint (FR-7) |
| `services/bim-viewer-service/src/realtime/sse.test.ts` | 8+ tests |
| `services/bim-viewer-service/src/cli.ts` | CLI entry |
| `services/bim-viewer-service/src/cli-e2e.test.ts` | 4 E2E tests |
| `services/bim-viewer-service/src/docker-compose.test.ts` | Structural validation |
| `services/bim-viewer-service/migrations/001-init.sql` | bim_models + bim_element_deviations |
| `services/bim-viewer-service/Dockerfile` | Multi-stage build |

## Architecture decisions

### A1 — BimRepository contract

```typescript
export interface BimRepository {
 // BIM models
 insertBimModel(model: BimModel): Promise<void>;
 findCurrentModel(orgId: string, projectId: string): Promise<BimModel | null>;
 findModelById(orgId: string, id: string): Promise<BimModel | null>;
 listModels(orgId: string, projectId: string): Promise<readonly BimModel[]>;
 updateModelState(orgId: string, id: string, state: BimModelState, totalElements: number | null): Promise<void>;
 softDeleteModel(orgId: string, id: string): Promise<void>;

 // Bbox tree (per model)
 saveBboxTree(orgId: string, modelId: string, tree: BboxTree): Promise<void>;
 loadBboxTree(orgId: string, modelId: string): Promise<BboxTree | null>;

 // Deviation records
 insertDeviation(deviation: Deviation): Promise<void>;
 listDeviations(orgId: string, modelId: string, captureId: string, thresholdMeters: number): Promise<readonly Deviation[]>;

 // SSE subscribers (for FR-7) — in-memory only; production uses Redis
 subscribeBimEvents(orgId: string, projectId: string, handler: (e: BimEvent) => void): Unsubscribe;

 nextId(): number;
}
```

### A2 — BboxTree (spatial index)

Pure data structure. R-tree-like, but simpler: divide space into a coarse 3D grid, each cell holds elements whose bbox intersects it. Lookup = find cell, scan cells within radius.

```typescript
export interface BboxElement {
 readonly elementId: string;
 readonly elementName: string;
 readonly elementType: string;
 readonly min: { x: number; y: number; z: number };
 readonly max: { x: number; y: number; z: number };
}

export interface BboxTree {
 readonly cellSize: number;
 readonly elements: readonly BboxElement[];
 findNearest(x: number, y: number, z: number, radius: number): BboxLookupResult | null;
}
```

### A3 — IFC parser stub

Phase 3 ships a **stub** that reads a small IFC 4x3 fixture file and extracts entity names + bboxes. The real IFC parser is Phase 4 (Web-IFC or similar). For Phase 3 MVP:
- `parseIfc4x3(buffer) → { schema, totalElements, bboxes }`
- Throws on invalid schema
- The stub uses simple regex on the IFC text format (IFC is mostly STEP physical files with text-based entity definitions)

### A4 — Diff algorithm

```
for each point in capture:
 for each element in bboxTree.findNearest(point.xyz, threshold):
 if point not within any element:
 record deviation { elementId: null, deviationType: 'orphan', ... }
 for each captured structural element not in BIM:
 record deviation { elementId: bimId, deviationType: 'extra', ... }
```

Phase 3 stub: scan a representative sample (1k points), not all points. Full diff is Phase 3.b.

### A5 — Status state machine

```
new → uploading → validating → ready → aligned → diffed
                                → failed
```

Pure transitions matrix; throws on invalid.

### A6 — Schema (Postgres)

```sql
CREATE TABLE bim_models (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 project_id TEXT NOT NULL,
 file_name TEXT NOT NULL,
 schema_version TEXT NOT NULL CHECK (schema_version IN ('IFC4X3')),
 total_elements INTEGER NULL,
 model_hash TEXT NOT NULL,
 storage_key TEXT NOT NULL, -- S3 key (or LocalFs path)
 state TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new','uploading','validating','ready','aligned','diffed','failed')),
 is_current BOOLEAN NOT NULL DEFAULT TRUE,
 created_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 validated_at TIMESTAMPTZ NULL,
 deleted_at TIMESTAMPTZ NULL
);

-- One current model per (org, project)
CREATE UNIQUE INDEX bim_models_current_uq ON bim_models (org_id, project_id) WHERE is_current = true AND deleted_at IS NULL;

CREATE TABLE bim_deviations (
 id BIGSERIAL PRIMARY KEY,
 org_id TEXT NOT NULL,
 model_id TEXT NOT NULL,
 capture_id TEXT NOT NULL,
 element_id TEXT NULL,
 deviation_type TEXT NOT NULL CHECK (deviation_type IN ('orphan','extra','missing','misaligned')),
 severity TEXT NOT NULL CHECK (severity IN ('minor','major','critical')),
 distance_meters NUMERIC(10,4) NOT NULL,
 description TEXT NULL,
 detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX bim_deviations_org_model_idx ON bim_deviations (org_id, model_id, capture_id, distance_meters DESC);
```

### A7 — Routes (8 total)

```
POST   /v1/projects/:projectId/bim-model                  (FR-1)
GET    /v1/projects/:projectId/bim-model                  (FR-2)
POST   /v1/projects/:projectId/captures/:captureId/align (FR-3)
POST   /v1/projects/:projectId/bim-model/element-lookup (FR-4)
GET    /v1/projects/:projectId/bim-model/aligned-captures (FR-5)
GET    /v1/projects/:projectId/bim-model/diff             (FR-6)
GET    /v1/projects/:projectId/bim-model/events           (FR-7)
DELETE /v1/projects/:projectId/bim-model                  (FR-8)
```

Plus /v1/health.

## Test coverage targets

Target: ~120 new tests.

- 8+ state-machine tests
- 6+ postgres-repo tests
- 8+ bbox-tree tests
- 6+ ifc-parser tests
- 8+ diff tests
- 12+ service tests
- 30+ http tests (per route, cross-tenant probes, idempotency replay)
- 8+ realtime tests
- 4+ CLI E2E tests
- 5+ structural tests

