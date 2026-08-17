/**
 * Mobile JWT — minimal HS256 verify.
 */

import * as crypto from 'node:crypto';
import type { MobileJwtClaims } from './types.js';

const HEADER_B64 = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmacSign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest().toString('base64url');
}

export interface SignOptions {
  readonly secret: string;
  readonly ttlSeconds?: number;
  readonly now?: number;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export function signJwt(claims: MobileJwtClaims, opts: SignOptions): string {
  const now = (opts.now ?? Date.now()) / 1000;
  const exp = now + (opts.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload = Object.assign({}, claims, { iat: now, exp });
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signingInput = HEADER_B64 + '.' + payloadB64;
  const sig = hmacSign(signingInput, opts.secret);
  return signingInput + '.' + sig;
}

export function verifyJwt(token: string, secret: string, now: number = Date.now()): MobileJwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid JWT format');
  const headerB64 = parts[0];
  const payloadB64 = parts[1];
  const sig = parts[2];
  if (!headerB64 || !payloadB64 || !sig) throw new Error('invalid JWT format');
  if (headerB64 !== HEADER_B64) throw new Error('unsupported JWT header');
  const expected = hmacSign(headerB64 + '.' + payloadB64, secret);
  if (sig !== expected) throw new Error('JWT signature mismatch');
  let payload: MobileJwtClaims & { iat: number; exp: number };
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as MobileJwtClaims & { iat: number; exp: number };
  } catch {
    throw new Error('invalid JWT payload');
  }
  const nowSec = now / 1000;
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('JWT expired');
  }
  return { orgId: payload.orgId, userId: payload.userId, deviceId: payload.deviceId };
}

export function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}
