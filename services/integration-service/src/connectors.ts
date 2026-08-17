/**
 * Connectors — stub implementations for Phase 11 MVP.
 * Phase 11.b: replace with real HTTP clients.
 */

import type { ConnectionTestResult, ProviderType } from './types.js';

export interface Connector {
  readonly provider: ProviderType;
  testConnection(config: Record<string, unknown>): Promise<ConnectionTestResult>;
  pull(entityType: string, config: Record<string, unknown>): Promise<readonly Record<string, unknown>[]>;
  push(entityType: string, items: readonly Record<string, unknown>[], config: Record<string, unknown>): Promise<{ written: number }>;
}

class StubProcoreConnector implements Connector {
  readonly provider = 'procore';
  async testConnection(config: Record<string, unknown>): Promise<ConnectionTestResult> {
 if (!config.apiKey) return { ok: false, latencyMs: 0, error: 'apiKey missing' };
 return { ok: true, latencyMs: 50, error: null };
 }
 async pull(entityType: string): Promise<readonly Record<string, unknown>[]> {
 if (entityType === 'rfi') {
 return [
 { id: 'rfi_1', title: 'RFI #1', description: 'Clarify footer', dueDate: '2026-09-15' },
 { id: 'rfi_2', title: 'RFI #2', description: 'Confirm beam size', dueDate: '2026-09-20' },
 ];
 }
 if (entityType === 'daily_log') {
 return [{ id: 'log_1', date: '2026-09-01', weather: 'sunny', notes: 'Foundation work' }];
 }
 return [];
 }
 async push(_entityType: string, items: readonly Record<string, unknown>[]): Promise<{ written: number }> {
 return { written: items.length };
 }
}

class StubBIM360Connector implements Connector {
  readonly provider = 'bim360';
  async testConnection(config: Record<string, unknown>): Promise<ConnectionTestResult> {
 if (!config.oauthToken) return { ok: false, latencyMs: 0, error: 'oauthToken missing' };
 return { ok: true, latencyMs: 80, error: null };
 }
 async pull(entityType: string): Promise<readonly Record<string, unknown>[]> {
 if (entityType === 'issue') {
 return [{ id: 'bim_issue_1', title: 'Beam clash', severity: 'high' }];
 }
 return [];
 }
 async push(_entityType: string, items: readonly Record<string, unknown>[]): Promise<{ written: number }> {
 return { written: items.length };
 }
}

class StubPlangridConnector implements Connector {
  readonly provider = 'plangrid';
  async testConnection(config: Record<string, unknown>): Promise<ConnectionTestResult> {
 if (!config.apiKey) return { ok: false, latencyMs: 0, error: 'apiKey missing' };
 return { ok: true, latencyMs: 30, error: null };
 }
 async pull(entityType: string): Promise<readonly Record<string, unknown>[]> {
 if (entityType === 'punch_list') {
 return [{ id: 'pg_1', name: 'Punch list', items: 12 }];
 }
 return [];
 }
 async push(_entityType: string, items: readonly Record<string, unknown>[]): Promise<{ written: number }> {
 return { written: items.length };
 }
}

class StubWebhookConnector implements Connector {
  readonly provider = 'webhook';
  async testConnection(config: Record<string, unknown>): Promise<ConnectionTestResult> {
 if (!config.webhookUrl) return { ok: false, latencyMs: 0, error: 'webhookUrl missing' };
 return { ok: true, latencyMs: 20, error: null };
 }
 async pull(entityType: string): Promise<readonly Record<string, unknown>[]> {
 void entityType;
 return [];
 }
 async push(_entityType: string, items: readonly Record<string, unknown>[]): Promise<{ written: number }> {
 return { written: items.length };
 }
}

const REGISTRY: Record<ProviderType, Connector> = {
 procore: new StubProcoreConnector(),
 bim360: new StubBIM360Connector(),
 plangrid: new StubPlangridConnector(),
 webhook: new StubWebhookConnector(),
};

export function getConnector(provider: ProviderType): Connector {
 return REGISTRY[provider];
}
