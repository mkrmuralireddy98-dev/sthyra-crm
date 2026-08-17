/**
 * FfmpegDecodeStage — replaces the 30ms stub `makeStubStageRunner('decode')`.
 *
 * Phase 1.b: real implementation. Takes a raw 360° mp4 from the upload
 * directory and demuxes it into per-frame images + an audio track.
 *
 * Output goes under a per-capture directory:
 *   {outputRoot}/org/{orgId}/project/{projectId}/capture/{captureId}/frames/
 *
 * Tenant boundary: the output directory contains org_id in its path
 * (defense in depth, even though the orchestrator dispatches in
 * org-scoped context already).
 */

import { join } from 'node:path';
import type { StageRunner } from './index.js';
import type { FfmpegRunner } from './ffmpeg-runner.js';

export interface FfmpegDecodeStageOptions {
 readonly runner: FfmpegRunner;
 readonly outputRoot?: string;
 readonly fps?: number;
}

export class FfmpegDecodeStage implements StageRunner {
 private readonly runner: FfmpegRunner;
 private readonly outputRoot: string;
 private readonly fps: number;

 constructor(opts: FfmpegDecodeStageOptions) {
 this.runner = opts.runner;
 this.outputRoot = opts.outputRoot ?? '/tmp/sthyra-crm/decoded';
 this.fps = opts.fps ?? 60;
 }

 describe() {
 return { name: 'decode-ffmpeg', timeoutSeconds: 1800 };
 }

 async run(input: { orgId: string; projectId: string; captureId: string }): Promise<{
 artifacts: Readonly<Record<string, string>>;
 startedAt: Date;
 finishedAt: Date;
 }> {
 const startedAt = new Date();
 // The video lives under the per-capture upload directory.
 // (Phase 1.b: this path is the concat'd result of the upload session.)
 const videoPath = join(
 this.outputRoot,
 'org', input.orgId,
 'project', input.projectId,
 'capture', input.captureId,
 'video.mp4',
 );
 const outputDir = join(
 this.outputRoot,
 'org', input.orgId,
 'project', input.projectId,
 'capture', input.captureId,
 );

 const result = await this.runner.run({
 videoPath,
 outputDir,
 fps: this.fps,
 });

 const finishedAt = new Date();
 return {
 artifacts: {
 framesDir: result.framesDir,
 frameCount: String(result.frameCount),
 durationSeconds: String(result.durationSeconds),
 },
 startedAt,
 finishedAt,
 };
 }
}
