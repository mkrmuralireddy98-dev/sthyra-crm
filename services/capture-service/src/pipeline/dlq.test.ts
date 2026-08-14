import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { DLQ, type DLQEntry } from './dlq.js';
import { initialState, transition } from './state-machine.js';

interface FakeSink {
 entries: DLQEntry[];
 logError: (level: 'error', msg: string, fields: Record<string, unknown>) => void;
}

let sink: FakeSink;
let dlq: DLQ;

beforeEach(() => {
 sink = {
 entries: [],
 logError: (_level, _msg, _fields) => {
 // captured via this.records but for simplicity, no-op here
 },
 };
 sink = {
 ...sink,
 entries: [],
 logError: sink.logError,
 };
 dlq = new DLQ({
 sink: async (entry) => { sink.entries.push(entry); },
 logger: sink.logError,
 });
});

describe('DLQ — record failure', () => {
 it('records a DLQ entry with captureId + stage + error + attempts', async () => {
 const state = initialState();
 let s = transition(state, { type: 'start' });
 s = transition(s, { type: 'stage-failed', stage: 'decode', error: 'GLOMAP exit 1', retry: true });
 s = transition(s, { type: 'stage-failed', stage: 'decode', error: 'GLOMAP exit 1', retry: true });
 s = transition(s, { type: 'stage-failed', stage: 'decode', error: 'GLOMAP exit 1' });
 // Now the pipeline is in 'failed' state — DLQ it.
 await dlq.record(s, 'cap_001', 'org_a');
 assert.equal(sink.entries.length, 1);
 const entry = sink.entries[0]!;
 assert.equal(entry.captureId, 'cap_001');
 assert.equal(entry.orgId, 'org_a');
 assert.equal(entry.stage, 'decode');
 assert.equal(entry.error, 'GLOMAP exit 1');
 assert.equal(entry.attempt, 3);
 });

 it('records the occurredAt timestamp', async () => {
 // Full pipeline progression: start each stage, succeed it, then fail sfm.
 let s = transition(initialState(), { type: 'start' });
 s = transition(s, { type: 'stage-succeeded', stage: 'decode' });
 // State machine auto-advances sfm to running. Fail it.
 s = transition(s, { type: 'stage-failed', stage: 'sfm', error: 'segfault' });
 await dlq.record(s, 'cap_2', 'org_a');
 const entry = sink.entries[0]!;
 assert.ok(entry.occurredAt instanceof Date);
 });

 it('does NOT record for non-failed states (defensive)', async () => {
 const state = initialState(); // pending, no failures
 await dlq.record(state, 'cap_3', 'org_a');
 assert.equal(sink.entries.length, 0);
 });

 it('emits a CloudWatch-style error log on DLQ entry', async () => {
 const logged: Array<{ level: string; msg: string; fields: Record<string, unknown> }> = [];
 const customDlq = new DLQ({
 sink: async () => {},
 logger: (level, msg, fields) => logged.push({ level, msg, fields }),
 });
 // Full pipeline progression through decode + sfm, then start + fail mesh
 let s = transition(initialState(), { type: 'start' });
 s = transition(s, { type: 'stage-succeeded', stage: 'decode' });
 s = transition(s, { type: 'stage-succeeded', stage: 'sfm' });
 // State machine auto-advances mesh to running. Fail it.
 s = transition(s, { type: 'stage-failed', stage: 'mesh', error: 'OOM' });
 await customDlq.record(s, 'cap_4', 'org_a');
 assert.equal(logged.length, 1);
 assert.equal(logged[0]?.level, 'error');
 assert.match(logged[0]?.msg ?? '', /dlq/);
 assert.equal(logged[0]?.fields['captureId'], 'cap_4');
 });
});
