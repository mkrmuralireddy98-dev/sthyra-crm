import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildGraph, detectCycleOnAdd } from './graph.js';
import type { Milestone } from './types.js';

const NOW = new Date('2026-09-01T00:00:00Z');

function mkMilestone(id: string, dependsOn: readonly string[] = []): Milestone {
 return {
 id, orgId: 'org_a', projectId: 'prj_1', name: id, description: null,
 plannedDate: NOW, actualDate: null, status: 'pending', progressPct: 0,
 dependsOn, createdAt: NOW, updatedAt: NOW, deletedAt: null,
 };
}

describe('buildGraph', () => {
 it('returns nodes + edges', () => {
 const ms = [mkMilestone('m1'), mkMilestone('m2', ['m1'])];
 const g = buildGraph(ms);
 assert.equal(g.nodes.length, 2);
 assert.equal(g.edges.length, 1);
 assert.equal(g.edges[0]!.fromId, 'm1');
 assert.equal(g.edges[0]!.toId, 'm2');
 });

 it('empty graph', () => {
 const g = buildGraph([]);
 assert.equal(g.nodes.length, 0);
 assert.equal(g.edges.length, 0);
 });
});

describe('detectCycleOnAdd', () => {
 it('returns false when no cycle', () => {
 const existing = [mkMilestone('m1')];
 const cycle = detectCycleOnAdd(existing, 'm2', ['m1']);
 assert.equal(cycle, false);
 });

 it('returns true for self-dependency', () => {
 const existing: Milestone[] = [];
 const cycle = detectCycleOnAdd(existing, 'm1', ['m1']);
 assert.equal(cycle, true);
 });

 it('returns true when candidate depends on existing cycle', () => {
 // m1 ↔ m2 (mutual dependency, cycle)
 const existing = [
 mkMilestone('m1', ['m2']),
 mkMilestone('m2', ['m1']),
 ];
 // Adding m3 that depends on m1 → must detect the cycle
 const cycle = detectCycleOnAdd(existing, 'm3', ['m1']);
 assert.equal(cycle, true);
 });

 it('returns false for diamond dependency', () => {
 const existing = [
 mkMilestone('m1'),
 mkMilestone('m2', ['m1']),
 mkMilestone('m3', ['m1']),
 ];
 const cycle = detectCycleOnAdd(existing, 'm4', ['m2', 'm3']);
 assert.equal(cycle, false);
 });

 it('returns false for empty existing + new candidate', () => {
 const cycle = detectCycleOnAdd([], 'm1', []);
 assert.equal(cycle, false);
 });
});
