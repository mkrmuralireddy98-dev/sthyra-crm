import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { tierFor, StorageClass, TIER_BOUNDARIES_DAYS } from './tiering.js';

/**
 * Storage tiering helper — pure function. Determines the appropriate
 * S3 storage class for a given object age, per plan.md §Storage tiering:
 *
 *   age (days)  →  storage class
 *   -----------------------------------------
 *   0–30         →  Standard
 *   30–90        →  Standard-IA
 *   90–365       →  Standard-IA (artifacts) OR Glacier (raw)
 *   365+         →  Glacier (raw) OR Glacier Deep Archive (artifacts)
 *
 * Boundary semantics: tierFor returns the class for the FIRST day the
 * object qualifies. e.g., at age=30.0 days the object transitions from
 * Standard to Standard-IA. At age=90.0 days from Standard-IA → ...
 *
 * The function is pure — no I/O, no Date.now() — so it's deterministic
 * and trivially testable.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function days(n: number): number { return n * ONE_DAY_MS; }

describe('tierFor — age boundaries (per plan.md §NFR-6)', () => {
 it('returns Standard for fresh captures (age = 0)', () => {
 assert.equal(tierFor(days(0)), StorageClass.STANDARD);
 });

 it('returns Standard on day 29 (still within 30-day Standard window)', () => {
 assert.equal(tierFor(days(29)), StorageClass.STANDARD);
 });

 it('returns STANDARD_IA at day 30 (transition boundary)', () => {
 assert.equal(tierFor(days(30)), StorageClass.STANDARD_IA);
 });

 it('returns STANDARD_IA at day 89 (still within 30–90 Standard-IA window)', () => {
 assert.equal(tierFor(days(89)), StorageClass.STANDARD_IA);
 });

 it('returns STANDARD_IA at day 90 (still IA — artifacts tier rule)', () => {
 assert.equal(tierFor(days(90)), StorageClass.STANDARD_IA);
 });

 it('returns STANDARD_IA at day 364 (within 90–365 window)', () => {
 assert.equal(tierFor(days(364)), StorageClass.STANDARD_IA);
 });

 it('returns GLACIER at day 365 (7-year retention trigger)', () => {
 assert.equal(tierFor(days(365)), StorageClass.GLACIER);
 });

 it('returns GLACIER at day 3650 (10 years in)', () => {
 assert.equal(tierFor(days(3650)), StorageClass.GLACIER);
 });
});

describe('tierFor — boundary constants are exported and sensible', () => {
 it('exports the 30 / 90 / 365 boundary constants', () => {
 assert.equal(TIER_BOUNDARIES_DAYS.STANDARD_TO_IA, 30);
 assert.equal(TIER_BOUNDARIES_DAYS.IA_TO_GLACIER, 90);
 assert.equal(TIER_BOUNDARIES_DAYS.GLACIER_TO_DEEP_ARCHIVE, 365);
 });

 it('returns STANDARD for negative ages (defensive — future-dated objects)', () => {
 assert.equal(tierFor(-1000), StorageClass.STANDARD);
 });

 it('returns STANDARD for age=0.5 day (fractional)', () => {
 assert.equal(tierFor(days(0.5)), StorageClass.STANDARD);
 });
});
