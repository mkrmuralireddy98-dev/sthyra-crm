import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { REPORT_KINDS, CUSTOM_ENTITIES } from './types.js';

describe('Reports types — enums', () => {
 it('REPORT_KINDS has 2 values (daily + weekly)', () => {
 assert.equal(REPORT_KINDS.length, 2);
 assert.ok(REPORT_KINDS.includes('daily'));
 assert.ok(REPORT_KINDS.includes('weekly'));
 });

 it('CUSTOM_ENTITIES has 3 values', () => {
 assert.equal(CUSTOM_ENTITIES.length, 3);
 assert.ok(CUSTOM_ENTITIES.includes('issues'));
 assert.ok(CUSTOM_ENTITIES.includes('captures'));
 assert.ok(CUSTOM_ENTITIES.includes('milestones'));
 });
});
