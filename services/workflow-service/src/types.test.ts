import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { TRIGGER_TYPES } from './types.js';

describe('Workflow types', () => {
 it('TRIGGER_TYPES has 3 values', () => {
 assert.equal(TRIGGER_TYPES.length, 3);
 assert.ok(TRIGGER_TYPES.includes('event'));
 assert.ok(TRIGGER_TYPES.includes('schedule'));
 assert.ok(TRIGGER_TYPES.includes('threshold'));
 });
});
