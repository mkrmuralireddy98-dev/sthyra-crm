/**
 * RedisIdempotencyStore — production IdempotencyStore backed by Redis.
 *
 * The in-memory store (`InMemoryIdempotencyStore` in repo-memory.ts) is
 * the Phase 1 MVP. For multi-instance deployment, we need a store
 * that survives across processes — Redis is the natural choice.
 *
 * The implementation uses `SET key value EX ttl` for atomic
 * put-with-TTL. Reads use `GET key`. The client is lazy-loaded so
 * tests don't need redis installed.
 */

import type { IdempotencyStore } from './repository.js';

export interface RedisClientLike {
 set(key: string, value: string, expirySeconds?: number): Promise<unknown>;
 get(key: string): Promise<string | null>;
 del(key: string): Promise<number>;
}

export interface RedisIdempotencyStoreOptions {
 readonly redis: RedisClientLike;
 readonly keyPrefix?: string;
}

export class RedisIdempotencyStore implements IdempotencyStore {
 private readonly redis: RedisClientLike;
 private readonly keyPrefix: string;

 constructor(opts: RedisIdempotencyStoreOptions) {
 this.redis = opts.redis;
 this.keyPrefix = opts.keyPrefix ?? 'sthyra-crm:idempotency:';
 }

 private fullKey(key: string): string {
 return `${this.keyPrefix}${key}`;
 }

 async get<T>(key: string): Promise<T | null> {
 const raw = await this.redis.get(this.fullKey(key));
 if (raw === null) return null;
 try {
 return JSON.parse(raw) as T;
 } catch {
 return null;
 }
 }

 async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
 const serialized = JSON.stringify(value);
 await this.redis.set(this.fullKey(key), serialized, ttlSeconds ?? 24 * 60 * 60);
 }

 async delete(key: string): Promise<void> {
 await this.redis.del(this.fullKey(key));
 }
}

/**
 * Create a Redis client from the standard `redis` package.
 * Lazy-loaded so tests don't need it installed.
 */
export async function createDefaultRedisClient(opts: { url?: string } = {}): Promise<RedisClientLike> {
 const url = opts.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
 const mod = await import('redis');
 const client = mod.createClient({ url });
 await client.connect();
 return {
 async set(key: string, value: string, expirySeconds?: number): Promise<unknown> {
 const args: string[] = [];
 if (expirySeconds !== undefined) args.push('EX', String(expirySeconds));
 // Cast through unknown for the SDK variadic types
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 return (client as any).set(key, value, ...args);
 },
 async get(key: string): Promise<string | null> {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 return await (client as any).get(key) ?? null;
 },
 async del(key: string): Promise<number> {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 return await (client as any).del(key);
 },
 };
}
