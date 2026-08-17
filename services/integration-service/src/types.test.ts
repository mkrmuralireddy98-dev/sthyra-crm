import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { PROVIDER_TYPES, SYNC_DIRECTIONS } from './types.js';

describe('Integrations types', () => {
 it('PROVIDER_TYPES has 4 values', () => {
 assert.equal(PROVIDER_TYPES.length, 4);
 assert.ok(PROVIDER_TYPES.includes('procore'));
 assert.ok(PROVIDER_TYPES.includes('bim360'));
 assert.ok(PROVIDER_TYPES.includes('plangrid'));
 assert.ok(PROVIDER_TYPES.includes('webhook'));
 });
 it('SYNC_DIRECTIONS has 3 values', () => {
 assert.equal(SYNC_DIRECTIONS.length, 3);
 assert.ok(SYNC_DIRECTIONS.includes('pull'));
 assert.ok(SYNC_DIRECTIONS.includes('push'));
 assert.ok(SYNC_DIRECTIONS.includes('both'));
 });
});
