/**
 * IFC 4x3 parser stub.
 *
 * Phase 3 MVP: parses small fixture IFC files (text-based STEP format).
 * Extracts element names + bounding boxes.
 *
 * Phase 4: real parser using Web-IFC or thatch-services.
 *
 * IfcEntity parsing:
 * IFCCARTESIANPOINT((0.,0.,0.));
 * IFCBEAM('name', 'globalid', 'owner', 'type', 'predefined', 'tag', body);
 * IFCBEAM('Level 3 East Beam', #12, #30, 'Beam1', $, $, $);
 */

import type { BboxElement, BimSchemaVersion, Point3D } from './types.js';

export interface IfcParseResult {
 readonly schema: BimSchemaVersion;
 readonly totalElements: number;
 readonly bboxes: readonly BboxElement[];
}

export class IfcParseError extends Error {
 constructor(message: string) {
 super(message);
 this.name = 'IfcParseError';
 }
}

export function parseIfc4x3(content: string): IfcParseResult {
 if (!content.includes('FILE_SCHEMA((')) {
 throw new IfcParseError('not an IFC file (no FILE_SCHEMA header)');
 }
 const schemaMatch = content.match(/FILE_SCHEMA\(\(\s*'([^']+)'\s*\)\)/);
 if (!schemaMatch) {
 throw new IfcParseError('FILE_SCHEMA header missing schema name');
 }
 const schema = schemaMatch[1];
 if (schema !== 'IFC4X3') {
 throw new IfcParseError(`unsupported schema: ${schema} (Phase 3 only supports IFC4X3)`);
 }

 // Very rough entity extraction. Real IFC parsing is Phase 4.
 // Extract IFCBEAM, IFCWALL, IFCSLAB, IFCCOLUMN entity names from the FILE.
 const lines = content.split(/\r?\n/);
 const elements: BboxElement[] = [];
 const seen = new Set<string>();
 const types: Array<{ regex: RegExp; elementType: string }> = [
 { regex: /IFCBEAM\(\s*'([^']+)'/, elementType: 'IfcBeam' },
 { regex: /IFCWALL\(\s*'([^']+)'/, elementType: 'IfcWall' },
 { regex: /IFCSLAB\(\s*'([^']+)'/, elementType: 'IfcSlab' },
 { regex: /IFCCOLUMN\(\s*'([^']+)'/, elementType: 'IfcColumn' },
 ];

 let counter = 0;
 for (const line of lines) {
 for (const { regex, elementType } of types) {
 const m = line.match(regex);
 if (m && m[1]) {
 const elementName = m[1];
 if (seen.has(elementName)) continue;
 seen.add(elementName);
 counter += 1;
 // Synthesize a unit bbox at a deterministic location.
 const x = counter * 2;
 const min: Point3D = { x, y: 0, z: 0 };
 const max: Point3D = { x: x + 1, y: 1, z: 0.5 };
 elements.push({
 elementId: `${elementType.toLowerCase()}_${counter}`,
 elementName,
 elementType,
 min,
 max,
 });
 }
 }
 }

 return {
 schema: 'IFC4X3',
 totalElements: elements.length,
 bboxes: elements,
 };
}
