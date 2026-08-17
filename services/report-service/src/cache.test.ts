import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SimpleTTLCache } from './cache.js';

describe('SimpleTTLCache', () => {
 it('computes on first call', () => {
 const cache = new SimpleTTLCache<string, number>();
 const result = cache.getOrCompute('k', 60, () => 42);
 assert.equal(result, 42);
 });

 it('returns cached on second call (within TTL)', () => {
 const cache = new SimpleTTLCache<string, number>();
 let calls = 0;
 cache.getOrCompute('k', 60, () => ++calls);
 cache.getOrCompute('k', 60, () => ++calls);
 assert.equal(calls, 1);
 });

 it('recomputes after TTL expiry', () => {
 const cache = new SimpleTTLCache<string, number>();
 let calls = 0;
 let nowMs = 1000;
 const fakeNow = () => nowMs;
 cache.getOrCompute('k', 60, () => ++calls, fakeNow);
 nowMs = 70000; // 70s later → TTL expired
 cache.getOrCompute('k', 60, () => ++calls, fakeNow);
 assert.equal(calls, 2);
 });

 it('has() returns false for missing keys', () => {
 const cache = new SimpleTTLCache<string, number>();
 assert.equal(cache.has('k'), false);
 });

 it('clear() empties cache', () => {
 const cache = new SimpleTTLCache<string, number>();
 cache.getOrCompute('k', 60, () => 42);
 assert.equal(cache.size(), 1);
 cache.clear();
 assert.equal(cache.size(), 0);
 });
});
