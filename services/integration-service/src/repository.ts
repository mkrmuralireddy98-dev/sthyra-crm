/**
 * IntegrationRepository — tenant-scoped storage contract.
 */

import type { Integration, Sync } from './types.js';

export interface IntegrationRepository {
  insertIntegration(i: Integration): Promise<void>;
  findIntegration(orgId: string, id: string): Promise<Integration | null>;
  listIntegrations(orgId: string): Promise<readonly Integration[]>;
  updateIntegration(orgId: string, id: string, patch: Partial<Integration>): Promise<Integration>;
  softDeleteIntegration(orgId: string, id: string): Promise<void>;
  nextIntegrationId(): number;

  insertSync(sync: Sync): Promise<void>;
  listSyncs(orgId: string, integrationId: string, limit?: number): Promise<readonly Sync[]>;
  nextSyncId(): number;

  insertIdempotencyKey(orgId: string, key: string, result: { readonly integrationId?: string }, ttlSeconds?: number): Promise<void>;
  getIdempotencyResult<T>(orgId: string, key: string): Promise<T | null>;
}
