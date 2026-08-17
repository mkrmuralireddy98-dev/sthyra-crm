/**
 * SimpleTTL cache — for memoized report generation.
 * Pure pattern: getOrCompute(key, ttl, compute) — caches the result of compute.
 */

export class SimpleTTLCache<K, V> {
 private entries = new Map<K, { value: V; expiresAt: number }>();

 getOrCompute(key: K, ttlSeconds: number, compute: () => V, now: () => number = Date.now): V {
 const cached = this.entries.get(key);
 if (cached && cached.expiresAt > now()) {
 return cached.value;
 }
 const value = compute();
 this.entries.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
 return value;
 }

 has(key: K): boolean {
 const cached = this.entries.get(key);
 if (!cached) return false;
 return cached.expiresAt > Date.now();
 }

 clear(): void { this.entries.clear(); }

 size(): number { return this.entries.size; }
}
