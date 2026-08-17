import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BboxTree, type BboxElement } from './bbox-tree.js';

const makeElement = (overrides: Partial<BboxElement> = {}): BboxElement => ({
 elementId: 'e1',
 elementName: 'Element 1',
 elementType: 'IfcBeam',
 min: { x: 0, y: 0, z: 0 },
 max: { x: 1, y: 1, z: 1 },
 ...overrides,
});

describe('BboxTree — nearest lookup (T-006)', () => {
 it('empty tree returns null', () => {
 const tree = new BboxTree(0.5, []);
 assert.equal(tree.findNearest(0, 0, 0, 0.5), null);
 });

 it('single element at origin: lookup at origin returns that element', () => {
 const e = makeElement({ elementId: 'e1', elementName: 'Origin Beam' });
 const tree = new BboxTree(0.5, [e]);
 const r = tree.findNearest(0, 0, 0, 0.5);
 assert.ok(r);
 assert.equal(r.elementId, 'e1');
 assert.equal(r.elementName, 'Origin Beam');
 assert.equal(r.distance, 0);
 });

 it('point inside element returns element with distance=0', () => {
 const e = makeElement({ elementId: 'box', min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } });
 const tree = new BboxTree(0.5, [e]);
 const r = tree.findNearest(1, 1, 1, 5);
 assert.ok(r);
 assert.equal(r.elementId, 'box');
 assert.equal(r.distance, 0);
 });

 it('point outside element but within radius returns element with non-zero distance', () => {
 const e = makeElement({ elementId: 'box', min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } });
 const tree = new BboxTree(0.5, [e]);
 const r = tree.findNearest(2, 0.5, 0.5, 5);
 assert.ok(r);
 assert.equal(r.elementId, 'box');
 assert.ok(r.distance > 0);
 assert.equal(r.distance, 1); // closest face at x=1, point at x=2 → distance 1
 });

 it('point outside radius returns null', () => {
 const e = makeElement({ elementId: 'far', min: { x: 10, y: 10, z: 10 }, max: { x: 11, y: 11, z: 11 } });
 const tree = new BboxTree(0.5, [e]);
 assert.equal(tree.findNearest(0, 0, 0, 0.5), null);
 });

 it('multiple elements: returns closest', () => {
 const near = makeElement({ elementId: 'near', min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } });
 const far = makeElement({ elementId: 'far', min: { x: 5, y: 5, z: 5 }, max: { x: 6, y: 6, z: 6 } });
 const tree = new BboxTree(0.5, [far, near]); // out of order
 const r = tree.findNearest(2, 0.5, 0.5, 10);
 assert.ok(r);
 assert.equal(r.elementId, 'near');
 });

 it('element type is returned', () => {
 const e = makeElement({ elementId: 'b', elementType: 'IfcWall', elementName: 'Wall' });
 const tree = new BboxTree(0.5, [e]);
 const r = tree.findNearest(0.5, 0.5, 0.5, 5);
 assert.ok(r);
 assert.equal(r.elementType, 'IfcWall');
 });

 it('size() returns element count', () => {
 const tree = new BboxTree(0.5, [makeElement({ elementId: 'a' }), makeElement({ elementId: 'b' })]);
 assert.equal(tree.size(), 2);
 });

 it('bboxes can be larger than 1 cell (multi-cell elements)', () => {
 const e = makeElement({ elementId: 'big', min: { x: -1, y: -1, z: -1 }, max: { x: 2, y: 2, z: 2 } });
 const tree = new BboxTree(0.5, [e]);
 const r = tree.findNearest(1.5, 1.5, 1.5, 5);
 assert.ok(r);
 assert.equal(r.elementId, 'big');
 });
});
