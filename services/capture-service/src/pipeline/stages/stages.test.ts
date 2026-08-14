import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { makeStubStageRunner, allStageRunners, STAGES_IN_ORDER } from './index.js';
import { STAGES_IN_ORDER as ALL } from '../state-machine.js';

describe('makeStubStageRunner — per-stage', () => {
 for (const stage of ['decode', 'sfm', 'mesh', 'segment', 'align'] as const) {
 it(`${stage}: runs in ~30ms and returns artifacts={}`, async () => {
 const runner = makeStubStageRunner(stage);
 const before = Date.now();
 const result = await runner.run({
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_1',
 stage,
 attempt: 1,
 });
 const elapsed = Date.now() - before;
 assert.ok(elapsed >= 25 && elapsed < 200, `expected ~30ms, got ${elapsed}ms`);
 assert.deepEqual({ ...result, startedAt: undefined, finishedAt: undefined }, { artifacts: {}, startedAt: undefined, finishedAt: undefined });
 assert.ok(result.startedAt instanceof Date);
 assert.ok(result.finishedAt instanceof Date);
 assert.ok(result.finishedAt >= result.startedAt);
 });

 it(`${stage}: describe() returns the correct timeoutSeconds`, () => {
 const runner = makeStubStageRunner(stage);
 const desc = runner.describe();
 assert.equal(desc.name, `${stage}-stub`);
 assert.ok(desc.timeoutSeconds > 0);
 });

 it(`${stage}: attempt count is propagated to the runner`, async () => {
 let captured = 0;
 const custom = {
 async run(input: { attempt: number }): Promise<{ artifacts: Record<string, string> }> {
 captured = input.attempt;
 return { artifacts: {} };
 },
 describe() { return { name: 'custom', timeoutSeconds: 1 }; },
 };
 await custom.run({ attempt: 3 });
 assert.equal(captured, 3);
 });
 }
});

describe('allStageRunners — covers all 5 stages', () => {
 it('returns a runner for each stage in STAGES_IN_ORDER', () => {
 const runners = allStageRunners();
 for (const stage of ALL) {
 assert.ok(runners[stage], `missing runner for ${stage}`);
 }
 });

 it('stage order matches state machine order (Contract §V)', () => {
 assert.deepEqual(STAGES_IN_ORDER as readonly string[], ALL as readonly string[]);
 });
});
