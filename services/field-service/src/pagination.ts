/**
 * Pagination cursor — HMAC-signed, tamper-resistant.
 *
 * Same pattern as the standard pagination-via-HMAC pattern (used by
 * Stripe, GitHub, etc). The cursor encodes (createdAt, id, dir) and
 * signs with HMAC-SHA256. Tampering → throws.
 *
 * TTL defaults to 24h (per spec.md NFR-7). Expired cursors throw.
 */

import * as crypto from 'node:crypto';
import type { PaginationCursor } from './types.js';

export interface EncodeOptions {
 readonly ttlSeconds?: number; // default 24h
 readonly now?: number; // override for testing
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function base64urlEncode(buf: Buffer): string {
 return buf.toString('base64')
 .replace(/\+/g, '-')
 .replace(/\//g, '_')
 .replace(/=+$/, '');
}

function base64urlDecode(str: string): Buffer {
 const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
 return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmacSign(payload: string, secret: string): string {
 return base64urlEncode(
 crypto.createHmac('sha256', secret).update(payload).digest(),
 );
}

/**
 * Encode a cursor to a token. The token is `<base64url(payload)>.<base64url(sig)>`.
 * The payload includes the cursor + expiry timestamp.
 */
export function encodeCursor(cursor: PaginationCursor, secret: string, opts: EncodeOptions = {}): string {
 const now = (opts.now ?? Date.now()) / 1000; // seconds
 const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
 const exp = now + ttl;
 const payload = {
 cursor,
 exp,
 };
 const json = JSON.stringify(payload);
 const payloadB64 = base64urlEncode(Buffer.from(json, 'utf8'));
 const sig = hmacSign(payloadB64, secret);
 return `${payloadB64}.${sig}`;
}

/**
 * Decode + verify a cursor. Throws on tamper, malformed, or expired.
 */
export function decodeCursor(token: string, secret: string): PaginationCursor {
 const parts = token.split('.');
 if (parts.length !== 2) {
 throw new Error('invalid cursor format');
 }
 const [payloadB64, sig] = parts;
 if (!payloadB64 || !sig) {
 throw new Error('invalid cursor format');
 }

 const expectedSig = hmacSign(payloadB64, secret);
 if (sig !== expectedSig) {
 throw new Error('cursor signature mismatch — tampered or wrong secret');
 }

 const json = Buffer.from(base64urlDecode(payloadB64)).toString('utf8');
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
