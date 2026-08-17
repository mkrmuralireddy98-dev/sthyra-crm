/**
 * BboxTree — 3D spatial index for IFC element lookup.
 *
 * Phase 3 MVP uses a coarse 3D grid. Each cell holds elements whose bbox
 * intersects the cell. Phase 3.b migrates to a real R-tree or octree.
 *
 * Lookup walks 27 neighboring cells (3×3×3) around the lookup point
 * (with one cell of slack on each side) and finds the element with the
 * minimum point-to-bbox distance.
 */

import type { Point3D, ElementLookupResult } from './types.js';
import type { BboxElement } from './types.js';

interface Cell {
 readonly ix: number;
 readonly iy: number;
 readonly iz: number;
}

function cellKey(c: Cell): string {
 return `${c.ix}|${c.iy}|${c.iz}`;
}

function pointToCell(p: Point3D, cellSize: number): Cell {
 return {
 ix: Math.floor(p.x / cellSize),
 iy: Math.floor(p.y / cellSize),
 iz: Math.floor(p.z / cellSize),
 };
}

function cellRange(bbox: { min: Point3D; max: Point3D }, cellSize: number): [Cell, Cell] {
 return [
 pointToCell(bbox.min, cellSize),
 pointToCell(bbox.max, cellSize),
 ];
}

/**
 * Compute the closest-point distance from point `p` to the bbox [min, max].
 * 0 if p is inside the bbox.
 */
function distanceToBbox(p: Point3D, min: Point3D, max: Point3D): number {
 const dx = Math.max(min.x - p.x, 0, p.x - max.x);
 const dy = Math.max(min.y - p.y, 0, p.y - max.y);
 const dz = Math.max(min.z - p.z, 0, p.z - max.z);
 return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class BboxTree {
 private readonly cellSize: number;
 private readonly elements: readonly BboxElement[];
 private readonly grid: Map<string, BboxElement[]> = new Map();

 constructor(cellSize: number, elements: readonly BboxElement[]) {
 this.cellSize = cellSize;
 this.elements = elements;
 this.build();
 }

 private build(): void {
 for (const e of this.elements) {
 const [start, end] = cellRange(
 { min: e.min, max: e.max },
 this.cellSize,
 );
 for (let ix = start.ix; ix <= end.ix; ix++) {
 for (let iy = start.iy; iy <= end.iy; iy++) {
 for (let iz = start.iz; iz <= end.iz; iz++) {
 const k = cellKey({ ix, iy, iz });
 const list = this.grid.get(k) ?? [];
 list.push(e);
 this.grid.set(k, list);
 }
 }
 }
 }
 }

 /**
 * Find the element whose bbox is closest to the lookup point, within `radius` meters.
 * Returns null if no element is within radius.
 */
 findNearest(x: number, y: number, z: number, radius: number): ElementLookupResult | null {
 if (this.elements.length === 0) return null;

 const p: Point3D = { x, y, z };
 const center = pointToCell(p, this.cellSize);
 const cellRadius = Math.ceil(radius / this.cellSize);

 let best: BboxElement | null = null;
 let bestDistance = Infinity;

 // Walk a (2*cellRadius+1)^3 cube around the center cell.
 for (let dx = -cellRadius; dx <= cellRadius; dx++) {
 for (let dy = -cellRadius; dy <= cellRadius; dy++) {
 for (let dz = -cellRadius; dz <= cellRadius; dz++) {
 const k = cellKey({
 ix: center.ix + dx,
 iy: center.iy + dy,
 iz: center.iz + dz,
 });
 const candidates = this.grid.get(k);
 if (!candidates) continue;
 for (const e of candidates) {
 const d = distanceToBbox(p, e.min, e.max);
 if (d < bestDistance) {
 bestDistance = d;
 best = e;
 }
 }
 }
 }
 }

 if (!best) return null;
 if (bestDistance > radius) {
 return { elementId: null, elementName: null, elementType: null, distance: bestDistance };
 }
 return {
 elementId: best.elementId,
 elementName: best.elementName,
 elementType: best.elementType,
 distance: bestDistance,
 };
 }

 size(): number {
 return this.elements.length;
 }
}
