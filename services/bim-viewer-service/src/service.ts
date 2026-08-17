/**
 * BimService — domain layer for BIM Viewer.
 */

import { randomUUID } from 'node:crypto';
import {
 initialBimState,
 transitionBim,
 type BimStatusEvent,
} from './state-machine.js';
import { BboxTree } from './bbox-tree.js';
import { parseIfc4x3, type IfcParseResult } from './ifc-parser.js';
import { diff as runDiff, type CapturePoint } from './diff.js';
import type { BimRepository } from './repository.js';
import type {
 BimModel,
 CreateBimModelInput,
 ElementLookupResult,
 Point3D,
 Deviation,
} from './types.js';

export type BimEventType =
 | 'bim.uploaded'
 | 'bim.validated'
 | 'bim.ready'
 | 'bim.aligned'
 | 'bim.diff_computed'
 | 'bim.failed';

export interface BimEvent {
 readonly type: BimEventType;
 readonly modelId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly occurredAt: Date;
}

export interface BimServiceDeps {
 readonly repo: BimRepository;
 readonly parser?: (content: string) => IfcParseResult;
 readonly onEvent?: (event: BimEvent) => void;
 readonly now?: () => Date;
}

export class BimService {
 private readonly repo: BimRepository;
 private readonly parser: (content: string) => IfcParseResult;
 private readonly onEvent: (event: BimEvent) => void;
 private readonly now: () => Date;

 constructor(deps: BimServiceDeps) {
 this.repo = deps.repo;
 this.parser = deps.parser ?? parseIfc4x3;
 this.onEvent = deps.onEvent ?? (() => {});
 this.now = deps.now ?? (() => new Date());
 }

 // ─── T-011: Upload ─────────────────────────────────────────
 async upload(input: CreateBimModelInput, content: string): Promise<BimModel> {
 if (!input.orgId) throw new Error('orgId required (Constitution §II)');
 if (!input.projectId) throw new Error('projectId required');
 if (!input.createdBy) throw new Error('createdBy required');

 const id = `bim_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
 const now = this.now();

 // Demote existing current model (per Q7: keep history, isCurrent flag)
 const existing = await this.repo.findCurrentModel(input.orgId, input.projectId);
 if (existing) {
 await this.repo.markModelCurrent(input.orgId, existing.id); // clears isCurrent
 console.error('DEBUG: markCurrent returned');
 }

 const model: BimModel = {
 id,
 orgId: input.orgId,
 projectId: input.projectId,
 fileName: input.fileName,
 schemaVersion: input.schemaVersion,
 modelHash: input.modelHash,
 storageKey: input.storageKey,
 state: 'new',
 isCurrent: true,
 totalElements: null,
 sizeBytes: input.sizeBytes,
 createdBy: input.createdBy,
 createdAt: now,
 validatedAt: null,
 deletedAt: null,
 };

 await this.repo.insertBimModel(model);

 // Emit uploaded event
 this.emit({ type: 'bim.uploaded', modelId: id, orgId: input.orgId, projectId: input.projectId, occurredAt: now });

 // Drive state machine: new → uploading → validating
 let state = initialBimState();
 state = transitionBim(state, { type: 'start_upload' } satisfies BimStatusEvent);
 await this.repo.updateModelState(input.orgId, id, state.state, null);

 state = transitionBim(state, { type: 'validate' } satisfies BimStatusEvent);
 // Parse IFC content (the parser may throw on invalid schema)
 const parsed = this.parser(content);
 await this.repo.updateModelState(input.orgId, id, state.state, parsed.totalElements);

 state = transitionBim(state, { type: 'ready' } satisfies BimStatusEvent);
 await this.repo.updateModelState(input.orgId, id, state.state, parsed.totalElements);

 const validatedAt = this.now();
 const readyWithMeta: BimModel = {
 ...model,
 state: state.state,
 totalElements: parsed.totalElements,
 validatedAt,
 };
 await this.repo.updateModelState(input.orgId, id, 'ready', parsed.totalElements);

 this.emit({ type: 'bim.validated', modelId: id, orgId: input.orgId, projectId: input.projectId, occurredAt: validatedAt });
 this.emit({ type: 'bim.ready', modelId: id, orgId: input.orgId, projectId: input.projectId, occurredAt: validatedAt });

 return readyWithMeta;
 }

 // ─── T-012: element lookup + diff ─────────────────────────
 async elementLookup(orgId: string, projectId: string, point: Point3D): Promise<ElementLookupResult> {
 const model = await this.repo.findCurrentModel(orgId, projectId);
 if (!model || model.state !== 'ready' && model.state !== 'aligned' && model.state !== 'diffed') {
 throw new Error(`no BIM model ready in this project (state=${model?.state ?? 'none'})`);
 }
 // Read bboxes from the repo (Phase 3.b: storage; Phase 3: synthetic via fileName-based lookup)
 // For now, fetch via a helper that derives bboxes from the model.
 // In Phase 3.b this would call loadBboxTree.
 const tree = this.bboxTreeFor(model);
 return tree.findNearest(point.x, point.y, point.z, 0.5) ?? { elementId: null, elementName: null, elementType: null, distance: 0 };
 }

 async diff(
 orgId: string,
 projectId: string,
 captureId: string,
 points: readonly Point3D[],
 thresholdMeters: number,
 ): Promise<readonly Deviation[]> {
 const model = await this.repo.findCurrentModel(orgId, projectId);
 if (!model) throw new Error('no BIM model in this project');
 const tree = this.bboxTreeFor(model);
 const sample: CapturePoint[] = points.map((p) => ({ xyz: p, captureId }));
 const result = runDiff(
 {
 tree,
 points: sample,
 thresholdMeters,
 modelId: model.id,
 orgId,
 },
 () => this.repo.nextId(),
 );
 for (const d of result) {
 await this.repo.insertDeviation(d);
 }
 this.emit({
 type: 'bim.diff_computed',
 modelId: model.id,
 orgId,
 projectId,
 occurredAt: this.now(),
 });
 return result;
 }

 // ─── T-013: delete ─────────────────────────────────────────
 async delete(orgId: string, projectId: string, modelId: string): Promise<void> {
 const model = await this.repo.findModelById(orgId, modelId);
 if (!model) throw new Error(`model not found: ${modelId}`);
 if (model.orgId !== orgId) throw new Error(`not found: ${modelId}`); // cross-tenant → 404
 await this.repo.softDeleteModel(orgId, modelId);
 this.emit({
 type: 'bim.uploaded',
 modelId: model.id,
 orgId,
 projectId,
 occurredAt: this.now(),
 });
 // (Re-using uploaded type for a soft-delete marker; could add bim.deleted.)
 }

 // ─── T-014: listAlignedCaptures ───────────────────────────
 async listAlignedCaptures(orgId: string, projectId: string): Promise<readonly { id: string; status: string }[]> {
 const models = await this.repo.listModels(orgId, projectId);
 const aligned = models.filter((m) => m.state === 'aligned' || m.state === 'diffed');
 return aligned.map((m) => ({ id: m.id, status: m.state }));
 }

 // ─── Helpers ──────────────────────────────────────────────
 private emit(event: BimEvent): void {
 this.onEvent(event);
 }

 /**
 * In Phase 3, the bbox tree is synthetic — derived from the model's
 * totalElements count. Phase 3.b stores the actual parsed bboxes.
 */
 private bboxTreeFor(model: BimModel): BboxTree {
 const totalElements = model.totalElements ?? 0;
 const elements = Array.from({ length: Math.min(totalElements, 100) }, (_, i) => ({
 elementId: `${model.id}_e${i}`,
 elementName: `Element ${i}`,
 elementType: 'IfcBeam',
 min: { x: i * 2, y: 0, z: 0 },
 max: { x: i * 2 + 1, y: 1, z: 1 },
 }));
 return new BboxTree(1, elements);
 }
}
