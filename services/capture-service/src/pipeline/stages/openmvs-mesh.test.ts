import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { OpenMvsMeshStage } from './openmvs-mesh.js';
import type { OpenMvsRunner } from './openmvs-runner.js';

interface MeshCall { sparseDir: string; outputDir: string; }
let calls: MeshCall[];
let runner: OpenMvsRunner;
let stage: OpenMvsMeshStage;

beforeEach(() => {
 calls = [];
 runner = {
 async run(input: MeshCall): Promise<{ meshPath: string; vertexCount: number }> {
 calls.push(input);
 return { meshPath: `${input.outputDir}/mesh.ply`, vertexCount: 250_000 };
 },
 };
 stage = new OpenMvsMeshStage({ runner, outputRoot: '/tmp/sthyra-crm/mesh' });
});

describe('OpenMvsMeshStage', () => {
 it('runs and returns mesh artifacts', async () => {
 const result = await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_001', stage: 'mesh', attempt: 1 });
 assert.ok(result.artifacts);
 assert.ok(result.startedAt instanceof Date);
 });

 it('produces artifacts: { meshPath, vertexCount }', async () => {
 const result = await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_002', stage: 'mesh', attempt: 1 });
 const arts = result.artifacts as Record<string, string>;
 assert.ok(arts['meshPath']);
 assert.ok(arts['vertexCount']);
 });

 it('input is the sfm sparse dir (per-capture)', async () => {
 await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_mesh', stage: 'mesh', attempt: 1 });
 assert.match(calls[0]!.sparseDir, /cap_mesh/);
 });

 it('writes output under per-capture dir (tenant isolated)', async () => {
 await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_mesh2', stage: 'mesh', attempt: 1 });
 assert.match(calls[0]!.outputDir, /org_a/);
 assert.match(calls[0]!.outputDir, /cap_mesh2/);
 });

 it('timeoutSeconds mirrors ASL (3600s)', () => {
 assert.equal(stage.describe().timeoutSeconds, 3600);
 });

 it('CUDA OOM is retryable', async () => {
 const t: OpenMvsRunner = {
 async run(): Promise<{ meshPath: string; vertexCount: number }> {
 throw Object.assign(new Error('CUDA OOM'), { retryable: true });
 },
 };
 const s = new OpenMvsMeshStage({ runner: t, outputRoot: '/tmp' });
 try {
 await s.run({ orgId: 'o', projectId: 'p', captureId: 'c', stage: 'mesh', attempt: 1 });
 assert.fail('should throw');
 } catch (err) {
 assert.equal((err as { retryable?: boolean }).retryable, true);
 }
 });
});
