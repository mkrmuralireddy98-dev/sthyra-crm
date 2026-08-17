import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { diff, type CapturePoint } from './diff.js';
import { BboxTree, type BboxElement } from './bbox-tree.js';

const makeTree = (elements: BboxElement[]) => new BboxTree(1, elements);
const makePoint = (x: number, y: number, z: number, captureId = 'cap_1'): CapturePoint => ({
 xyz: { x, y, z },
 captureId,
});

let counter = 0;
const nextId = () => ++counter;

describe('Diff scanner (T-009)', () => {
 it('all points inside model: no orphans', () => {
 const tree = makeTree([
 { elementId: 'b1', elementName: 'Beam 1', elementType: 'IfcBeam', min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 1, z: 1 } },
 ]);
 const points = [makePoint(0.5, 0.5, 0.5), makePoint(1, 0.5, 0.5)];
 const result = diff({ tree, points, thresholdMeters: 0.05, modelId: 'm1', orgId: 'org_a' }, nextId);
 assert.equal(result.length, 0);
 });

 it('point outside any element within threshold: orphan deviation', () => {
 const tree = makeTree([
 { elementId: 'b1', elementName: 'Beam 1', elementType: 'IfcBeam', min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
 ]);
 const points = [makePoint(5, 5, 5)];
 const result = diff({ tree, points, thresholdMeters: 0.05, modelId: 'm1', orgId: 'org_a' }, nextId);
 assert.equal(result.length, 1);
 assert.equal(result[0]?.deviationType, 'orphan');
 assert.equal(result[0]?.elementId, null);
 assert.equal(result[0]?.orgId, 'org_a');
 assert.equal(result[0]?.modelId, 'm1');
 });

 it('deviations above threshold are critical / major / minor', () => {
 const tree = makeTree([
 { elementId: 'b1', elementName: 'B', elementType: 'IfcBeam', min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
 ]);
 const points = [makePoint(5, 0.5, 0.5), makePoint(2, 0.5, 0.5), makePoint(1.2, 0.5, 0.5)];
 const result = diff({ tree, points, thresholdMeters: 0.1, modelId: 'm1', orgId: 'org_a' }, nextId);
 assert.equal(result.length, 3);
 assert.equal(result[0]?.severity, 'critical'); // distance ~4, ratio 40
 assert.equal(result[1]?.severity, 'major'); // distance ~1, ratio 10
 assert.equal(result[2]?.severity, 'minor'); // distance ~0.2, ratio 2
 });

 it('detectedAt is set to current time', () => {
 const tree = makeTree([]);
 const before = new Date();
 const points = [makePoint(0, 0, 0)];
 const result = diff({ tree, points, thresholdMeters: 0.05, modelId: 'm1', orgId: 'o' }, nextId);
 const after = new Date();
 assert.equal(result.length, 1);
 const detectedAt = result[0]?.detectedAt;
 assert.ok(detectedAt instanceof Date);
 assert.ok(detectedAt!.getTime() >= before.getTime());
 assert.ok(detectedAt!.getTime() <= after.getTime());
 });

 it('sampling caps points at sampledCount', () => {
 const tree = makeTree([]);
 const points: CapturePoint[] = [];
 for (let i = 0; i < 100; i++) points.push(makePoint(100 + i, 100, 100));
 const result = diff({ tree, points, thresholdMeters: 0.05, sampledCount: 10, modelId: 'm1', orgId: 'o' }, nextId);
 assert.equal(result.length, 10);
 });

 it('empty points returns empty deviations', () => {
 const tree = makeTree([]);
 const result = diff({ tree, points: [], thresholdMeters: 0.05, modelId: 'm1', orgId: 'o' }, nextId);
 assert.equal(result.length, 0);
 });

 it('description includes point coordinates', () => {
 const tree = makeTree([]);
 const points = [makePoint(2.5, 3.7, 4.1)];
 const result = diff({ tree, points, thresholdMeters: 0.05, modelId: 'm1', orgId: 'o' }, nextId);
 assert.match(result[0]?.description ?? '', /2\.50.*3\.70.*4\.10/);
 });

 it('orgId and modelId are propagated to every deviation', () => {
 const tree = makeTree([]);
 const points = [makePoint(5, 5, 5), makePoint(6, 6, 6)];
 const result = diff({ tree, points, thresholdMeters: 0.05, modelId: 'unique_model', orgId: 'unique_org' }, nextId);
 assert.equal(result.length, 2);
 for (const d of result) {
 assert.equal(d.orgId, 'unique_org');
 assert.equal(d.modelId, 'unique_model');
 }
 });
});
