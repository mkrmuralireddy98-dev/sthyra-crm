/**
 * Sthyra CRM observability — structured logging + request-id propagation + CORS.
 *
 * Every request gets an `x-request-id` (incoming header or freshly minted).
 * The same id appears in:
 *   - every log line emitted during the request
 *   - every RFC 7807 problem+json response (`trace_id`)
 *   - every downstream HTTP/gRPC call (Phase 1: outbound client hook)
 *
 * CORS plugin: enables cross-origin requests from the dashboard
 * (localhost:3000) and any deployed origin. Allows:
 *   - Origin: any (configurable via ALLOWED_ORIGINS env)
 *   - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 *   - Headers: content-type, x-tenant-id, x-idempotency-key,
 *     x-admin-reason, authorization, x-request-id
 *   - Credentials: true
 *
 * Phase 1 will swap `emit()` for an OTel-aware implementation with trace IDs
 * from the OTel context API. Today we use AsyncLocalStorage + JSON stdout.
 */

import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface LogFields {
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogLine {
  ts: string;
  level: LogLevel;
  service: string;
  request_id: string;
  msg: string;
  fields?: LogFields | undefined;
}

const storage = new AsyncLocalStorage<{ requestId: string; service: string }>();

export function currentRequestId(): string | undefined {
 return storage.getStore()?.requestId;
}

export interface EmitOpts {
  readonly service: string;
  readonly level?: LogLevel;
}

export function emit(msg: string, fields: LogFields = {}, opts: EmitOpts): void {
 const store = storage.getStore();
 const line: LogLine = {
 ts: new Date().toISOString(),
 level: opts.level ?? 'info',
 service: opts.service,
 request_id: store?.requestId ?? 'no-rid',
 msg,
 fields: Object.keys(fields).length > 0 ? fields : undefined,
 };
 // Fastify picks up stdout JSON if the host runs our logger; otherwise it's a no-op.
 // Use process.stdout to keep the dependency tree thin.
 try {
 process.stdout.write(JSON.stringify(line) + '\n');
 } catch {
 // never throw from logging
 }
}

/**
 * installRequestIdPlugin — adds x-request-id to every request and stores it
 * in AsyncLocalStorage for log correlation.
 */
export async function installRequestIdPlugin(app: FastifyInstance): Promise<void> {
 const service = process.env.SERVICE_NAME ?? 'sthyra-crm';
 app.addHook('onRequest', async (req, _reply) => {
 const incoming = req.headers['x-request-id'];
 const requestId =
 typeof incoming === 'string' && incoming.length > 0 && incoming.length < 200
 ? incoming
 : randomUUID();
 (req as { requestId?: string }).requestId = requestId;
 if (!req.headers['x-request-id']) {
 req.headers['x-request-id'] = requestId;
 }
 // Enter the storage scope so emit() can pick up the request_id.
 storage.enterWith({ requestId, service });
 });
 app.addHook('onSend', async (req, reply) => {
 const requestId = (req as { requestId?: string }).requestId;
 if (requestId && !reply.getHeader('x-request-id')) {
 reply.header('x-request-id', requestId);
 }
 });
}

/**
 * installCorsPlugin — adds permissive CORS headers to every response and
 * short-circuits OPTIONS preflight requests with 204 No Content.
 *
 * Designed for the dashboard at localhost:3000 calling any backend service
 * directly during dev, and for production where the dashboard may live on a
 * different subdomain than the API.
 *
 * Configure via ALLOWED_ORIGINS (comma-separated) or default to "*".
 */
export async function installCorsPlugin(app: FastifyInstance): Promise<void> {
 const allowed = (process.env.ALLOWED_ORIGINS ?? '*')
 .split(',')
 .map((s) => s.trim())
 .filter(Boolean);

 const isAllowed = (origin: string | undefined): boolean => {
 if (!origin) return false;
 if (allowed.includes('*')) return true;
 return allowed.includes(origin);
 };

 app.addHook('onRequest', async (req, reply) => {
 const origin = req.headers.origin;
 if (typeof origin === 'string' && isAllowed(origin)) {
 reply.header('access-control-allow-origin', origin);
 reply.header('vary', 'Origin');
 reply.header('access-control-allow-credentials', 'true');
 reply.header(
 'access-control-allow-methods',
 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
 );
 reply.header(
 'access-control-allow-headers',
 'content-type, x-tenant-id, x-idempotency-key, x-admin-reason, authorization, x-request-id, accept',
 );
 reply.header('access-control-max-age', '86400');
 }
 // Short-circuit CORS preflight.
 if (req.method === 'OPTIONS') {
 reply.code(204).send();
 }
 });
}
