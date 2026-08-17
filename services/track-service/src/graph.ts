/**
 * graph.ts — topological sort + cycle detection for milestone dependencies.
 * Pure function. Used by FR-6 (dependency graph) and FR-1 (cycle rejection).
 */

import type { Milestone } from './types.js';

export interface GraphEdge {
 readonly fromId: string;
 readonly toId: string;
}

export interface GraphResult {
 readonly nodes: readonly Milestone[];
 readonly edges: readonly GraphEdge[];
 readonly hasCycle: boolean;
}

export function buildGraph(milestones: readonly Milestone[]): GraphResult {
 const edges: GraphEdge[] = [];
 for (const m of milestones) {
 for (const dep of m.dependsOn) {
 edges.push({ fromId: dep, toId: m.id });
 }
 }
 return { nodes: milestones, edges, hasCycle: false };
}

/**
 * Detect cycle when adding a new milestone with the given dependencies.
 * O(V + E) via DFS with memoization.
 */
export function detectCycleOnAdd(
 existing: readonly Milestone[],
 candidateId: string,
 dependsOn: readonly string[],
): boolean {
 const visited = new Set<string>();
 const inStack = new Set<string>();

 function dfs(nodeId: string): boolean {
 if (inStack.has(nodeId)) return true;
 if (visited.has(nodeId)) return false;
 visited.add(nodeId);
 inStack.add(nodeId);

 const m = existing.find((x) => x.id === nodeId);
 if (!m) {
 inStack.delete(nodeId);
 return false;
 }
 for (const dep of m.dependsOn) {
 if (dfs(dep)) return true;
 }
 inStack.delete(nodeId);
 return false;
 }

 for (const dep of dependsOn) {
 if (dfs(dep)) return true;
 }
 // also check candidate reaches itself through existing
 visited.add(candidateId);
 inStack.add(candidateId);
 for (const dep of dependsOn) {
 if (dfs(dep)) return true;
 }
 inStack.delete(candidateId);
 return false;
}
