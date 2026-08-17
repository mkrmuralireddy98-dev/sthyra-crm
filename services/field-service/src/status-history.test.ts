import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { recordStatusChange, type StatusHistoryRecorder } from './status-history.js';
import type { StatusHistoryEntry, IssueStatus } from './types.js';

function makeRecorder() {
 const entries: StatusHistoryEntry[] = [];
 let nextId = 1;
 const recorder: StatusHistoryRecorder = {
 async insert(entry) { entries.push(entry); },
 nextId: () => nextId++,
 };
 return { recorder, entries };
}

describe('recordStatusChange', () => {
 let recorder: StatusHistoryRecorder;
 let entries: StatusHistoryEntry[];

 beforeEach(() => {
 ({ recorder, entries } = makeRecorder());
 });

 it('writes an entry on a valid transition (open → in_progress)', async () => {
 const entry = await recordStatusChange(recorder, {
 orgId: 'org_a',
 issueId: 'iss_001',
 fromStatus: 'open' as IssueStatus,
 toStatus: 'in_progress' as IssueStatus,
 actorId: 'user_1',
 reason: null,
 });
 assert.ok(entry.id >= 1);
 assert.equal(entry.orgId, 'org_a');
 assert.equal(entry.issueId, 'iss_001');
 assert.equal(entry.fromStatus, 'open');
 assert.equal(entry.toStatus, 'in_progress');
 assert.equal(entry.actorId, 'user_1');
 assert.ok(entry.occurredAt instanceof Date);
 });

 it('appends to a history list (preserves chronological order)', async () => {
 await recordStatusChange(recorder, {
 orgId: 'org_a', issueId: 'iss_001', fromStatus: 'open', toStatus: 'in_progress', actorId: 'u1', reason: null,
 });
 await recordStatusChange(recorder, {
 orgId: 'org_a', issueId: 'iss_001', fromStatus: 'in_progress', toStatus: 'resolved', actorId: 'u1', reason: 'fixed',
 });
 assert.equal(entries.length, 2);
 assert.equal(entries[0]?.fromStatus, 'open');
 assert.equal(entries[1]?.fromStatus, 'in_progress');
 assert.equal(entries[1]?.reason, 'fixed');
 });

 it('preserves tenant scope (orgId is required)', async () => {
 const entry = await recordStatusChange(recorder, {
 orgId: 'org_b', issueId: 'iss_002', fromStatus: 'open', toStatus: 'resolved', actorId: 'u', reason: 'x',
 });
 assert.equal(entry.orgId, 'org_b');
 });

 it('increments ID monotonically across multiple recordings', async () => {
 const a = await recordStatusChange(recorder, {
 orgId: 'org_a', issueId: 'iss_1', fromStatus: 'open', toStatus: 'resolved', actorId: 'u', reason: 'x',
 });
 const b = await recordStatusChange(recorder, {
 orgId: 'org_a', issueId: 'iss_2', fromStatus: 'open', toStatus: 'resolved', actorId: 'u', reason: 'y',
 });
 assert.equal(b.id, a.id + 1);
 });
});
