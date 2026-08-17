import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseIfc4x3, IfcParseError } from './ifc-parser.js';

const IFC_FIXTURE = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'));
FILE_NAME('level3.ifc','2026-08-14',('alice'),('Sthyra CRM'),'Sthyra-CRM-IFC-Library','Sthyra-CRM');
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;
#1=IFCPROJECT('proj_001',#2,'Level 3',$,$,$,$,$,$);
#2=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,0);
#5=IFCBEAM('Level 3 East Beam',#6,#7,'Beam1',$,$,$);
#8=IFCWALL('North Wall',#9,#10,'Wall1',$,$,$);
#11=IFCSLAB('Level 3 Slab',#12,#13,'Slab1',$,$,$);
#14=IFCCOLUMN('Corner Column',#15,#16,'Col1',$,$,$);
ENDSEC;
END-ISO-10303-21;`;

describe('IFC parser stub (T-007)', () => {
 it('parses a valid IFC 4x3 fixture', () => {
 const result = parseIfc4x3(IFC_FIXTURE);
 assert.equal(result.schema, 'IFC4X3');
 assert.equal(result.totalElements, 4);
 });

 it('extracts all 4 element types', () => {
 const result = parseIfc4x3(IFC_FIXTURE);
 const typeSet = new Set(result.bboxes.map((b) => b.elementType));
 assert.ok(typeSet.has('IfcBeam'));
 assert.ok(typeSet.has('IfcWall'));
 assert.ok(typeSet.has('IfcSlab'));
 assert.ok(typeSet.has('IfcColumn'));
 });

 it('preserves element names', () => {
 const result = parseIfc4x3(IFC_FIXTURE);
 const names = result.bboxes.map((b) => b.elementName);
 assert.ok(names.includes('Level 3 East Beam'));
 assert.ok(names.includes('North Wall'));
 });

 it('synthesizes bboxes (placeholder for Phase 4)', () => {
 const result = parseIfc4x3(IFC_FIXTURE);
 for (const b of result.bboxes) {
 assert.ok(b.min.x <= b.max.x);
 assert.ok(b.min.y <= b.max.y);
 assert.ok(b.min.z <= b.max.z);
 }
 });

 it('throws IfcParseError on missing FILE_SCHEMA header', () => {
 assert.throws(() => parseIfc4x3('not ifc content'), IfcParseError);
 });

 it('throws IfcParseError on non-IFC4X3 schema', () => {
 const legacy = `HEADER;
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#5=IFCBEAM('Old Beam',$,$,$,$,$,$);
ENDSEC;`;
 assert.throws(() => parseIfc4x3(legacy), /unsupported schema: IFC2X3/);
 });
});
