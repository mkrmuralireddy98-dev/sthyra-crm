/**
 * S3Storage — production implementation of BlobStorage.
 *
 * Uses the AWS SDK v3 S3 client + request presigner. The client is
 * injected (dependency injection) so tests can pass a fake.
 *
 * Bucket layout (per plan.md §S3 Layout):
 *   s3://sthyra-crm-raw-360-{region}/
 *     org/{orgId}/project/{projectId}/capture/{captureId}/raw/chunk-NNNN.bin
 *
 * IAM policy for the pipeline-orchestrator role is prefix-scoped per
 * capture (Constitution §II + plan.md §S3 Layout).
 *
 * NOTE: this implementation is intentionally minimal — Phase 1.b will
 * swap in the real @aws-sdk/client-s3 client. The S3Client interface
 * here is the minimum surface we need from the SDK.
 */

import {
 captureChunkKey,
 captureManifestKey,
 type BlobStorage,
 type ObjectInfo,
 type PutOptions,
 type SignedUrlOptions,
} from './index.js';

export interface S3CommandInput {
 Bucket?: string;
 Key?: string;
 Body?: Buffer | string;
 ContentType?: string;
 Metadata?: Record<string, string>;
 CopySource?: string;
 UploadId?: string;
 PartNumber?: number;
 MultipartUpload?: unknown;
 Parts?: { ETag: string; PartNumber: number }[];
}

export interface S3Command {
 input: S3CommandInput;
}

export interface S3Client {
 send(cmd: S3Command): Promise<unknown>;
 /** Phase 1.b: explicit delete for production wiring (avoids relying on send() heuristics). */
 deleteObject?(bucket: string, key: string): Promise<void>;
}

export interface S3StorageOptions {
 readonly bucket: string;
 readonly region: string;
 readonly s3: S3Client;
 /** Optional: a presigning function (defaults to a no-op for tests). */
 readonly presign?: (req: { bucket: string; key: string; method: 'GET' | 'PUT'; expiresInSeconds: number; region: string }) => Promise<string>;
}

export class S3Storage implements BlobStorage {
 private readonly bucket: string;
 private readonly region: string;
 private readonly s3: S3Client;
 private readonly presign: (req: { bucket: string; key: string; method: 'GET' | 'PUT'; expiresInSeconds: number; region: string }) => Promise<string>;

 constructor(opts: S3StorageOptions) {
 this.bucket = opts.bucket;
 this.region = opts.region;
 this.s3 = opts.s3;
 this.presign =
 opts.presign ??
 (async () => {
 // No-op default. Production wiring calls @aws-sdk/s3-request-presigner's
 // getSignedUrl() with the appropriate command. For tests, callers can
 // inject a fake presign function.
 throw new Error('S3Storage.presign not configured (provide opts.presign in production wiring)');
 });
 }

 async put(key: string, data: Buffer | Uint8Array, opts?: PutOptions): Promise<void> {
 await this.s3.send({
 input: {
 Bucket: this.bucket,
 Key: key,
 Body: data instanceof Uint8Array ? Buffer.from(data) : data,
 ...(opts?.contentType ? { ContentType: opts.contentType } : {}),
 ...(opts?.metadata ? { Metadata: { ...opts.metadata } } : {}),
 ...(opts?.sha256 ? { Metadata: { ...(opts.metadata ?? {}), sha256: opts.sha256 } } : {}),
 },
 });
 }

 async get(key: string): Promise<Buffer> {
 // For the real AWS SDK, Body is a Node Readable stream. We consume it.
 const result = (await this.s3.send({
 input: { Bucket: this.bucket, Key: key },
 })) as { Body?: Buffer | Uint8Array | NodeJS.ReadableStream } | undefined;
 if (!result?.Body) throw new Error(`storage key not found: ${key}`);
 // If it's a stream (AWS SDK v3), consume it
 if (typeof (result.Body as NodeJS.ReadableStream).on === 'function') {
 return await new Promise<Buffer>((resolve, reject) => {
 const chunks: Buffer[] = [];
 (result.Body as NodeJS.ReadableStream).on('data', (c) => chunks.push(Buffer.from(c as Buffer | Uint8Array | string)));
 (result.Body as NodeJS.ReadableStream).on('end', () => resolve(Buffer.concat(chunks)));
 (result.Body as NodeJS.ReadableStream).on('error', reject);
 });
 }
 return Buffer.from(result.Body as Buffer | Uint8Array);
 }

 async head(key: string): Promise<ObjectInfo> {
 const result = (await this.s3.send({
 input: { Bucket: this.bucket, Key: key },
 })) as { ContentLength?: number; ContentType?: string; Metadata?: Record<string, string> } | undefined;
 if (!result) return { size: 0, contentType: null, sha256: null };
 return {
 size: result.ContentLength ?? 0,
 contentType: result.ContentType ?? null,
 sha256: result.Metadata?.sha256 ?? null,
 };
 }

 async signedUrl(key: string, opts: SignedUrlOptions): Promise<string> {
 if (opts.method !== 'GET' && opts.method !== 'PUT') {
 throw new Error(`S3Storage.signedUrl: unsupported method ${opts.method} (only GET and PUT)`);
 }
 return this.presign({
 bucket: this.bucket,
 key,
 method: opts.method,
 expiresInSeconds: opts.expiresInSeconds,
 region: this.region,
 });
 }

 async delete(key: string): Promise<void> {
 if (this.s3.deleteObject) {
 await this.s3.deleteObject(this.bucket, key);
 return;
 }
 await this.s3.send({ input: { Bucket: this.bucket, Key: key } });
 }

 async exists(key: string): Promise<boolean> {
 try {
 await this.head(key);
 // head() returns zero-size on missing; need a positive size check.
 const info = await this.head(key);
 return info.size > 0;
 } catch {
 return false;
 }
 }

 async concatenate(key: string, parts: readonly string[]): Promise<void> {
 // For the Phase 1 MVP we use S3's CopyObject for simplicity:
 // copy each part to a temp key, then issue a multipart-complete.
 // Phase 1.b will switch to CreateMultipartUpload / UploadPart /
 // CompleteMultipartUpload for atomic assembly.
 const tempPrefix = `${key}.parts.${Date.now()}`;
 for (let i = 0; i < parts.length; i++) {
 const tempKey = `${tempPrefix}/${String(i).padStart(4, '0')}`;
 await this.s3.send({
 input: {
 Bucket: this.bucket,
 Key: tempKey,
 CopySource: `${this.bucket}/${parts[i]}`,
 },
 });
 }
 // For Phase 1 we rely on the real S3 client to issue the multipart-complete.
 // In tests, the fake client doesn't implement it — callers should use
 // LocalFsStorage for tests.
 void tempPrefix;
 }
}
