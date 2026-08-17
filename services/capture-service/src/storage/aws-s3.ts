/**
 * AwsS3Client — real AWS S3 client wrapping @aws-sdk/client-s3.
 *
 * Implements the S3Client interface from ./s3.js. Used by S3Storage in
 * production. Tests pass a fake (see s3.test.ts).
 *
 * NOTE: @aws-sdk/client-s3 is loaded lazily so tests don't need it installed.
 */

import type {
 S3Client,
 S3Command,
 S3CommandInput,
} from './s3.js';

export interface AwsS3ClientOptions {
 readonly bucket: string;
 readonly region: string;
 /** Optional: AWS credentials. Defaults to env / IAM role. */
 readonly credentials?: { accessKeyId: string; secretAccessKey: string };
}

export class AwsS3Client implements S3Client {
 private readonly bucket: string;
 private readonly region: string;
 private readonly credentials: AwsS3ClientOptions['credentials'];
 private readonly endpoint: string | undefined;
 private clientPromise: Promise<unknown> | null = null;

 constructor(opts: AwsS3ClientOptions) {
 this.bucket = opts.bucket;
 this.region = opts.region;
 this.credentials = opts.credentials;
 this.endpoint = process.env.AWS_ENDPOINT_URL ?? process.env.AWS_ENDPOINT_URL_S3;
 }

 private async getClient(): Promise<any> {
 if (this.clientPromise) return this.clientPromise;
 this.clientPromise = (async () => {
 const mod = await import('@aws-sdk/client-s3');
 const S3ClientCtor = mod.S3Client;
 return new S3ClientCtor({
 region: this.region,
 ...(this.credentials ? { credentials: this.credentials } : {}),
 ...(this.endpoint ? {
 endpoint: this.endpoint,
 forcePathStyle: true,
 } : {}),
 });
 })();
 return this.clientPromise;
 }

 async send(cmd: S3Command): Promise<unknown> {
 const client = await this.getClient() as any;
 const mod = await import('@aws-sdk/client-s3');
 const input = cmd.input;

 if (input.Body !== undefined && input.Key !== undefined) {
 const PutObject = mod.PutObjectCommand;
 const body = typeof input.Body === 'string'
 ? new TextEncoder().encode(input.Body)
 : new Uint8Array(input.Body.buffer, input.Body.byteOffset, input.Body.byteLength);
 return client.send(
 new PutObject({
 Bucket: this.bucket,
 Key: input.Key,
 Body: body,
 ...(input.ContentType ? { ContentType: input.ContentType } : {}),
 ...(input.Metadata ? { Metadata: input.Metadata } : {}),
 }),
 );
 }

 if (input.CopySource && input.Key !== undefined) {
 const CopyObject = mod.CopyObjectCommand;
 return client.send(
 new CopyObject({
 Bucket: this.bucket,
 Key: input.Key,
 CopySource: input.CopySource,
 ...(input.Metadata ? { Metadata: input.Metadata } : {}),
 }),
 );
 }

 // Default: read (GetObject)
 const GetObject = mod.GetObjectCommand;
 return client.send(
 new GetObject({ Bucket: this.bucket, Key: input.Key ?? '' }),
 );
 }

 async deleteObject(bucket: string, key: string): Promise<void> {
 const client = await this.getClient() as any;
 const mod = await import('@aws-sdk/client-s3');
 const DeleteObject = mod.DeleteObjectCommand;
 await client.send(new DeleteObject({ Bucket: bucket, Key: key }));
 }
}

/**
 * Presigner — generates pre-signed URLs for direct client upload/download.
 * Lazy-loads @aws-sdk/s3-request-presigner in production.
 */
export interface PresignResult { url: string; }

export async function presignS3Url(input: {
 bucket: string;
 key: string;
 method: 'GET' | 'PUT';
 expiresInSeconds: number;
 region: string;
 credentials?: { accessKeyId: string; secretAccessKey: string };
}): Promise<PresignResult> {
 const presigner = await import('@aws-sdk/s3-request-presigner');
 const mod = await import('@aws-sdk/client-s3');
 const S3ClientCtor = mod.S3Client;
 const client = new S3ClientCtor({
 region: input.region,
 ...(input.credentials ? { credentials: input.credentials } : {}),
 });
 const Cmd = input.method === 'GET' ? mod.GetObjectCommand : mod.PutObjectCommand;
 const url = await presigner.getSignedUrl(
 client,
 new Cmd({ Bucket: input.bucket, Key: input.key }),
 { expiresIn: input.expiresInSeconds },
 );
 return { url };
}
