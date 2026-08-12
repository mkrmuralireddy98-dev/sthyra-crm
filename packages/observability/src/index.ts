/**
 * Sthyra CRM observability — structured logging + request-id propagation.
 *
 * Every request gets an `x-request-id` (incoming header or freshly minted).
 * The same id appears in:
 *   - every log line emitted during the request
 *   - every RFC 7807 problem+json response (`trace_id`)
 *   - every downstream HTTP/gRPC call (Phase 1: outbound client hook)
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
  fields?: LogFields;
}

const DEFAULT_SERVICE_NAME = process.env.SERVICE_NAME ?? 'sthyra-crm-service';

const requestIdStore = new AsyncLocalStorage<string>();

export function currentRequestId(): string | undefined {
  return requestIdStore.getStore();
}

export function emit(level: LogLevel, msg: string, fields: LogFields = {}, serviceName = DEFAULT_SERVICE_NAME): void {
  const request_id = currentRequestId() ?? '-';
  const line: LogLine = {
    ts: new Date().toISOString(),
    level,
    service: serviceName,
    request_id,
    msg,
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

/**
 * Mint a request-id. In Phase 1 we may use the OTel trace-id here.
 */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Fastify plugin: propagates x-request-id and emits one structured log per response.
 */
export function installRequestIdPlugin(app: FastifyInstance): void {
  app.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : newRequestId();
    void reply.header('x-request-id', id);
    requestIdStore.run(id, () => done());
  });

  app.addHook('onResponse', (req: FastifyRequest, reply: FastifyReply) => {
    emit('info', 'http_request', {
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      duration_ms: typeof reply.elapsedTime === 'number' ? Math.round(reply.elapsedTime) : undefined,
    });
  });
}
