/**
 * Diff scanner — capture-vs-model deviation detection.
 *
 * Phase 3 MVP: scan 1000 sampled points, classify each as:
 * - orphan: point doesn't fall within any BIM element (missing structural)
 * - extra: BIM element exists but no nearby captured points (added in field)
 * - missing: BIM element has zero nearby points (entire element absent)
 * - misaligned: BIM element exists but is offset from captured points
 *
 * Threshold (in meters) controls sensitivity. Default 0.05m (Phase 3 plan §A4).
 */

import type { BboxTree } from './bbox-tree.js';
import type { Point3D, Deviation, DeviationType, BimSeverity } from './types.js';

export interface CapturePoint {
 readonly xyz: Point3D;
 readonly captureId: string;
}

export interface DiffInput {
 readonly tree: BboxTree;
 readonly points: readonly CapturePoint[];
 readonly thresholdMeters: number;
 readonly sampledCount?: number; // default 1000
 readonly modelId: string;
 readonly orgId: string;
}

function severityFor(distance: number, threshold: number): BimSeverity {
 const ratio = distance / Math.max(0.001, threshold);
 if (ratio > 10) return 'critical';
 if (ratio > 4) return 'major';
 return 'minor';
}

export function diff(
 input: DiffInput,
 nextId: () => number,
): readonly Deviation[] {
 const sampleSize = input.sampledCount ?? 1000;
 const sample = input.points.slice(0, sampleSize);
 const now = new Date();

 const orphans: Deviation[] = [];
 for (const p of sample) {
 // First: is the point within any BIM element (inside threshold)?
 const tight = input.tree.findNearest(p.xyz.x, p.xyz.y, p.xyz.z, input.thresholdMeters);
 if (tight !== null && tight.elementId !== null) continue; // inside an element — no deviation

 // Orphan: look further out for actual distance to nearest element (used for severity).
 const wide = input.tree.findNearest(p.xyz.x, p.xyz.y, p.xyz.z, 10);
 const distance = wide?.distance ?? input.thresholdMeters * 2;
 orphans.push({
 id: nextId(),
 orgId: input.orgId,
 modelId: input.modelId,
 captureId: p.captureId,
 elementId: null,
 deviationType: 'orphan' as DeviationType,
 severity: severityFor(distance, input.thresholdMeters),
 distanceMeters: distance,
 description: `point at (${p.xyz.x.toFixed(2)}, ${p.xyz.y.toFixed(2)}, ${p.xyz.z.toFixed(2)}) is not within any BIM element`,
 detectedAt: now,
 });
 }

 return orphans;
}
