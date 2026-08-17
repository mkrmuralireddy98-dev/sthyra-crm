import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 BIM_SCHEMA_VERSIONS,
 BIM_MODEL_STATES,
 BIM_DEVIATION_TYPES,
 BIM_SEVERITIES,
 type BimModelState,
 type BimSchemaVersion,
 type DeviationType,
 type BimSeverity,
 type BboxElement,
} from './types.js';

describe('BIM Viewer — types', () => {
 it('BIM_SCHEMA_VERSIONS has IFC4X3', () => {
 assert.deepEqual([...BIM_SCHEMA_VERSIONS], ['IFC4X3']);
 });

 it('BIM_MODEL_STATES has 7 states', () => {
 assert.equal(BIM_MODEL_STATES.length, 7);
 assert.deepEqual(
 [...BIM_MODEL_STATES].sort(),
 ['aligned', 'diffed', 'failed', 'new', 'ready', 'uploading', 'validating'],
 );
 });

 it('BIM_DEVIATION_TYPES has 4 types', () => {
 assert.equal(BIM_DEVIATION_TYPES.length, 4);
 assert.deepEqual([...BIM_DEVIATION_TYPES].sort(), ['extra', 'misaligned', 'missing', 'orphan']);
 });

 it('BIM_SEVERITIES has 3 levels', () => {
 assert.equal(BIM_SEVERITIES.length, 3);
 assert.deepEqual([...BIM_SEVERITIES].sort(), ['critical', 'major', 'minor']);
 });

 it('BboxElement supports all 4 sides of a 3D bbox', () => {
 const e: BboxElement = {
 elementId: 'beam_001',
 elementName: 'Level 3 East Beam',
 elementType: 'IfcBeam',
 min: { x: 0, y: 0, z: 0 },
 max: { x: 10, y: 1, z: 0.5 },
 };
 assert.equal(e.elementType, 'IfcBeam');
 assert.equal(e.max.x - e.min.x, 10);
 });

 it('BimModel supports all 7 states', () => {
 const states: BimModelState[] = ['new', 'uploading', 'validating', 'ready', 'aligned', 'diffed', 'failed'];
 for (const s of states) {
 assert.equal(s, s);
 }
 });

 it('DeviationType supports all 4 types', () => {
 const types: DeviationType[] = ['orphan', 'extra', 'missing', 'misaligned'];
 for (const t of types) {
 assert.equal(t, t);
 }
 });

 it('BimSeverity supports all 3 levels', () => {
 const levels: BimSeverity[] = ['minor', 'major', 'critical'];
 for (const l of levels) {
 assert.equal(l, l);
 }
 });
});
