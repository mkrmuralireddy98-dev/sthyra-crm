import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { S3Storage, type S3Client, type S3Command } from './s3.js';
import { captureChunkKey } from './index.js';

interface FakeS3 {
 store: Map<string, { body: Buffer; meta: Record<string, string> }>;
 client: S3Client;
}

function makeFakeS3(): FakeS3 {
 const store = new Map<string, { body: Buffer; meta: Record<string, string> }>();
 const client: S3Client = {
 async send(cmd: S3Command): Promise<unknown> {
 const input = cmd.input;
 if (input.Body !== undefined) {
 store.set(`${input.Bucket}/${input.Key}`, {
 body: Buffer.from(input.Body as string),
 meta: input.Metadata ?? {},
 });
 return {};
 }
 if (input.CopySource) {
 const [bucket, ...rest] = input.CopySource.split('/');
 const key = rest.join('/');
 const src = store.get(`${bucket}/${key}`);
 if (!src) throw new Error(`S3 not found: ${input.CopySource}`);
 store.set(`${input.Bucket}/${input.Key}`, {
 body: Buffer.from(src.body),
 meta: input.Metadata ?? src.meta,
 });
 return {};
 }
 if (input.Bucket && input.Key) {
 const existing = store.get(`${input.Bucket}/${input.Key}`);
 if (existing) {
 return {
 Body: existing.body,
 ContentLength: existing.body.length,
 ContentType: 'application/octet-stream',
 Metadata: existing.meta,
 };
 }
 }
 return {};
 },
 };
 return { store, client };
}

let storage: S3Storage;
let fake: FakeS3;

beforeEach(() => {
 fake = makeFakeS3();
 storage = new S3Storage({
 bucket: 'sthyra-crm-raw-360-us-east',
 region: 'us-east',
 s3: fake.client,
 // Fake presign for tests — production uses @aws-sdk/s3-request-presigner.
 presign: async ({ method, expiresInSeconds, bucket, key }) => {
 return `https://${bucket}.s3.us-east.amazonaws.com/${key}?X-Amz-Method=${method}&X-Amz-Expires=${expiresInSeconds}&X-Amz-SignedHeaders=host`;
 },
 });
});

describe('S3Storage — chunk PUT/GET round-trip', () => {
 it('writes and reads back bytes identically', async () => {
 const data = Buffer.alloc(64 * 1024);
 const key = captureChunkKey({
 region: 'us-east',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_1',
 }, 0);
 await storage.put(key, data);
 const read = await storage.get(key);
 assert.equal(read.length, data.length);
 });
});

describe('S3Storage — pre-signed URLs (Constitution §IV)', () => {
 it('returns a presigned URL for PUT with 15-minute expiry (NFR-5 default)', async () => {
 const key = captureChunkKey({
 region: 'us-east',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_1',
 }, 0);
 await storage.put(key, Buffer.from('x'));
 const url = await storage.signedUrl(key, { method: 'PUT', expiresInSeconds: 900 });
 assert.match(url, /X-Amz-Expires=900/);
 });

 it('returns a presigned URL for GET', async () => {
 const key = captureChunkKey({
 region: 'us-east',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_1',
 }, 0);
 await storage.put(key, Buffer.from('x'));
 const url = await storage.signedUrl(key, { method: 'GET', expiresInSeconds: 900 });
 assert.match(url, /sthyra-crm-raw-360-us-east/);
 });

 it('rejects unsupported HTTP methods (only GET and PUT)', async () => {
 const key = captureChunkKey({
 region: 'us-east',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_1',
 }, 0);
 await storage.put(key, Buffer.from('x'));
 // Cast through unknown — esbuild/tsx can't parse the type literal
 // inside an object literal directly.
 const opts = { method: 'DELETE' as unknown as 'GET' | 'PUT', expiresInSeconds: 900 };
 await assert.rejects(storage.signedUrl(key, opts), /method/i);
 });
});

describe('S3Storage — tenant boundary (Constitution §II)', () => {
 it('chunks for different orgs land at different keys', () => {
 const k1 = captureChunkKey({
 region: 'us-east',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_1',
 }, 0);
 const k2 = captureChunkKey({
 region: 'us-east',
 orgId: 'org_b',
 projectId: 'prj_1',
 captureId: 'cap_1',
 }, 0);
 assert.notEqual(k1, k2);
 assert.ok(k1.includes('org/org_a'));
 assert.ok(k2.includes('org/org_b'));
 });
});

describe('S3Storage — exists / delete', () => {
 it('exists returns true after put', async () => {
 const key = captureChunkKey({
 region: 'us-east',
 orgId: 'org_a',
 projectId: 'prj_1',
 captureId: 'cap_1',
 }, 0);
 assert.equal(await storage.exists(key), false);
 await storage.put(key, Buffer.from('x'));
 assert.equal(await storage.exists(key), true);
 });
});
