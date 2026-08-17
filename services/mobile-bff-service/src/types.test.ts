import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
 MOBILE_SESSION_STATUSES,
 MOBILE_KINDS,
 type MobileSessionStatus,
 type MobileKind,
} from './types.js';

describe('Mobile BFF — types', () => {
 it('MOBILE_SESSION_STATUSES has 6 states', () => {
 assert.equal(MOBILE_SESSION_STATUSES.length, 6);
 assert.deepEqual([...MOBILE_SESSION_STATUSES].sort(),
 ['archived', 'failed', 'processing', 'ready', 'recording', 'uploading']);
 });

 it('MOBILE_KINDS has 4 kinds', () => {
 assert.equal(MOBILE_KINDS.length, 4);
 assert.deepEqual([...MOBILE_KINDS].sort(),
 ['incident', 'postconstruction', 'preconstruction', 'walkthrough_360']);
 });

 it('MobileSessionStatus supports all 6 statuses', () => {
 const statuses: MobileSessionStatus[] = ['recording', 'uploading', 'processing', 'ready', 'failed', 'archived'];
 for (const s of statuses) assert.equal(s, s);
 });

 it('MobileKind supports all 4 kinds', () => {
 const kinds: MobileKind[] = ['walkthrough_360', 'preconstruction', 'postconstruction', 'incident'];
 for (const k of kinds) assert.equal(k, k);
 });
});
