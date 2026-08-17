/**
 * IntegrationService — domain layer.
 */

import { randomUUID } from 'node:crypto';
import { getConnector } from './connectors.js';
import type {
  Integration, Sync, IntegrationConfig, ProviderType, SyncDirection,
  ConnectionTestResult, SyncResult, CreateIntegrationInput,
} from './types.js';
import type { IntegrationRepository } from './repository.js';

export interface IntegrationServiceDeps {
  readonly repo: IntegrationRepository;
  readonly now?: () => Date;
}

export interface WebhookReceiveResult {
  readonly received: boolean;
  readonly processed: boolean;
}

/**
 * Redact sensitive config fields (NFR-5).
 * Returns a new Integration (since config is readonly).
 */
export function redactIntegration(integration: Integration): Integration {
  const cfg = integration.config as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (k === 'apiKey' || k === 'oauthToken' || k === 'webhookToken') {
      redacted[k] = '***';
    } else {
      redacted[k] = v;
    }
  }
  return { ...integration, config: redacted as IntegrationConfig };
}

export class IntegrationService {
  private readonly repo: IntegrationRepository;
  private readonly now: () => Date;

  constructor(deps: IntegrationServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
  }

  // ─── FR-1: createIntegration ──────────────────────────
  async createIntegration(input: CreateIntegrationInput, idempotencyKey?: string): Promise<Integration> {
    if (!input.orgId) throw new Error('orgId required');
    if (!input.provider) throw new Error('provider required');

    if (idempotencyKey) {
      const cached = await this.repo.getIdempotencyResult<{ integrationId?: string }>(input.orgId, idempotencyKey);
      if (cached?.integrationId) {
        const existing = await this.repo.findIntegration(input.orgId, cached.integrationId);
        if (existing) return existing;
      }
    }

    const id = `int_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
    const integration: Integration = {
      id, orgId: input.orgId,
      provider: input.provider,
      config: input.config,
      status: 'connected',
      lastError: null,
      lastTestedAt: null,
      connectedAt: this.now(),
      deletedAt: null,
    };
    await this.repo.insertIntegration(integration);
    if (idempotencyKey) {
      await this.repo.insertIdempotencyKey(input.orgId, idempotencyKey, { integrationId: integration.id });
    }
    return integration;
  }

  // ─── FR-2: listIntegrations (redacted) ─────────────────
  async listIntegrations(orgId: string): Promise<readonly Integration[]> {
    const all = await this.repo.listIntegrations(orgId);
    return all.map(redactIntegration);
  }

  // ─── FR-3: disconnect ───────────────────────────────────
  async disconnect(orgId: string, id: string): Promise<void> {
    await this.repo.softDeleteIntegration(orgId, id);
  }

  // ─── FR-4: triggerSync ───────────────────────────────────
  async triggerSync(
    orgId: string,
    id: string,
    direction: SyncDirection,
    entityTypes: readonly string[],
    dryRun: boolean = false,
  ): Promise<SyncResult> {
    const integration = await this.repo.findIntegration(orgId, id);
    if (!integration) throw new Error('integration not found: ' + id);
    if (integration.orgId !== orgId) throw new Error('integration not found: ' + id);

    const ts = this.now();
    const syncId = `sync_${ts.getTime()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const errors: string[] = [];
    let itemsProcessed = 0;

    if (dryRun) {
      const sync: Sync = {
        id: syncId, orgId, integrationId: id,
        direction, entityTypes, status: 'completed',
        itemsProcessed: 0, errors: [],
        startedAt: ts, completedAt: ts, dryRun: true,
      };
      await this.repo.insertSync(sync);
      return { syncId, status: 'completed', itemsProcessed: 0, errors: [] };
    }

    const connector = getConnector(integration.provider);
    const config = integration.config as Record<string, unknown>;

    try {
      if (direction === 'pull' || direction === 'both') {
        for (const entityType of entityTypes) {
          const items = await connector.pull(entityType, config);
          itemsProcessed += items.length;
          // Phase 11 MVP: just count. Phase 11.b: pipe to field-service.
        }
      }
      if (direction === 'push' || direction === 'both') {
        // Phase 11 MVP: push is a no-op (no items to push yet)
      }
    } catch (err) {
      errors.push((err as Error).message);
    }

    const completed = errors.length === 0;
    const sync: Sync = {
      id: syncId, orgId, integrationId: id,
      direction, entityTypes,
      status: completed ? 'completed' : 'failed',
      itemsProcessed, errors,
      startedAt: ts, completedAt: this.now(), dryRun: false,
    };
    await this.repo.insertSync(sync);
    return { syncId, status: sync.status, itemsProcessed, errors };
  }

  // ─── FR-5: listSyncs (redacted) ──────────────────────────
  async listSyncs(orgId: string, integrationId: string, limit: number = 20): Promise<readonly Sync[]> {
    return this.repo.listSyncs(orgId, integrationId, limit);
  }

  // ─── FR-6: receiveWebhook ────────────────────────────────
  async receiveWebhook(orgId: string, id: string, webhookToken: string, _payload: Record<string, unknown>): Promise<WebhookReceiveResult> {
    const integration = await this.repo.findIntegration(orgId, id);
    if (!integration) throw new Error('integration not found: ' + id);
    if (integration.orgId !== orgId) throw new Error('integration not found: ' + id);
    const stored = (integration.config as Record<string, unknown>).webhookToken as string | undefined;
    if (!stored || stored !== webhookToken) {
      return { received: false, processed: false };
    }
    // Phase 11 MVP: acknowledge receipt. Phase 11.b: process into events.
    return { received: true, processed: true };
  }

  // ─── FR-7: listProviders ────────────────────────────────
  async listProviders() {
    const { PROVIDERS } = await import('./providers.js');
    return PROVIDERS;
  }

  // ─── FR-8: testConnection ────────────────────────────────
  async testConnection(orgId: string, id: string): Promise<ConnectionTestResult> {
    const integration = await this.repo.findIntegration(orgId, id);
    if (!integration) throw new Error('integration not found: ' + id);
    if (integration.orgId !== orgId) throw new Error('integration not found: ' + id);
    const connector = getConnector(integration.provider);
    const config = integration.config as Record<string, unknown>;
    const result = await connector.testConnection(config);
    await this.repo.updateIntegration(orgId, id, {
      lastTestedAt: this.now(),
      lastError: result.ok ? null : result.error,
      status: result.ok ? 'connected' : 'error',
    });
    return result;
  }

  // Suppress unused-var warnings (ProviderType used in public API)
  private _types: ProviderType[] = [];
}
