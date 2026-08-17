import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { encodeCursor, decodeCursor } from './pagination.js';

const SECRET = 'test-secret-32-bytes-padded';

describe('pagination — HMAC cursor', () => {
 it('round-trips through encode + decode', () => {
 const original = { createdAt: '2026-08-14T00:00:00.000Z', id: 'conv_001', dir: 'next' as const };
 const token = encodeCursor(original, SECRET);
 const decoded = decodeCursor(token, SECRET);
 assert.deepEqual(decoded, original);
 });

 it('rejects tampered payload', () => {
 const token = encodeCursor({ createdAt: '2026-08-14T00:00:00.000Z', id: 'c1', dir: 'next' }, SECRET);
 const [payload, sig] = token.split('.');
 const tampered = `${payload?.split('').reverse().join('')}.${sig}`;
 assert.throws(() => decodeCursor(tampered, SECRET), /signature/);
 });

 it('rejects tampered signature', () => {
 const token = encodeCursor({ createdAt: '2026-08-14T00:00:00.000Z', id: 'c1', dir: 'next' }, SECRET);
 const [payload, sig] = token.split('.');
 const tampered = `${payload}.${sig?.slice(0, -2)}XX`;
 assert.throws(() => decodeCursor(tampered, SECRET), /signature/);
 });

 it('rejects expired cursors', () => {
 const token = encodeCursor({ createdAt: '2026-08-14T00:00:00.000Z', id: 'c1', dir: 'next' }, SECRET, { ttlSeconds: -1 });
 assert.throws(() => decodeCursor(token, SECRET), /expired/);
 });

 it('rejects malformed cursor (no separator)', () => {
 assert.throws(() => decodeCursor('no-separator', SECRET));
 });
});
