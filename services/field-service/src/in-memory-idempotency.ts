/**
 * InMemoryIdempotencyStore — local copy for field-service.
 *
 * We could import from capture-service, but the field-service should
 * own its own primitive. Same contract as capture-service's version.
 */

export interface IdempotencyStore {
 get<T>(key: string): Promise<T | null>;
 set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

interface Entry {
 readonly value: unknown;
 readonly expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
 private readonly store = new Map<string, Entry>();
 private readonly defaultTtlSeconds = 24 * 60 * 60;

 async get<T>(key: string): Promise<T | null> {
 const entry = this.store.get(key);
 if (!entry) return null;
 if (entry.expiresAt < Date.now()) {
 this.store.delete(key);
 return null;
 }
 return entry.value as T;
 }

 async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
 this.store.set(key, {
 value,
 expiresAt: Date.now() + (ttlSeconds ?? this.defaultTtlSeconds) * 1000,
 });
 }
}
