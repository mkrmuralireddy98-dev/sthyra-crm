/**
 * Pagination cursor — HMAC-signed, tamper-resistant.
 */

import * as crypto from 'node:crypto';
import type { PaginationCursor } from './types.js';

export interface EncodeOptions {
 readonly ttlSeconds?: number;
 readonly now?: number;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function b64uEncode(buf: Buffer): string {
 const s = buf.toString('base64');
 return s.split('+').join('-').split('/').join('_').replace(/=+$/g, '');
}

function b64uDecode(s: string): Buffer {
 let str = s.split('-').join('+').split('_').join('/');
 const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
 return Buffer.from(str + pad, 'base64');
}

function hmacSign(payload: string, secret: string): string {
 return b64uEncode(crypto.createHmac('sha256', secret).update(payload).digest());
}

export function encodeCursor(cursor: PaginationCursor, secret: string, opts: EncodeOptions = {}): string {
 const now = (opts.now ?? Date.now()) / 1000;
 const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
 const exp = now + ttl;
 const payload = { cursor, exp };
 const json = JSON.stringify(payload);
 const payloadB64 = b64uEncode(Buffer.from(json, 'utf8'));
 const sig = hmacSign(payloadB64, secret);
 return payloadB64 + '.' + sig;
}

export function decodeCursor(token: string, secret: string): PaginationCursor {
 const parts = token.split('.');
 if (parts.length !== 2) throw new Error('invalid cursor format');
 const payloadB64 = parts[0]!;
 const sig = parts[1]!;
 const expected = hmacSign(payloadB64, secret);
 if (sig !== expected) throw new Error('cursor signature mismatch');
 const json = Buffer.from(b64uDecode(payloadB64)).toString('utf8');
 let payload: { cursor: PaginationCursor; exp: number };
 try {
 payload = JSON.parse(json) as { cursor: PaginationCursor; exp: number };
 } catch {
 throw new Error('invalid cursor JSON');
 }
 const nowSec = Date.now() / 1000;
 if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
 throw new Error('cursor expired');
 }
 return payload.cursor;
}
