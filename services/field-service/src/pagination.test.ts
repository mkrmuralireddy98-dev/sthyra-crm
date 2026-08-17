import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { encodeCursor, decodeCursor } from './pagination.js';

const SECRET = 'test-secret-32-bytes-long-padded';

describe('pagination — HMAC cursor', () => {
 it('encodes a cursor to base64url + signature', () => {
 const token = encodeCursor(
 { createdAt: '2026-08-14T00:00:00.000Z', id: 'iss_001', dir: 'next' },
 SECRET,
 );
 assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // base64url.payload.base64url.sig
 });

 it('round-trips through encode + decode', () => {
 const original = { createdAt: '2026-08-14T00:00:00.000Z', id: 'iss_001', dir: 'next' as const };
 const token = encodeCursor(original, SECRET);
 const decoded = decodeCursor(token, SECRET);
 assert.deepEqual(decoded, original);
 });

 it('rejects tampered payload (signature mismatch)', () => {
 const token = encodeCursor(
 { createdAt: '2026-08-14T00:00:00.000Z', id: 'iss_001', dir: 'next' },
 SECRET,
 );
 const [payload, sig] = token.split('.');
 // Tamper with payload by swapping two different characters
 const tamperedPayload = (payload ?? '').split('').reverse().join('');
 const tampered = `${tamperedPayload}.${sig}`;
 assert.throws(() => decodeCursor(tampered, SECRET), /signature/i);
 });

 it('rejects tampered signature', () => {
 const token = encodeCursor(
 { createdAt: '2026-08-14T00:00:00.000Z', id: 'iss_001', dir: 'next' },
 SECRET,
 );
 const [payload, sig] = token.split('.');
 const tampered = `${payload}.${sig?.slice(0, -2)}XX`;
 assert.throws(() => decodeCursor(tampered, SECRET), /signature/i);
 });

 it('rejects expired cursors (TTL)', () => {
 // The test uses the default TTL of 24h. We'll encode then mock expiry.
 const original = { createdAt: '2026-08-14T00:00:00.000Z', id: 'iss_001', dir: 'next' as const };
 const token = encodeCursor(original, SECRET, { ttlSeconds: -1 }); // already expired
 assert.throws(() => decodeCursor(token, SECRET), /expired/i);
 });

 it('encodes prev-direction cursors', () => {
 const token = encodeCursor(
 { createdAt: '2026-08-14T00:00:00.000Z', id: 'iss_001', dir: 'prev' },
 SECRET,
 );
 const decoded = decodeCursor(token, SECRET);
 assert.equal(decoded?.dir, 'prev');
 });

 it('different secrets produce different signatures for same payload', () => {
 const original = { createdAt: '2026-08-14T00:00:00.000Z', id: 'iss_001', dir: 'next' as const };
 const t1 = encodeCursor(original, 'secret-A');
 const t2 = encodeCursor(original, 'secret-B');
 assert.notEqual(t1, t2);
 });
});
