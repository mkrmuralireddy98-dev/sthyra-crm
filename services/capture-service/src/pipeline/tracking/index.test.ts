import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { PipelineRunTracker, type PipelineRunRow } from './index.js';
import { initialState, transition } from '../state-machine.js';

interface FakeRepo {
 rows: PipelineRunRow[];
}

let tracker: PipelineRunTracker;
let fake: FakeRepo;

beforeEach(() => {
 fake = { rows: [] };
 tracker = new PipelineRunTracker({
 sink: async (row) => { fake.rows.push(row); },
 logger: () => {},
 });
});

describe('PipelineRunTracker — writes a row per transition', () => {
 it('writes a row on stage start', async () => {
 const s = transition(initialState(), { type: 'start' });
 await tracker.record(s, 'cap_001', 'org_a', 'prj_1');
 assert.equal(fake.rows.length, 1);
 const row = fake.rows[0]!;
 assert.equal(row.captureId, 'cap_001');
 assert.equal(row.orgId, 'org_a');
 assert.equal(row.stage, 'decode');
 assert.equal(row.status, 'running');
 assert.equal(row.attempt, 1);
 });

 it('writes a row on stage success', async () => {
 let s = transition(initialState(), { type: 'start' });
 s = transition(s, { type: 'stage-succeeded', stage: 'decode' });
 await tracker.record(s, 'cap_002', 'org_a', 'prj_1');
 // Note: the state machine auto-advances sfm to 'running', so the latest row
 // reflects the current (sfm) stage, not decode.
 const row = fake.rows[0]!;
 assert.equal(row.stage, 'sfm');
 assert.equal(row.status, 'running');
 });

 it('writes a row on pipeline completion (ready)', async () => {
 let s = transition(initialState(), { type: 'start' });
 s = transition(s, { type: 'stage-succeeded', stage: 'decode' });
 s = transition(s, { type: 'stage-succeeded', stage: 'sfm' });
 s = transition(s, { type: 'stage-succeeded', stage: 'mesh' });
 s = transition(s, { type: 'stage-succeeded', stage: 'segment' });
 s = transition(s, { type: 'stage-succeeded', stage: 'align' });
 await tracker.record(s, 'cap_003', 'org_a', 'prj_1');
 const last = fake.rows[0]!;
 assert.equal(last.status, 'succeeded');
 assert.equal(last.pipelineStatus, 'ready');
 });

 it('writes a row on pipeline failure with the failed stage', async () => {
 let s = transition(initialState(), { type: 'start' });
 s = transition(s, { type: 'stage-succeeded', stage: 'decode' });
 s = transition(s, { type: 'stage-failed', stage: 'sfm', error: 'GLOMAP exit 1' });
 await tracker.record(s, 'cap_004', 'org_a', 'prj_1');
 const row = fake.rows[0]!;
 assert.equal(row.pipelineStatus, 'failed');
 assert.equal(row.stage, 'sfm');
 assert.equal(row.status, 'failed');
 assert.equal(row.errorMessage, 'GLOMAP exit 1');
 });

 it('emits a structured log when the pipeline goes terminal (Constitution §observability)', async () => {
 const logged: Array<{ level: string; msg: string; fields: Record<string, unknown> }> = [];
 const trackingWithLog = new PipelineRunTracker({
 sink: async (row) => { fake.rows.push(row); },
 logger: (level, msg, fields) => logged.push({ level, msg, fields }),
 });
 let s = transition(initialState(), { type: 'start' });
 s = transition(s, { type: 'stage-succeeded', stage: 'decode' });
 s = transition(s, { type: 'stage-succeeded', stage: 'sfm' });
 s = transition(s, { type: 'stage-succeeded', stage: 'mesh' });
 s = transition(s, { type: 'stage-succeeded', stage: 'segment' });
 s = transition(s, { type: 'stage-succeeded', stage: 'align' });
 await trackingWithLog.record(s, 'cap_005', 'org_a', 'prj_1');
 assert.ok(logged.length >= 1);
 assert.match(logged[0]?.msg ?? '', /pipeline_ready/);
 assert.equal(logged[0]?.fields['captureId'], 'cap_005');
 });
});
