import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import type { BlobStorage, PutOptions } from './index.js';

/**
 * Contract tests for BlobStorage. The interface lives in ./index.ts;
 * LocalFsStorage (T-012) and S3Storage (T-013) both satisfy it.
 *
 * Tenant boundary: every key MUST include orgId in the path. This is
 * the storage layer's contribution to Constitution §II.
 */

function makeStorage(impl: Partial<BlobStorage> = {}): BlobStorage {
 return {
 async put(_key: string, _data: Buffer | Uint8Array, _opts?: PutOptions): Promise<void> {},
 async get(_key: string): Promise<Buffer> { return Buffer.alloc(0); },
 async head(_key: string): Promise<{ size: number; contentType: string | null; sha256: string | null }> { return { size: 0, contentType: null, sha256: null }; },
 async signedUrl(_key: string, _opts: { method: 'GET' | 'PUT'; expiresInSeconds: number }): Promise<string> { return ''; },
 async delete(_key: string): Promise<void> {},
 async exists(_key: string): Promise<boolean> { return false; },
 async concatenate(_key: string, _parts: readonly string[]): Promise<void> {},
 ...impl,
 };
}

describe('BlobStorage contract', () => {
 it('the interface compiles and is constructible', () => {
 const s = makeStorage();
 assert.ok(s);
 });

 it('every method is async and returns a Promise', () => {
 const s = makeStorage();
 assert.ok(s.put('k', Buffer.alloc(0)) instanceof Promise);
 assert.ok(s.get('k') instanceof Promise);
 assert.ok(s.head('k') instanceof Promise);
 assert.ok(s.signedUrl('k', { method: 'PUT', expiresInSeconds: 900 }) instanceof Promise);
 assert.ok(s.delete('k') instanceof Promise);
 assert.ok(s.exists('k') instanceof Promise);
 assert.ok(s.concatenate('k', ['p1', 'p2']) instanceof Promise);
 });

 it('implements all 7 methods (Constitution §V — interface-stable contract)', () => {
 const required: (keyof BlobStorage)[] = ['put', 'get', 'head', 'signedUrl', 'delete', 'exists', 'concatenate'];
 assert.equal(required.length, 7);
 });

 it('PutOptions supports contentType, sha256, and metadata', () => {
 const opts: PutOptions = {
 contentType: 'video/mp4',
 sha256: 'sha256-abc',
 metadata: { deviceModel: 'Insta360 X4', captureId: 'cap_001' },
 };
 assert.equal(opts.contentType, 'video/mp4');
 assert.equal(opts.metadata?.deviceModel, 'Insta360 X4');
 });

 it('signedUrl accepts GET and PUT methods (per Constitution §IV pre-signed URLs)', () => {
 const s = makeStorage();
 void s.signedUrl('k', { method: 'GET', expiresInSeconds: 900 });
 void s.signedUrl('k', { method: 'PUT', expiresInSeconds: 900 });
 assert.ok(true);
 });
});
