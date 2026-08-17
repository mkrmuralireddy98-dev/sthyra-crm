/**
 * OpenMvsMeshStage — replaces the 30ms stub `makeStubStageRunner('mesh')`.
 * Takes the sfm sparse point cloud and produces a textured mesh.
 */

import { join } from 'node:path';
import type { StageRunner } from './index.js';
import type { OpenMvsRunner } from './openmvs-runner.js';

export interface OpenMvsMeshStageOptions {
 readonly runner: OpenMvsRunner;
 readonly outputRoot?: string;
}

export class OpenMvsMeshStage implements StageRunner {
 private readonly runner: OpenMvsRunner;
 private readonly outputRoot: string;

 constructor(opts: OpenMvsMeshStageOptions) {
 this.runner = opts.runner;
 this.outputRoot = opts.outputRoot ?? '/tmp/sthyra-crm/mesh';
 }

 describe() {
 return { name: 'mesh-openmvs', timeoutSeconds: 3600 };
 }

 async run(input: { orgId: string; projectId: string; captureId: string }): Promise<{
 artifacts: Readonly<Record<string, string>>;
 startedAt: Date;
 finishedAt: Date;
 }> {
 const startedAt = new Date();
 const sparseDir = join(this.outputRoot, 'org', input.orgId, 'project', input.projectId, 'capture', input.captureId, 'sparse');
 const outputDir = join(this.outputRoot, 'org', input.orgId, 'project', input.projectId, 'capture', input.captureId);
 const result = await this.runner.run({ sparseDir, outputDir });
 return {
 artifacts: {
 meshPath: result.meshPath,
 vertexCount: String(result.vertexCount),
 },
 startedAt,
 finishedAt: new Date(),
 };
 }
}
