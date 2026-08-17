import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { IcpAlignStage } from './icp-align.js';
import type { IcpRunner } from './icp-runner.js';

interface AlignCall { meshPath: string; bimPath: string | null; }
let calls: AlignCall[];
let runner: IcpRunner;
let stage: IcpAlignStage;

beforeEach(() => {
 calls = [];
 runner = {
 async align(input: AlignCall): Promise<{ transformPath: string; fitness: number; inlier_rmse: number }> {
 calls.push(input);
 return { transformPath: `${input.meshPath}.transform.json`, fitness: 0.95, inlier_rmse: 0.012 };
 },
 };
 stage = new IcpAlignStage({ runner, outputRoot: '/tmp/sthyra-crm/align', bimPath: '/tmp/bim.ifc' });
});

describe('IcpAlignStage', () => {
 it('runs and returns alignment artifacts', async () => {
 const result = await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_001', stage: 'align', attempt: 1 });
 assert.ok(result.artifacts);
 });

 it('produces artifacts: { transformPath, fitness, inlier_rmse }', async () => {
 const result = await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_002', stage: 'align', attempt: 1 });
 const arts = result.artifacts as Record<string, string>;
 assert.ok(arts['transformPath']);
 assert.ok(arts['fitness']);
 assert.ok(arts['inlier_rmse']);
 });

 it('input is the segmented mesh path (per-capture)', async () => {
 await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_align', stage: 'align', attempt: 1 });
 assert.match(calls[0]!.meshPath, /cap_align/);
 });

 it('skips ICP gracefully when no BIM model exists (returns identity)', async () => {
 const s = new IcpAlignStage({ runner, outputRoot: '/tmp', bimPath: null });
 const result = await s.run({ orgId: 'o', projectId: 'p', captureId: 'c', stage: 'align', attempt: 1 });
 const arts = result.artifacts as Record<string, string>;
 assert.equal(arts['fitness'], '1');
 });

 it('timeoutSeconds mirrors ASL (1200s)', () => {
 assert.equal(stage.describe().timeoutSeconds, 1200);
 });

 it('convergence failure is retryable (ICP has many local minima)', async () => {
 const t: IcpRunner = {
 async align(): Promise<{ transformPath: string; fitness: number; inlier_rmse: number }> {
 throw Object.assign(new Error('ICP failed to converge'), { retryable: true });
 },
 };
 const s = new IcpAlignStage({ runner: t, outputRoot: '/tmp', bimPath: '/tmp/bim.ifc' });
 try {
 await s.run({ orgId: 'o', projectId: 'p', captureId: 'c', stage: 'align', attempt: 1 });
 assert.fail('should throw');
 } catch (err) {
 assert.equal((err as { retryable?: boolean }).retryable, true);
 }
 });
});
