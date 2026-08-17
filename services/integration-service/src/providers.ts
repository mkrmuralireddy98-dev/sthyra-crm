/**
 * Provider catalog — hardcoded for Phase 11 MVP.
 */

import type { Provider } from './types.js';

export const PROVIDERS: readonly Provider[] = [
 {
 type: 'procore',
 name: 'Procore',
 description: 'Project management, RFI sync, daily log import',
 requiredConfig: ['apiKey'],
 supportedEntityTypes: ['project', 'rfi', 'daily_log'],
 },
 {
 type: 'bim360',
 name: 'Autodesk BIM 360',
 description: 'Model sync and issue sync',
 requiredConfig: ['oauthToken'],
 supportedEntityTypes: ['model', 'issue'],
 },
 {
 type: 'plangrid',
 name: 'PlanGrid',
 description: 'Punch list sync (alternative to native punch list)',
 requiredConfig: ['apiKey'],
 supportedEntityTypes: ['punch_list'],
 },
 {
 type: 'webhook',
 name: 'Custom Webhook',
 description: 'Generic webhook receiver for any external system',
 requiredConfig: ['webhookUrl'],
 supportedEntityTypes: ['*'],
 },
];

export function findProvider(type: string): Provider | null {
 return PROVIDERS.find((p) => p.type === type) ?? null;
}
