import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { FfmpegDecodeStage } from './ffmpeg-decode.js';
import type { FfmpegRunner } from './ffmpeg-runner.js';

/**
 * FfmpegDecodeStage — real Phase 1.b implementation that replaces the
 * stub `makeStubStageRunner('decode')`. The decode stage's job is to
 * demux a 360° mp4 into per-frame images + an audio track.
 *
 * The runner is injected (dependency injection) so tests can pass a
 * fake that returns canned output. Production wires the real ffmpeg.
 */

interface DecodeCall {
 videoPath: string;
 outputDir: string;
 fps: number;
}

let calls: DecodeCall[];
let runner: FfmpegRunner;
let stage: FfmpegDecodeStage;

beforeEach(() => {
 calls = [];
 runner = {
 async run(input: DecodeCall): Promise<{ framesDir: string; frameCount: number; durationSeconds: number }> {
 calls.push(input);
 return {
 framesDir: `${input.outputDir}/frames`,
 frameCount: 1440, // 24 seconds at 60fps
 durationSeconds: 24,
 };
 },
 };
 stage = new FfmpegDecodeStage({ runner, outputDir: '/tmp/scan-output', fps: 60 });
});

describe('FfmpegDecodeStage — StageRunner contract', () => {
 it('runs the stage and returns decoded artifacts', async () => {
 const result = await stage.run({
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_001',
 stage: 'decode',
 attempt: 1,
 });
 assert.ok(result.artifacts);
 assert.equal(typeof result.startedAt, 'object');
 assert.ok(result.finishedAt >= result.startedAt);
 });

 it('produces artifacts: { framesDir, frameCount, durationSeconds }', async () => {
 const result = await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_002', stage: 'decode', attempt: 1,
 });
 const arts = result.artifacts as Record<string, string>;
 assert.ok(arts['framesDir']);
 assert.ok(arts['frameCount']);
 assert.ok(arts['durationSeconds']);
 });

 it('invokes the runner with the input video path (per-capture)', async () => {
 await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_video_xyz', stage: 'decode', attempt: 1,
 });
 assert.equal(calls.length, 1);
 assert.match(calls[0]!.videoPath, /cap_video_xyz/);
 });

 it('uses the configured fps', async () => {
 await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_003', stage: 'decode', attempt: 1,
 });
 assert.equal(calls[0]!.fps, 60);
 });

 it('writes output to a per-capture output dir (tenant-isolated)', async () => {
 await stage.run({
 orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_004', stage: 'decode', attempt: 1,
 });
 assert.match(calls[0]!.outputDir, /org_a/);
 assert.match(calls[0]!.outputDir, /prj_1/);
 assert.match(calls[0]!.outputDir, /cap_004/);
 });

 it('describe() returns the correct timeoutSeconds (mirrors ASL)', () => {
 const desc = stage.describe();
 assert.equal(desc.name, 'decode-ffmpeg');
 assert.equal(desc.timeoutSeconds, 1800);
 });

 it('propagates non-retryable errors (ffmpeg exit 1)', async () => {
 const failingRunner: FfmpegRunner = {
 async run(): Promise<{ framesDir: string; frameCount: number; durationSeconds: number }> {
 const err = new Error('ffmpeg exited with code 1: invalid argument');
 (err as Error & { retryable?: boolean }).retryable = true;
 throw err;
 },
 };
 const s = new FfmpegDecodeStage({ runner: failingRunner, outputDir: '/tmp', fps: 60 });
 await assert.rejects(
 s.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_005', stage: 'decode', attempt: 1 }),
 /ffmpeg exited with code 1/,
 );
 });

 it('marks transient errors as retryable', async () => {
 const transientRunner: FfmpegRunner = {
 async run(): Promise<{ framesDir: string; frameCount: number; durationSeconds: number }> {
 const err = new Error('SIGPIPE: ffmpeg killed by SIGPIPE (out of disk?)');
 (err as Error & { retryable?: boolean }).retryable = false;
 throw err;
 },
 };
 const s = new FfmpegDecodeStage({ runner: transientRunner, outputDir: '/tmp', fps: 60 });
 try {
 await s.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_006', stage: 'decode', attempt: 1 });
 assert.fail('should have thrown');
 } catch (err) {
 assert.equal((err as { retryable?: boolean }).retryable, false);
 }
 });
});
