/**
 * InMemoryBimRepository — Phase 3 MVP implementation.
 *
 * Same pattern as field-service/repo-memory.ts:
 * - Per-tenant Maps keyed by (orgId, id)
 * - Soft-delete via deletedAt
 * - isCurrent flag for version-management
 */

import type { BimRepository, BimEvent } from './repository.js';
import type { BimModel, Deviation } from './types.js';

export class InMemoryBimRepository implements BimRepository {
 private readonly models = new Map<string, BimModel>();
 private readonly deviations: Deviation[] = [];
 private readonly idCounter = { deviation: 0 };

 private key(orgId: string, id: string): string {
 return `bim:${orgId}:${id}`;
 }

 async insertBimModel(model: BimModel): Promise<void> {
 this.models.set(this.key(model.orgId, model.id), model);
 }

 async findCurrentModel(orgId: string, projectId: string): Promise<BimModel | null> {
 for (const m of this.models.values()) {
 if (m.orgId === orgId && m.projectId === projectId && m.isCurrent && !m.deletedAt) {
 return m;
 }
 }
 return null;
 }

 async findModelById(orgId: string, id: string): Promise<BimModel | null> {
 return this.models.get(this.key(orgId, id)) ?? null;
 }

 async listModels(orgId: string, projectId: string): Promise<readonly BimModel[]> {
 const result: BimModel[] = [];
 for (const m of this.models.values()) {
 if (m.orgId === orgId && m.projectId === projectId && !m.deletedAt) result.push(m);
 }
 return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
 }

 async updateModelState(orgId: string, id: string, state: BimModel['state'], totalElements: number | null): Promise<void> {
 const k = this.key(orgId, id);
 const cur = this.models.get(k);
 if (!cur) return;
 this.models.set(k, {
 ...cur,
 state,
 totalElements: totalElements ?? cur.totalElements,
 });
 }

 async markModelCurrent(orgId: string, id: string): Promise<void> {
 // The semantics in service.ts is "demote this id"; here we toggle all
 // models for this (org, projectId) so isCurrent=false on the named id,
 // and isCurrent=true on the rest that are not deleted.
 for (const m of this.models.values()) {
 if (m.orgId !== orgId) continue;
 if (m.id === id) {
 this.models.set(this.key(orgId, id), { ...m, isCurrent: false });
 } else if (m.isCurrent && !m.deletedAt) {
 this.models.set(this.key(orgId, m.id), { ...m, isCurrent: false });
 }
 }
 }

 async softDeleteModel(orgId: string, id: string): Promise<void> {
 const k = this.key(orgId, id);
 const cur = this.models.get(k);
 if (!cur) return;
 this.models.set(k, { ...cur, deletedAt: new Date(), isCurrent: false });
 }

 async insertDeviation(deviation: Deviation): Promise<void> {
 this.deviations.push(deviation);
 }

 async listDeviations(orgId: string, modelId: string, captureId: string, thresholdMeters: number): Promise<readonly Deviation[]> {
 return this.deviations.filter(
 (d) => d.orgId === orgId && d.modelId === modelId && d.captureId === captureId && d.distanceMeters <= thresholdMeters,
 );
 }

 nextId(): number {
 this.idCounter.deviation += 1;
 return this.idCounter.deviation;
 }
}

// Silence unused import warning
void (0 as unknown as BimEvent);
