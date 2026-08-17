/**
 * FakeS3Server — minimal in-process S3-compatible HTTP server.
 * Returns XML responses matching what @aws-sdk/client-s3 expects.
 *
 * Used by aws-s3.test.ts to exercise the real AWS SDK end-to-end
 * without needing AWS credentials. Production wiring uses the real S3.
 *
 * Supports:
 *   PUT /<key> → returns ETag
 *   GET /<key> → returns body
 *   HEAD /<key> → returns ContentLength
 *   DELETE /<key> → 204
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';

export interface FakeS3Server {
 port: number;
 host: string;
 baseUrl: string;
 close(): Promise<void>;
 objects: Map<string, { body: Buffer; contentType: string; etag: string }>;
}

export async function startFakeS3Server(opts: { host?: string } = {}): Promise<FakeS3Server> {
 const host = opts.host ?? '127.0.0.1';
 const objects = new Map<string, { body: Buffer; contentType: string; etag: string }>();

 const server = http.createServer((req, res) => {
 const url = new URL(req.url ?? '/', `http://${host}`);
 const key = decodeURIComponent(url.pathname.replace(/^\//, ''));

 if (req.method === 'PUT' && key) {
 const chunks: Buffer[] = [];
 req.on('data', (c) => chunks.push(c as Buffer));
 req.on('end', () => {
 const body = Buffer.concat(chunks);
 const etag = crypto.createHash('md5').update(body).digest('hex');
 const contentType = req.headers['content-type'] ?? 'application/octet-stream';
 objects.set(key, { body, contentType, etag });
 res.writeHead(200, { etag: `\"${etag}\"` });
 res.end();
 });
 return;
 }

 if (req.method === 'GET' && key) {
 const obj = objects.get(key);
 if (!obj) { res.writeHead(404); res.end(); return; }
 res.writeHead(200, {
 'content-length': String(obj.body.length),
 'content-type': obj.contentType,
 'etag': obj.etag,
 });
 res.end(obj.body);
 return;
 }

 if (req.method === 'HEAD' && key) {
 const obj = objects.get(key);
 if (!obj) { res.writeHead(404); res.end(); return; }
 res.writeHead(200, {
 'content-length': String(obj.body.length),
 'content-type': obj.contentType,
 });
 res.end();
 return;
 }

 if (req.method === 'DELETE' && key) {
 objects.delete(key);
 res.writeHead(204); res.end();
 return;
 }

 res.writeHead(400); res.end();
 });

 await new Promise<void>((r) => server.listen(0, host, r));
 const addr = server.address() as AddressInfo;
 return {
 port: addr.port,
 host,
 baseUrl: `http://${host}:${addr.port}`,
 close: async () => { await new Promise<void>((r) => server.close(() => r())); },
 objects,
 };
}
