/**
 * IcpAlignStage — replaces the 30ms stub `makeStubStageRunner('align')`.
 *
 * Phase 1.b: real implementation. Takes the segmented mesh and aligns
 * it to the project\'s BIM model (if one exists). When no BIM is
 * available, returns an identity transform (alignment is a no-op).
 */

import { join } from 'node:path';
import type { StageRunner } from './index.js';
import type { IcpRunner } from './icp-runner.js';

export interface IcpAlignStageOptions {
 readonly runner: IcpRunner;
 readonly outputRoot?: string;
 readonly bimPath?: string | null;
}

export class IcpAlignStage implements StageRunner {
 private readonly runner: IcpRunner;
 private readonly outputRoot: string;
 private readonly bimPath: string | null;

 constructor(opts: IcpAlignStageOptions) {
 this.runner = opts.runner;
 this.outputRoot = opts.outputRoot ?? '/tmp/sthyra-crm/align';
 this.bimPath = opts.bimPath ?? null;
 }

 describe() {
 return { name: 'align-icp', timeoutSeconds: 1200 };
 }

 async run(input: { orgId: string; projectId: string; captureId: string }): Promise<{
 artifacts: Readonly<Record<string, string>>;
 startedAt: Date;
 finishedAt: Date;
 }> {
 const startedAt = new Date();
 const meshPath = join(this.outputRoot, 'org', input.orgId, 'project', input.projectId, 'capture', input.captureId, 'mesh.segmented.ply');
 const outputPath = join(this.outputRoot, 'org', input.orgId, 'project', input.projectId, 'capture', input.captureId);

 // No BIM → identity transform (alignment is a no-op when no reference)
 if (this.bimPath === null) {
 return {
 artifacts: {
 transformPath: outputPath + '/identity-transform.json',
 fitness: '1',
 inlier_rmse: '0',
 },
 startedAt,
 finishedAt: new Date(),
 };
 }

 const result = await this.runner.align({ meshPath, bimPath: this.bimPath });
 return {
 artifacts: {
 transformPath: result.transformPath,
 fitness: String(result.fitness),
 inlier_rmse: String(result.inlier_rmse),
 },
 startedAt,
 finishedAt: new Date(),
 };
 }
}
