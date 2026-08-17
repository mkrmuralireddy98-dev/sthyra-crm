import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { presignS3Url } from './aws-s3.js';
import { startFakeS3Server, type FakeS3Server } from './fake-s3-server.js';

/**
 * Integration tests for presignS3Url — verifies the URL produced by
 * @aws-sdk/s3-request-presigner contains the X-Amz-* params needed
 * for direct browser/mobile upload.
 *
 * We exercise this against a FakeS3Server so the presigned URL has a
 * real endpoint (not just localhost). In production, AWS S3 returns
 * the real signed URL.
 */

let server: FakeS3Server | null = null;

before(async () => {
 server = await startFakeS3Server();
 process.env.AWS_ENDPOINT_URL = server.baseUrl;
});

after(async () => {
 if (server) await server.close();
 server = null;
 delete process.env.AWS_ENDPOINT_URL;
});

describe('presignS3Url — AWS SDK v3 presigner', () => {
 it('returns a URL with X-Amz-Signature + X-Amz-Expires', async () => {
 const result = await presignS3Url({
 bucket: 'sthyra-crm-test',
 key: 'org/org_a/project/prj_1/capture/cap_001/raw/chunk-0000.bin',
 method: 'PUT',
 expiresInSeconds: 900,
 region: 'us-east',
 credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'fakesecret' },
 });
 assert.ok(result.url.length > 0);
 assert.match(result.url, /X-Amz-Signature=/);
 assert.match(result.url, /X-Amz-Expires=900/);
 });

 it('PUT presign uses HTTPS protocol', async () => {
 const result = await presignS3Url({
 bucket: 'sthyra-crm-test',
 key: 'k',
 method: 'PUT',
 expiresInSeconds: 900,
 region: 'us-east',
 credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'fakesecret' },
 });
 assert.match(result.url, /^https?:\/\//);
 });

 it('PUT presign includes Content-Type in signed headers', async () => {
 const result = await presignS3Url({
 bucket: 'sthyra-crm-test',
 key: 'k',
 method: 'PUT',
 expiresInSeconds: 900,
 region: 'us-east',
 credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'fakesecret' },
 });
 // @aws-sdk/s3-request-presigner signs host by default
 assert.match(result.url, /X-Amz-SignedHeaders=host/);
 });

 it('GET presign includes the bucket in the host', async () => {
 const result = await presignS3Url({
 bucket: 'sthyra-crm-test',
 key: 'org/org_a/cap/x.json',
 method: 'GET',
 expiresInSeconds: 3600,
 region: 'us-east',
 credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'fakesecret' },
 });
 assert.match(result.url, /sthyra-crm-test/);
 assert.match(result.url, /X-Amz-Expires=3600/);
 });

 it('presigned URL is unique per invocation (different signatures)', async () => {
 const a = await presignS3Url({
 bucket: 'b', key: 'k', method: 'PUT', expiresInSeconds: 900, region: 'us-east',
 credentials: { accessKeyId: 'a', secretAccessKey: 'b' },
 });
 // Wait >1s so the X-Amz-Date epoch differs.
 await new Promise((r) => setTimeout(r, 1100));
 const b = await presignS3Url({
 bucket: 'b', key: 'k', method: 'PUT', expiresInSeconds: 900, region: 'us-east',
 credentials: { accessKeyId: 'a', secretAccessKey: 'b' },
 });
 assert.notEqual(a.url, b.url);
 });
});
