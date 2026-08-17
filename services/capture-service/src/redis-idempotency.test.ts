import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { RedisIdempotencyStore, type RedisClientLike } from './redis-idempotency.js';

/**
 * RedisIdempotencyStore tests with a fake Redis client.
 * Production wires the real `redis` package.
 */

interface FakeRedis {
 store: Map<string, string>;
 calls: Array<{ cmd: string; key: string; ttl?: number }>;
}

let fake: FakeRedis;
let client: RedisClientLike;
let store: RedisIdempotencyStore;

beforeEach(() => {
 fake = { store: new Map(), calls: [] };
 client = {
 async set(key: string, value: string, expirySeconds?: number): Promise<unknown> {
 fake.calls.push({ cmd: 'set', key, ttl: expirySeconds });
 fake.store.set(key, value);
 return 'OK';
 },
 async get(key: string): Promise<string | null> {
 fake.calls.push({ cmd: 'get', key });
 return fake.store.get(key) ?? null;
 },
 async del(key: string): Promise<number> {
 fake.calls.push({ cmd: 'del', key });
 return fake.store.delete(key) ? 1 : 0;
 },
 };
 store = new RedisIdempotencyStore({ redis: client });
});

describe('RedisIdempotencyStore', () => {
 it('get returns null for missing key', async () => {
 const v = await store.get('missing');
 assert.equal(v, null);
 });

 it('set then get returns the stored value', async () => {
 await store.set('key-1', { orgId: 'org_a' });
 const v = await store.get<{ orgId: string }>('key-1');
 assert.equal(v?.orgId, 'org_a');
 });

 it('uses a keyPrefix for namespace isolation', async () => {
 const s2 = new RedisIdempotencyStore({ redis: client, keyPrefix: 'myapp:' });
 await s2.set('foo', 'bar');
 // First call should have used the prefixed key
 const getCall = fake.calls.find((c) => c.cmd === 'set');
 assert.ok(getCall?.key.startsWith('myapp:'));
 });

 it('serializes values as JSON', async () => {
 await store.set('key-2', { captureId: 'cap_001', ttl: 24 * 60 * 60 });
 const stored = fake.store.get('sthyra-crm:idempotency:key-2');
 assert.ok(stored);
 const parsed = JSON.parse(stored ?? '{}') as { captureId: string };
 assert.equal(parsed.captureId, 'cap_001');
 });

 it('default TTL is 24 hours (Constitution NFR-4)', async () => {
 await store.set('key-3', { ok: '1' });
 const setCall = fake.calls.find((c) => c.cmd === 'set');
 assert.equal(setCall?.ttl, 24 * 60 * 60);
 });

 it('honors custom TTL', async () => {
 await store.set('key-4', { ok: '1' }, 60);
 const setCall = fake.calls.find((c) => c.cmd === 'set' && c.key.includes('key-4'));
 assert.equal(setCall?.ttl, 60);
 });

 it('delete removes the key', async () => {
 await store.set('key-5', { ok: '1' });
 await store.delete('key-5');
 assert.equal(await store.get('key-5'), null);
 });

 it('get on a deleted key returns null', async () => {
 await store.set('key-6', { ok: '1' });
 await store.delete('key-6');
 const v = await store.get('key-6');
 assert.equal(v, null);
 });

 it('returns null when stored JSON is corrupt (defensive)', async () => {
 fake.store.set('sthyra-crm:idempotency:corrupt', 'not valid json {');
 const v = await store.get('corrupt');
 assert.equal(v, null);
 });

 it('serializes complex nested objects', async () => {
 const complex = { capture: { id: 'cap_001', orgId: 'org_a' }, timestamp: 12345, list: [1, 2, 3] };
 await store.set('complex', complex);
 const v = await store.get<typeof complex>('complex');
 assert.deepEqual(v, complex);
 });
});
