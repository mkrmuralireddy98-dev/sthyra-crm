import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildBimServer } from './http.js';
import { InMemoryBimRepository } from './repo-memory.js';
import type { BimRepository } from './repository.js';
import type { BimModel, CreateBimModelInput } from './types.js';

const IFC = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;
#5=IFCBEAM('Level 3 East Beam',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;

let app: FastifyInstance;
let repo: BimRepository;
let counter = 0;

function makeRepo(): BimRepository {
 return {
 insertBimModel: async () => {},
 findCurrentModel: async () => null,
 findModelById: async () => null,
 listModels: async () => [],
 updateModelState: async () => {},
 markModelCurrent: async () => {},
 softDeleteModel: async () => {},
 insertDeviation: async () => {},
 listDeviations: async () => [],
 nextId: () => ++counter,
 };
}

beforeEach(async () => {
 counter = 0;
 repo = makeRepo();
 app = await buildBimServer({ repo });
});

describe('BIM HTTP — POST /v1/projects/:projectId/bim-model (FR-1)', () => {
 it('201 on first upload', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { fileName: 'l3.ifc', modelHash: 'abc', schemaVersion: 'IFC4X3', ifcContent: IFC, createdBy: 'u' },
 });
 assert.equal(res.statusCode, 201);
 const body = res.json();
 assert.ok(body.id.startsWith('bim_'));
 });

 it('401 when x-tenant-id missing', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model',
 headers: { 'x-idempotency-key': 'i' },
 payload: { fileName: 'l.ifc', modelHash: 'a', schemaVersion: 'IFC4X3', ifcContent: IFC },
 });
 assert.equal(res.statusCode, 401);
 });

 it('400 when x-idempotency-key missing', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model',
 headers: { 'x-tenant-id': 'org_a' },
 payload: { fileName: 'l.ifc', modelHash: 'a', schemaVersion: 'IFC4X3', ifcContent: IFC },
 });
 assert.equal(res.statusCode, 400);
 });

 it('400 on invalid schema version', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { fileName: 'l.ifc', modelHash: 'a', schemaVersion: 'IFC2X3', ifcContent: IFC },
 });
 assert.equal(res.statusCode, 400);
 });

 it('400 on invalid IFC content', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model',
 headers: { 'x-tenant-id': 'org_a', 'x-idempotency-key': 'i' },
 payload: { fileName: 'l.ifc', modelHash: 'a', schemaVersion: 'IFC4X3', ifcContent: 'invalid' },
 });
 assert.equal(res.statusCode, 400);
 });

 it('returns problem+json content-type on errors', async () => {
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model',
 headers: { 'x-tenant-id': 'org_a' },
 payload: {},
 });
 assert.match(res.headers['content-type'], /application\/problem\+json/);
 });
});

describe('BIM HTTP — GET /v1/projects/:projectId/bim-model (FR-2)', () => {
 it('200 with current model when found', async () => {
 const model: BimModel = makeModel('bim_001', 'org_a', 'prj_1', 'ready');
 repo.findCurrentModel = async () => model;
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/bim-model', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().id, 'bim_001');
 });

 it('404 when no model', async () => {
 repo.findCurrentModel = async () => null;
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/bim-model', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 404);
 });

 it('cross-tenant returns 404', async () => {
 const model = makeModel('bim_001', 'org_a', 'prj_1', 'ready');
 repo.findCurrentModel = async (orgId) => orgId === 'org_a' ? model : null;
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/bim-model', headers: { 'x-tenant-id': 'org_b' } });
 assert.equal(res.statusCode, 404);
 });
});

describe('BIM HTTP — POST /v1/projects/:projectId/captures/:captureId/align (FR-3)', () => {
 it('202 with jobId', async () => {
 const res = await app.inject({ method: 'POST', url: '/v1/projects/prj_1/captures/cap_001/align', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 202);
 assert.ok(res.json().jobId.startsWith('align_'));
 });

 it('401 when tenant missing', async () => {
 const res = await app.inject({ method: 'POST', url: '/v1/projects/prj_1/captures/cap_001/align' });
 assert.equal(res.statusCode, 401);
 });
});

describe('BIM HTTP — POST element-lookup (FR-4)', () => {
 it('200 returns matching element', async () => {
 const model = makeModel('bim_001', 'org_a', 'prj_1', 'ready');
 repo.findCurrentModel = async () => model;
 repo.listModels = async () => [model];
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model/element-lookup',
 headers: { 'x-tenant-id': 'org_a' },
 payload: { x: 1.5, y: 0.5, z: 0.25 },
 });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.ok(typeof body.elementId === 'string' || body.elementId === null);
 });

 it('404 when no model', async () => {
 repo.findCurrentModel = async () => null;
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model/element-lookup',
 headers: { 'x-tenant-id': 'org_a' },
 payload: { x: 1, y: 1, z: 1 },
 });
 assert.equal(res.statusCode, 404);
 });

 it('400 on invalid coordinates', async () => {
 const model = makeModel('bim_001', 'org_a', 'prj_1', 'ready');
 repo.findCurrentModel = async () => model;
 const res = await app.inject({
 method: 'POST', url: '/v1/projects/prj_1/bim-model/element-lookup',
 headers: { 'x-tenant-id': 'org_a' },
 payload: { x: 'a', y: 'b', z: 'c' },
 });
 assert.equal(res.statusCode, 400);
 });
});

describe('BIM HTTP — GET aligned-captures (FR-5)', () => {
 it('200 returns list', async () => {
 const model = makeModel('bim_001', 'org_a', 'prj_1', 'aligned');
 repo.listModels = async () => [model];
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/bim-model/aligned-captures', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.ok(Array.isArray(body.data));
 });
});

describe('BIM HTTP — GET diff (FR-6)', () => {
 it('200 with empty deviations when no points', async () => {
 const model = makeModel('bim_001', 'org_a', 'prj_1', 'ready');
 repo.findCurrentModel = async () => model;
 repo.listModels = async () => [model];
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/bim-model/diff?captureId=cap_001', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 200);
 const body = res.json();
 assert.equal(body.deviationCount, 0);
 });

 it('400 when captureId missing', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/projects/prj_1/bim-model/diff', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 400);
 });
});

describe('BIM HTTP — DELETE bim-model (FR-8)', () => {
 it('204 on successful delete', async () => {
 const model = makeModel('bim_001', 'org_a', 'prj_1', 'ready');
 repo.findModelById = async () => model;
 const res = await app.inject({ method: 'DELETE', url: '/v1/projects/prj_1/bim-model?modelId=bim_001', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 204);
 });

 it('404 when modelId missing (cross-tenant probe via null)', async () => {
 repo.findModelById = async () => null;
 const res = await app.inject({ method: 'DELETE', url: '/v1/projects/prj_1/bim-model?modelId=bim_nonexistent', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 404);
 });

 it('400 when modelId query param missing', async () => {
 const res = await app.inject({ method: 'DELETE', url: '/v1/projects/prj_1/bim-model', headers: { 'x-tenant-id': 'org_a' } });
 assert.equal(res.statusCode, 400);
 });
});

describe('BIM HTTP — /v1/health', () => {
 it('200 OK', async () => {
 const res = await app.inject({ method: 'GET', url: '/v1/health' });
 assert.equal(res.statusCode, 200);
 assert.equal(res.json().status, 'ok');
 });
});

function makeModel(id: string, orgId: string, projectId: string, state: 'new' | 'uploading' | 'validating' | 'ready' | 'aligned' | 'diffed' | 'failed'): BimModel {
 return {
 id, orgId, projectId,
 fileName: 'l.ifc',
 schemaVersion: 'IFC4X3',
 modelHash: 'abc',
 storageKey: 'bim/o/p/h.ifc',
 state,
 isCurrent: true,
 totalElements: 1,
 sizeBytes: 4096,
 createdBy: 'u',
 createdAt: new Date(),
 validatedAt: new Date(),
 deletedAt: null,
 };
}

// Silence CreateBimModelInput unused-import warning in some configs
void (null as unknown as CreateBimModelInput);
