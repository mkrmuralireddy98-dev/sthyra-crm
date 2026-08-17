import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { AwsS3Client, presignS3Url } from './aws-s3.js';
import { S3Storage } from './s3.js';
import { startFakeS3Server, type FakeS3Server } from './fake-s3-server.js';
import { captureChunkKey } from './index.js';

/**
 * End-to-end integration: AwsS3Client + S3Storage + FakeS3Server.
 *
 * Exercises the REAL @aws-sdk/client-s3 against a local HTTP server
 * that mimics S3 responses. No AWS credentials required.
 */

let server: FakeS3Server | null = null;
let s3: AwsS3Client;
let storage: S3Storage;

beforeEach(async () => {
 server = await startFakeS3Server();
 s3 = new AwsS3Client({
 bucket: 'sthyra-crm-test',
 region: 'us-east',
 // Point the SDK at our fake server by overriding the endpoint.
 credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
 });
 // Override endpoint via S3 client config. We need a way to pass endpoint;
 // Phase 1.b: use the env var AWS_ENDPOINT_URL.
 process.env.AWS_ENDPOINT_URL = server.baseUrl;

 // Re-instantiate so it picks up the env var
 s3 = new AwsS3Client({
 bucket: 'sthyra-crm-test',
 region: 'us-east',
 credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
 });

 storage = new S3Storage({
 bucket: 'sthyra-crm-test',
 region: 'us-east',
 s3,
 presign: async ({ method, expiresInSeconds, bucket, key }) => {
 // For tests, return a fake URL — we don't actually need presigning.
 return `http://fake-s3/${bucket}/${key}?method=${method}&expires=${expiresInSeconds}`;
 },
 });
});

afterEach(async () => {
 if (server) await server.close();
 server = null;
 delete process.env.AWS_ENDPOINT_URL;
});

describe('AwsS3Client + S3Storage — end-to-end against FakeS3Server', () => {
 it('PUT then GET returns the same bytes', async () => {
 const data = Buffer.from('hello world');
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_001' }, 0);
 await storage.put(key, data);
 const read = await storage.get(key);
 assert.equal(read.toString(), 'hello world');
 });

 it('HEAD returns the size', async () => {
 const data = Buffer.alloc(123);
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_002' }, 0);
 await storage.put(key, data);
 const info = await storage.head(key);
 assert.equal(info.size, 123);
 });

 it('DELETE removes the object', async () => {
 const key = captureChunkKey({ region: 'us-east', orgId: 'org_a', projectId: 'prj_1', captureId: 'cap_003' }, 0);
 await storage.put(key, Buffer.from('x'));
 assert.equal(await storage.exists(key), true);
 await storage.delete(key);
 assert.equal(await storage.exists(key), false);
 });

 it('presignS3Url returns a URL string', async () => {
 const result = await presignS3Url({
 bucket: 'b',
 key: 'k',
 method: 'PUT',
 expiresInSeconds: 900,
 region: 'us-east',
 credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
 });
 assert.ok(result.url.length > 0);
 assert.match(result.url, /X/); // AWS-signed URLs include X-Amz-* params
 });
});
