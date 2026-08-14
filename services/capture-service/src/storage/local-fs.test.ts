import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { LocalFsStorage } from './local-fs.js';
import { captureChunkKey, captureManifestKey } from './index.js';

/**
 * LocalFsStorage — dev/test implementation of BlobStorage.
 *
 * Writes under a configurable root directory (default .dev-storage/).
 * Tenant prefix is enforced by the key construction, not by the storage —
 * callers MUST use captureChunkKey() / captureManifestKey() to build keys.
 */

let tmpRoot: string;
let storage: LocalFsStorage;

beforeEach(async () => {
 tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plumb-storage-'));
 storage = new LocalFsStorage({ root: tmpRoot });
});

afterEach(async () => {
 await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('LocalFsStorage — chunk PUT/GET round-trip', () => {
 it('writes and reads back bytes identically', async () => {
 const data = crypto.randomBytes(1024 * 64); // 64 KB
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(key, data);
 const read = await storage.get(key);
 assert.equal(read.length, data.length);
 assert.ok(data.equals(read));
 });

 it('stores under the configured root', async () => {
 const data = Buffer.from('hello world');
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(key, data);
 const onDisk = await fs.readFile(path.join(tmpRoot, key));
 assert.equal(onDisk.toString(), 'hello world');
 });

 it('preserves contentType and metadata', async () => {
 const data = Buffer.from('x');
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(key, data, { contentType: 'application/octet-stream', metadata: { deviceModel: 'X4' } });
 const info = await storage.head(key);
 assert.equal(info.contentType, 'application/octet-stream');
 });

 it('round-trip preserves sha256 when supplied', async () => {
 const data = Buffer.from('roundtrip');
 const expectedSha = crypto.createHash('sha256').update(data).digest('hex');
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(key, data, { sha256: expectedSha });
 const info = await storage.head(key);
 assert.equal(info.sha256, expectedSha);
 });
});

describe('LocalFsStorage — tenant boundary (Constitution §II)', () => {
 it('captures in org_a are not visible from org_b (path-isolated)', async () => {
 const data = Buffer.from('tenant_a_data');
 const keyA = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(keyA, data);
 // Same captureId + chunkIndex but in org_b → different key
 const keyB = captureChunkKey({ region: 'us-east', orgId: 'org_b', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 // keyB should not exist
 assert.equal(await storage.exists(keyB), false);
 // Trying to GET org_b's key throws (does not leak org_a's data)
 await assert.rejects(storage.get(keyB), /not found/i);
 });

 it('manifest keys are per-capture (no cross-capture leakage)', async () => {
 const m1 = captureManifestKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' });
 const m2 = captureManifestKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_2' });
 assert.notEqual(m1, m2);
 });
});

describe('LocalFsStorage — exists / head / delete', () => {
 it('exists returns true after put, false before', async () => {
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 assert.equal(await storage.exists(key), false);
 await storage.put(key, Buffer.from('x'));
 assert.equal(await storage.exists(key), true);
 });

 it('head returns size and contentType', async () => {
 const data = Buffer.alloc(123);
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(key, data, { contentType: 'video/mp4' });
 const info = await storage.head(key);
 assert.equal(info.size, 123);
 assert.equal(info.contentType, 'video/mp4');
 });

 it('head returns zeros for missing object (caller uses exists() to disambiguate)', async () => {
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'no_cap' }, 0);
 const info = await storage.head(key);
 assert.equal(info.size, 0);
 });

 it('delete is idempotent', async () => {
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(key, Buffer.from('x'));
 await storage.delete(key);
 assert.equal(await storage.exists(key), false);
 // second delete does not throw
 await storage.delete(key);
 assert.equal(await storage.exists(key), false);
 });
});

describe('LocalFsStorage — concatenate (assembly)', () => {
 it('concatenates 3 chunks into one final object, in order', async () => {
 const part1 = Buffer.from('AAAA');
 const part2 = Buffer.from('BBBB');
 const part3 = Buffer.from('CCCC');
 const k1 = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 const k2 = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 1);
 const k3 = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 2);
 await storage.put(k1, part1);
 await storage.put(k2, part2);
 await storage.put(k3, part3);
 const finalKey = captureManifestKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }).replace('manifest.json', 'final.bin');
 await storage.concatenate(finalKey, [k1, k2, k3]);
 const final = await storage.get(finalKey);
 assert.equal(final.toString(), 'AAAABBBBCCCC');
 });

 it('concatenate with one part still produces a single object', async () => {
 const data = Buffer.from('only');
 const k = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(k, data);
 const finalKey = captureManifestKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' });
 await storage.concatenate(finalKey, [k]);
 const final = await storage.get(finalKey);
 assert.equal(final.toString(), 'only');
 });
});

describe('LocalFsStorage — signedUrl', () => {
 it('returns a file:// URL pointing at the local path (dev-mode shortcut)', async () => {
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_1' }, 0);
 await storage.put(key, Buffer.from('x'));
 const url = await storage.signedUrl(key, { method: 'GET', expiresInSeconds: 900 });
 assert.match(url, /^file:\/\//);
 });
});
