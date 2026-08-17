/**
 * SegmentStage — replaces the 30ms stub `makeStubStageRunner('segment')`.
 *
 * Phase 1.b: real implementation. Takes the dense mesh from the mesh
 * stage and POSTs it to an ML inference endpoint that returns a
 * semantic segmentation of the mesh (walls, doors, fixtures, etc.).
 */

import { join } from 'node:path';
import type { StageRunner } from './index.js';
import type { SegmentInferenceClient } from './segment-client.js';

export interface SegmentStageOptions {
 readonly client: SegmentInferenceClient;
 readonly outputRoot?: string;
}

export class SegmentStage implements StageRunner {
 private readonly client: SegmentInferenceClient;
 private readonly outputRoot: string;

 constructor(opts: SegmentStageOptions) {
 this.client = opts.client;
 this.outputRoot = opts.outputRoot ?? '/tmp/sthyra-crm/segment';
 }

 describe() {
 return { name: 'segment-inference', timeoutSeconds: 1800 };
 }

 async run(input: { orgId: string; projectId: string; captureId: string }): Promise<{
 artifacts: Readonly<Record<string, string>>;
 startedAt: Date;
 finishedAt: Date;
 }> {
 const startedAt = new Date();
 const meshPath = join(this.outputRoot, 'org', input.orgId, 'project', input.projectId, 'capture', input.captureId, 'mesh.ply');
 const result = await this.client.segment({ meshPath, captureId: input.captureId });
 return {
 artifacts: {
 segmentationPath: result.segmentationPath,
 labels: JSON.stringify(result.labels),
 },
 startedAt,
 finishedAt: new Date(),
 };
 }
}
