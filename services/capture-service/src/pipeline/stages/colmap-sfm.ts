/**
 * ColmapSfmStage — replaces the 30ms stub `makeStubStageRunner('sfm')`.
 *
 * Phase 1.b: real implementation. Takes decoded frames from the decode
 * stage and runs structure-from-motion to produce a sparse point cloud.
 *
 * Output:
 *   {outputRoot}/org/{orgId}/project/{projectId}/capture/{captureId}/sparse/
 *     cameras.txt, images.txt, points3D.txt
 *
 * The sfm stage is the longest-running stage in the pipeline (3600s
 * timeout per pipeline.asl.json) and the most GPU-intensive.
 */

import { join } from 'node:path';
import type { StageRunner } from './index.js';
import type { ColmapRunner, ColmapQuality } from './colmap-runner.js';

export interface ColmapSfmStageOptions {
 readonly runner: ColmapRunner;
 readonly outputRoot?: string;
 readonly quality?: ColmapQuality;
}

export class ColmapSfmStage implements StageRunner {
 private readonly runner: ColmapRunner;
 private readonly outputRoot: string;
 private readonly quality: ColmapQuality;

 constructor(opts: ColmapSfmStageOptions) {
 this.runner = opts.runner;
 this.outputRoot = opts.outputRoot ?? '/tmp/sthyra-crm/sfm';
 this.quality = opts.quality ?? 'medium';
 }

 describe() {
 return { name: 'sfm-colmap', timeoutSeconds: 3600 };
 }

 async run(input: { orgId: string; projectId: string; captureId: string }): Promise<{
 artifacts: Readonly<Record<string, string>>;
 startedAt: Date;
 finishedAt: Date;
 }> {
 const startedAt = new Date();
 const framesDir = join(
 this.outputRoot,
 'org', input.orgId,
 'project', input.projectId,
 'capture', input.captureId,
 'frames',
 );
 const outputDir = join(
 this.outputRoot,
 'org', input.orgId,
 'project', input.projectId,
 'capture', input.captureId,
 );

 const result = await this.runner.run({
 framesDir,
 outputDir,
 quality: this.quality,
 });

 const finishedAt = new Date();
 return {
 artifacts: {
 sparseDir: result.sparseDir,
 pointCount: String(result.pointCount),
 imageCount: String(result.imageCount),
 },
 startedAt,
 finishedAt,
 };
 }
}
