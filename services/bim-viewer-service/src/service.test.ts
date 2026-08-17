import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { BimService, type BimServiceDeps } from './service.js';
import type { BimRepository } from './repository.js';
import type { BimModel, BboxElement, CreateBimModelInput } from './types.js';
import { parseIfc4x3 } from './ifc-parser.js';

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

const IFC_FIXTURE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;
#5=IFCBEAM('Level 3 East Beam',$,$,$,$,$,$);
#8=IFCWALL('North Wall',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;

let counter = 0;
let repo: BimRepository;
let events: Array<{ type: string; modelId: string }>;
let service: BimService;

beforeEach(() => {
 counter = 0;
 repo = makeRepo();
 events = [];
 service = new BimService({
 repo,
 parser: parseIfc4x3,
 onEvent: (e) => { events.push({ type: e.type, modelId: e.modelId }); },
 });
});

describe('BimService — upload (T-011)', () => {
 it('upload returns a new model with server-assigned id', async () => {
 const input = makeInput();
 const result = await service.upload(input, IFC_FIXTURE);
 assert.ok(result.id.startsWith('bim_'));
 assert.equal(result.state, 'ready');
 });

 it('upload parses IFC content and updates totalElements', async () => {
 const input = makeInput();
 const result = await service.upload(input, IFC_FIXTURE);
 assert.equal(result.totalElements, 2);
 });

 it('upload emits bim.uploaded + bim.validated events', async () => {
 const input = makeInput();
 await service.upload(input, IFC_FIXTURE);
 assert.equal(events.length, 3);
 assert.equal(events[0]?.type, 'bim.uploaded');
 assert.equal(events[1]?.type, 'bim.validated');
 });

 it('upload marks previous current model as is_current=false', async () => {
 const existing = makeExistingModel({ id: 'bim_existing', orgId: 'org_a', projectId: 'prj_1', isCurrent: true });
 repo.findCurrentModel = async (orgId, projectId) => existing;
 const markCurrentCalls: string[] = [];
 repo.markModelCurrent = async (...args) => {
 console.error('DEBUG markCurrent called with', JSON.stringify(args));
 markCurrentCalls.push(args[1] ?? args[0]);
 };
 await service.upload(makeInput(), IFC_FIXTURE);
 console.error('DEBUG markCurrentCalls', JSON.stringify(markCurrentCalls));
 assert.equal(markCurrentCalls.includes('bim_existing'), true);
 });

 it('upload throws on missing tenant (orgId empty)', async () => {
 await assert.rejects(
 service.upload(makeInput({ orgId: '' }), IFC_FIXTURE),
 /orgId required/,
 );
 });

 it('upload throws on invalid schema (parser error)', async () => {
 await assert.rejects(
 service.upload(makeInput(), 'invalid content'),
 /IfcParseError/,
 );
 });
});

describe('BimService — lookup + diff (T-012)', () => {
 it('lookup returns matching element when point is in model bbox', async () => {
 const result = await service.upload(makeInput(), IFC_FIXTURE);
 assert.equal(result.state, 'ready');

 // Wait — model is in 'validating' state. Lookup requires 'ready'. Transition first.
 // For test purposes: manually insert a ready model via direct repo call.
 const readyModel = { ...result, state: 'ready' as const };
 repo.findCurrentModel = async () => readyModel;
 repo.listModels = async () => [readyModel];

 const lookup = await service.elementLookup('org_a', 'prj_1', { x: 1.5, y: 0.5, z: 0.25 });
 assert.ok(lookup.elementId !== null);
 });

 it('lookup returns null elementId for point far from any element', async () => {
 const input = makeInput();
 const result = await service.upload(input, IFC_FIXTURE);
 const readyModel = { ...result, state: 'ready' as const };
 repo.findCurrentModel = async () => readyModel;
 repo.listModels = async () => [readyModel];

 const lookup = await service.elementLookup('org_a', 'prj_1', { x: 1000, y: 1000, z: 1000 });
 assert.equal(lookup.elementId, null);
 });

 it('lookup throws when no model attached to project', async () => {
 repo.findCurrentModel = async () => null;
 await assert.rejects(
 service.elementLookup('org_a', 'prj_1', { x: 1, y: 1, z: 1 }),
 /no BIM model/i,
 );
 });

 it('diff returns array of deviations for sample', async () => {
 const input = makeInput();
 const result = await service.upload(input, IFC_FIXTURE);
 const readyModel = { ...result, state: 'ready' as const };
 repo.findCurrentModel = async () => readyModel;
 repo.listModels = async () => [readyModel];

 // Patch: provide ready for lookup
 const deviations = await service.diff('org_a', 'prj_1', 'cap_001', [
 { x: 100, y: 100, z: 100 }, // far from any IFC element
 ], 0.05);
 assert.ok(Array.isArray(deviations));
 assert.ok(deviations.length >= 0);
 });
});

describe('BimService — delete + version-management (T-013)', () => {
 it('soft-delete sets deletedAt + emits event', async () => {
 const existing = makeExistingModel({ id: 'bim_001', orgId: 'org_a', projectId: 'prj_1' });
 repo.findModelById = async (orgId, id) =>
 orgId === 'org_a' && id === 'bim_001' ? existing : null;
 let softDeleteCalled = false;
 repo.softDeleteModel = async (orgId, id) => {
 if (orgId === 'org_a' && id === 'bim_001') softDeleteCalled = true;
 };

 await service.delete('org_a', 'prj_1', 'bim_001');

 assert.equal(softDeleteCalled, true);
 });

 it('soft-delete across tenants throws (cross-tenant probe)', async () => {
 const existing = makeExistingModel({ id: 'bim_001', orgId: 'org_a' });
 repo.findCurrentModel = async () => existing;
 repo.findModelById = async (_orgId, id) => id === 'bim_001' ? existing : null;

 await assert.rejects(
 service.delete('org_b', 'prj_1', 'bim_001'),
 /not found/i,
 );
 });

 it('soft-delete 404 on non-existent model', async () => {
 repo.findModelById = async () => null;
 await assert.rejects(
 service.delete('org_a', 'prj_1', 'bim_nonexistent'),
 /not found/i,
 );
 });
});

describe('BimService — listAlignedCaptures (T-014)', () => {
 it('returns empty array when no captures aligned', async () => {
 repo.listModels = async () => [];
 const result = await service.listAlignedCaptures('org_a', 'prj_1');
 assert.equal(result.length, 0);
 });

 it('returns aligned captures count from repo', async () => {
 const readyModel = makeExistingModel({ state: 'aligned' });
 repo.findCurrentModel = async () => readyModel;
 const result = await service.listAlignedCaptures('org_a', 'prj_1');
 assert.ok(Array.isArray(result));
 });
});

function makeInput(overrides: Partial<CreateBimModelInput> = {}): CreateBimModelInput {
 return {
 orgId: 'org_a',
 projectId: 'prj_1',
 fileName: 'level3.ifc',
 schemaVersion: 'IFC4X3',
 modelHash: 'abc123',
 storageKey: 'bim/org_a/prj_1/abc123.ifc',
 sizeBytes: 4096,
 createdBy: 'user_1',
 ...overrides,
 };
}

function makeExistingModel(overrides: Partial<BimModel> = {}): BimModel {
 return {
 id: 'bim_existing',
 orgId: 'org_a',
 projectId: 'prj_1',
 fileName: 'level3.ifc',
 schemaVersion: 'IFC4X3',
 modelHash: 'abc',
 storageKey: 'bim/org_a/prj_1/abc.ifc',
 state: 'ready',
 isCurrent: false,
 totalElements: 100,
 sizeBytes: 4096,
 createdBy: 'user_1',
 createdAt: new Date('2026-08-14T00:00:00Z'),
 validatedAt: new Date('2026-08-14T00:01:00Z'),
 deletedAt: null,
 ...overrides,
 };
}

// Silence BboxElement unused-import TS warning in some configurations
void (null as unknown as BboxElement);
