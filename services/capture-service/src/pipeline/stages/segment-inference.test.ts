import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { SegmentStage } from './segment-inference.js';
import type { SegmentInferenceClient } from './segment-client.js';

interface SegmentCall { meshPath: string; captureId: string; }
let calls: SegmentCall[];
let client: SegmentInferenceClient;
let stage: SegmentStage;

beforeEach(() => {
 calls = [];
 client = {
 async segment(input: { meshPath: string; captureId: string; }): Promise<{ segmentationPath: string; labels: string[] }> {
 calls.push(input);
 return {
 segmentationPath: `${input.meshPath}.segmented.json`,
 labels: ['wall', 'door', 'window', 'fixture', 'floor', 'ceiling'],
 };
 },
 };
 stage = new SegmentStage({ client, outputRoot: '/tmp/sthyra-crm/segment' });
});

describe('SegmentStage — HTTP inference client', () => {
 it('runs and returns segmentation artifacts', async () => {
 const result = await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_001', stage: 'segment', attempt: 1 });
 assert.ok(result.artifacts);
 });

 it('produces artifacts: { segmentationPath, labels[] }', async () => {
 const result = await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_002', stage: 'segment', attempt: 1 });
 const arts = result.artifacts as Record<string, string>;
 assert.ok(arts['segmentationPath']);
 assert.ok(arts['labels']);
 });

 it('input is the mesh path (per-capture)', async () => {
 await stage.run({ orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_seg', stage: 'segment', attempt: 1 });
 assert.match(calls[0]!.meshPath, /cap_seg/);
 });

 it('timeoutSeconds mirrors ASL (1800s)', () => {
 assert.equal(stage.describe().timeoutSeconds, 1800);
 });

 it('timeout from inference service is retryable (transient)', async () => {
 const slow: SegmentInferenceClient = {
 async segment(): Promise<{ segmentationPath: string; labels: string[] }> {
 throw Object.assign(new Error('Request timeout'), { retryable: true });
 },
 };
 const s = new SegmentStage({ client: slow, outputRoot: '/tmp' });
 try {
 await s.run({ orgId: 'o', projectId: 'p', captureId: 'c', stage: 'segment', attempt: 1 });
 assert.fail('should throw');
 } catch (err) {
 assert.equal((err as { retryable?: boolean }).retryable, true);
 }
 });

 it('schema mismatch (400) is non-retryable', async () => {
 const badInput: SegmentInferenceClient = {
 async segment(): Promise<{ segmentationPath: string; labels: string[] }> {
 throw Object.assign(new Error('400 Bad Request: mesh schema mismatch'), { retryable: false });
 },
 };
 const s = new SegmentStage({ client: badInput, outputRoot: '/tmp' });
 try {
 await s.run({ orgId: 'o', projectId: 'p', captureId: 'c', stage: 'segment', attempt: 1 });
 assert.fail('should throw');
 } catch (err) {
 assert.equal((err as { retryable?: boolean }).retryable, false);
 }
 });
});
