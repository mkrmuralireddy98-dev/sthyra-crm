/**
 * Sthyra CRM Integrations — domain types.
 */

export const PROVIDER_TYPES = ['procore', 'bim360', 'plangrid', 'webhook'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const SYNC_DIRECTIONS = ['pull', 'push', 'both'] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export interface IntegrationConfig {
  readonly apiKey?: string;
  readonly oauthToken?: string;
  readonly webhookUrl?: string;
  readonly webhookToken?: string;
  readonly projectMapping?: Readonly<Record<string, string>>;
}

export interface Integration {
  readonly id: string;
  readonly orgId: string;
  readonly provider: ProviderType;
  readonly config: IntegrationConfig;
  readonly status: 'connected' | 'disconnected' | 'error';
  readonly lastError: string | null;
  readonly lastTestedAt: Date | null;
  readonly connectedAt: Date;
  readonly deletedAt: Date | null;
}

export interface Sync {
  readonly id: string;
  readonly orgId: string;
  readonly integrationId: string;
  readonly direction: SyncDirection;
  readonly entityTypes: readonly string[];
  readonly status: 'completed' | 'failed';
  readonly itemsProcessed: number;
  readonly errors: readonly string[];
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly dryRun: boolean;
}

export interface Provider {
  readonly type: ProviderType;
  readonly name: string;
  readonly description: string;
  readonly requiredConfig: readonly string[];
  readonly supportedEntityTypes: readonly string[];
}

export interface CreateIntegrationInput {
  readonly orgId: string;
  readonly provider: ProviderType;
  readonly config: IntegrationConfig;
}

export interface ConnectionTestResult {
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly error: string | null;
}

export interface SyncResult {
  readonly syncId: string;
  readonly status: 'completed' | 'failed';
  readonly itemsProcessed: number;
  readonly errors: readonly string[];
}
