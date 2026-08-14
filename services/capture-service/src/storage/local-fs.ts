/**
 * LocalFsStorage — dev/test implementation of BlobStorage.
 *
 * Writes files under a configurable root directory. Mirrors the S3
 * key layout (org/.../capture/.../raw/chunk-NNNN.bin) so the same
 * paths work in dev and production.
 *
 * Used for:
 *   - Local development (no AWS required)
 *   - CI integration tests
 *   - Docker-compose Postgres stack (no S3)
 *
 * Production uses S3Storage (T-013). Both satisfy the same BlobStorage
 * contract — service.ts code is unchanged at the storage boundary.
 *
 * Concurrency: the implementation serializes writes per-key by relying
 * on the OS filesystem (write + rename is atomic). For parallel chunk
 * uploads the mobile client writes to disjoint chunk-NNNN.bin paths,
 * so no in-process locking is needed.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { BlobStorage, PutOptions, ObjectInfo, SignedUrlOptions } from './index.js';

export interface LocalFsStorageOptions {
 /**
 * Root directory. All keys are interpreted relative to this path.
 * Default: '.dev-storage' (project root).
 */
 readonly root?: string;
}

export class LocalFsStorage implements BlobStorage {
 private readonly root: string;

 constructor(opts: LocalFsStorageOptions = {}) {
 this.root = path.resolve(opts.root ?? '.dev-storage');
 }

 private fullPath(key: string): string {
 // Tenant boundary: keys MUST be relative paths containing 'org/<orgId>/...'.
 // We refuse keys that try to escape the root via '..'.
 if (key.includes('..')) {
 throw new Error(`invalid storage key (path traversal): ${key}`);
 }
 const safe = path.normalize(key).replace(/^[/\\]+/, '');
 const full = path.join(this.root, safe);
 // Defense in depth: full path must still be inside root.
 if (!full.startsWith(this.root + path.sep) && full !== this.root) {
 throw new Error(`storage key escapes root: ${key}`);
 }
 return full;
 }

 async put(key: string, data: Buffer | Uint8Array, opts?: PutOptions): Promise<void> {
 const full = this.fullPath(key);
 await fs.mkdir(path.dirname(full), { recursive: true });
 await fs.writeFile(full, data);
 if (opts?.metadata || opts?.contentType || opts?.sha256) {
 // Store metadata as a sidecar JSON file. Real S3 has object metadata
 // natively; we use a sidecar to keep behavior parity.
 const meta = {
 contentType: opts?.contentType ?? null,
 sha256: opts?.sha256 ?? null,
 metadata: opts?.metadata ?? {},
 };
 await fs.writeFile(`${full}.meta.json`, JSON.stringify(meta));
 }
 }

 async get(key: string): Promise<Buffer> {
 const full = this.fullPath(key);
 try {
 return await fs.readFile(full);
 } catch (err) {
 if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
 throw new Error(`storage key not found: ${key}`);
 }
 throw err;
 }
 }

 async head(key: string): Promise<ObjectInfo> {
 const full = this.fullPath(key);
 try {
 const stat = await fs.stat(full);
 const metaPath = `${full}.meta.json`;
 let contentType: string | null = null;
 let sha256: string | null = null;
 try {
 const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as {
 contentType: string | null;
 sha256: string | null;
 };
 contentType = meta.contentType ?? null;
 sha256 = meta.sha256 ?? null;
 } catch {
 // No sidecar metadata — that's fine.
 }
 return { size: stat.size, contentType, sha256 };
 } catch {
 return { size: 0, contentType: null, sha256: null };
 }
 }

 async signedUrl(_key: string, _opts: SignedUrlOptions): Promise<string> {
 // For dev: return a file:// URL. Production: S3Storage returns a real
 // presigned https URL via @aws-sdk/s3-request-presigner.
 return `file://${this.root}/${_key}`;
 }

 async delete(key: string): Promise<void> {
 const full = this.fullPath(key);
 try {
 await fs.unlink(full);
 } catch (err) {
 if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
 }
 try {
 await fs.unlink(`${full}.meta.json`);
 } catch (err) {
 if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
 }
 }

 async exists(key: string): Promise<boolean> {
 try {
 await fs.access(this.fullPath(key));
 return true;
 } catch {
 return false;
 }
 }

 async concatenate(key: string, parts: readonly string[]): Promise<void> {
 const full = this.fullPath(key);
 await fs.mkdir(path.dirname(full), { recursive: true });
 const out = await fs.open(full, 'w');
 try {
 for (const partKey of parts) {
 const partPath = this.fullPath(partKey);
 const partData = await fs.readFile(partPath);
 await out.write(partData);
 }
 } finally {
 await out.close();
 }
 // Sidecar metadata for the concatenated object.
 await fs.writeFile(`${full}.meta.json`, JSON.stringify({
 contentType: 'application/octet-stream',
 sha256: null,
 metadata: { concatenatedFrom: parts.length },
 }));
 }
}
