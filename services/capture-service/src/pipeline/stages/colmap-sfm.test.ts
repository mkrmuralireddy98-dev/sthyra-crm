import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { ColmapSfmStage } from './colmap-sfm.js';
import type { ColmapRunner } from './colmap-runner.js';

/**
 * ColmapSfmStage — real Phase 1.b implementation that replaces the
 * 30ms stub `makeStubStageRunner('sfm')`. The sfm stage's job is to
 * run structure-from-motion on the decoded frames and produce a
 * sparse point cloud + camera poses.
 *
 * Output artifacts:
 *   {outputDir}/sparse/cameras.txt
 *   {outputDir}/sparse/images.txt
 *   {outputDir}/sparse/points3D.txt
 *
 * The runner is dependency-injected so tests pass a fake.
 */

interface SfmCall {
 framesDir: string;
 outputDir: string;
 quality: 'low' | 'medium' | 'high';
}

let calls: SfmCall[];
let runner: ColmapRunner;
let stage: ColmapSfmStage;

beforeEach(() => {
 calls = [];
 runner = {
 async run(input: SfmCall): Promise<{ sparseDir: string; pointCount: number; imageCount: number }> {
 calls.push(input);
 return {
 sparseDir: `${input.outputDir}/sparse`,
 pointCount: 8421,
 imageCount: 1440,
 };
 },
 };
 stage = new ColmapSfmStage({ runner, outputRoot: '/tmp/sthyra-crm/sfm', quality: 'medium' });
});

describe('ColmapSfmStage — StageRunner contract', () => {
 it('runs the stage and returns sfm artifacts', async () => {
 const result = await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_001', stage: 'sfm', attempt: 1,
 });
 assert.ok(result.artifacts);
 assert.ok(result.startedAt instanceof Date);
 assert.ok(result.finishedAt >= result.startedAt);
 });

 it('produces artifacts: { sparseDir, pointCount, imageCount }', async () => {
 const result = await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_002', stage: 'sfm', attempt: 1,
 });
 const arts = result.artifacts as Record<string, string>;
 assert.ok(arts['sparseDir']);
 assert.ok(arts['pointCount']);
 assert.ok(arts['imageCount']);
 });

 it('invokes the runner with the per-capture frames dir', async () => {
 await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_xyz', stage: 'sfm', attempt: 1,
 });
 assert.equal(calls.length, 1);
 assert.match(calls[0]!.framesDir, /cap_xyz/);
 });

 it('uses the configured quality (medium default)', async () => {
 await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_003', stage: 'sfm', attempt: 1,
 });
 assert.equal(calls[0]!.quality, 'medium');
 });

 it('writes output to a per-capture output dir (tenant-isolated)', async () => {
 await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_004', stage: 'sfm', attempt: 1,
 });
 assert.match(calls[0]!.outputDir, /org_a/);
 assert.match(calls[0]!.outputDir, /prj_1/);
 assert.match(calls[0]!.outputDir, /cap_004/);
 });

 it('describe() returns the correct timeoutSeconds (mirrors ASL: 3600s)', () => {
 const desc = stage.describe();
 assert.equal(desc.name, 'sfm-colmap');
 assert.equal(desc.timeoutSeconds, 3600);
 });

 it('propagates non-retryable errors (COLMAP no recoverable features)', async () => {
 const failing: ColmapRunner = {
 async run(): Promise<{ sparseDir: string; pointCount: number; imageCount: number }> {
 throw Object.assign(new Error('No features extracted from images'), { retryable: false });
 },
 };
 const s = new ColmapSfmStage({ runner: failing, outputRoot: '/tmp' });
 await assert.rejects(
 s.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_005', stage: 'sfm', attempt: 1 }),
 /No features/,
 );
 });

 it('marks transient errors (CUDA OOM) as retryable', async () => {
 const transient: ColmapRunner = {
 async run(): Promise<{ sparseDir: string; pointCount: number; imageCount: number }> {
 throw Object.assign(new Error('CUDA out of memory'), { retryable: true });
 },
 };
 const s = new ColmapSfmStage({ runner: transient, outputRoot: '/tmp' });
 try {
 await s.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_006', stage: 'sfm', attempt: 1 });
 assert.fail('should have thrown');
 } catch (err) {
 assert.equal((err as { retryable?: boolean }).retryable, true);
 }
 });

 it('different qualities route through the same runner (configuration only)', async () => {
 const sHigh = new ColmapSfmStage({ runner, outputRoot: '/tmp', quality: 'high' });
 const sLow = new ColmapSfmStage({ runner, outputRoot: '/tmp', quality: 'low' });
 await sHigh.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_007', stage: 'sfm', attempt: 1 });
 await sLow.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_007', stage: 'sfm', attempt: 1 });
 assert.equal(calls[1]?.quality, 'low');
 });
});
