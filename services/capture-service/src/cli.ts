/**
 * Capture Service CLI — boot the HTTP server with Postgres + S3.
 *
 * For local development with the docker-compose Postgres stack:
 *   DATABASE_URL=postgres://sthyra:sthyra@localhost:5432/sthyra_crm \
 *     node dist/cli.js
 *
 * For tests + ephemeral dev, omit DATABASE_URL to fall back to the
 * InMemoryCaptureRepository.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { buildCaptureServer } from './http.js';
import { InMemoryCaptureRepository, InMemoryIdempotencyStore } from './repo-memory.js';
import { PostgresCaptureRepository, type PgClient } from './postgres-repo.js';
import { InMemoryEventBus } from './realtime/index.js';
import { installMetricsPlugin, metrics, type Metrics } from './metrics.js';
import { OtelMetrics } from './metrics-otel-impl.js';
import { FakeOtelMeter } from './metrics-otel.js';
import { installRequestIdPlugin, emit } from '@sthyra-crm/observability';

const DEFAULT_PORT = 9090;
const DEFAULT_HOST = '0.0.0.0';

export interface StartedServer {
 port: number;
 host: string;
 url: string;
 close(): Promise<void>;
}

export interface StartInMemoryServerOptions {
 port?: number;
 host?: string;
}

/**
 * Boot the capture service with the in-memory repository. Useful for
 * tests + ephemeral dev.
 */
export async function startInMemoryServer(
 opts: StartInMemoryServerOptions = {},
): Promise<StartedServer> {
 const port = opts.port ?? DEFAULT_PORT;
 const host = opts.host ?? DEFAULT_HOST;

 const app = Fastify({ logger: false, disableRequestLogging: true });
 installRequestIdPlugin(app);
 installMetricsPlugin(app);

 const repo = new InMemoryCaptureRepository();
 const idempotency = new InMemoryIdempotencyStore();
 const bus = new InMemoryEventBus();

 const captureApp = await buildCaptureServer({ repo, idempotency, bus });

 // Build the full app by mounting captureApp's routes onto app
 // (buildCaptureServer already returns a FastifyInstance with all routes)
 void app;
 // When port=0, Fastify picks a free port. Capture the actual port.
 const address = await captureApp.listen({ port, host });
 // address is a string like 'http://127.0.0.1:54321' (Node 18+) or an object.
 const actualPort = typeof address === 'string'
 ? Number(address.split(':').pop())
 : port;

 return {
 port: actualPort,
 host,
 url: `http://127.0.0.1:${actualPort}`,
 close: async () => { await captureApp.close(); },
 };
}

/**
 * Boot the capture service with the Postgres repository. Requires
 * DATABASE_URL to be set.
 */
export async function startPostgresServer(
 pgClient: PgClient,
 opts: { port?: number; host?: string } = {},
): Promise<StartedServer> {
 const port = opts.port ?? DEFAULT_PORT;
 const host = opts.host ?? DEFAULT_HOST;

 const app = Fastify({ logger: false, disableRequestLogging: true });
 installRequestIdPlugin(app);
 installMetricsPlugin(app);

 // Phase 1.b: swap the in-memory metrics singleton for OTel when
 // OTEL_ENABLED=true. Tests use FakeOtelMeter; production wires the
 // real @opentelemetry/sdk-metrics.
 if (process.env.OTEL_ENABLED === 'true') {
 const otelMeter = new FakeOtelMeter();
 const otelMetrics: Metrics = new OtelMetrics({ meter: otelMeter });
 // Replace the singleton — http.ts uses `metrics.*` via this binding.
 (metrics as unknown as { incPipelineRun: Metrics['incPipelineRun'] }).incPipelineRun =
 otelMetrics.incPipelineRun.bind(otelMetrics);
 (metrics as unknown as { incDlq: Metrics['incDlq'] }).incDlq = otelMetrics.incDlq.bind(otelMetrics);
 (metrics as unknown as { incActiveUpload: Metrics['incActiveUpload'] }).incActiveUpload =
 otelMetrics.incActiveUpload.bind(otelMetrics);
 (metrics as unknown as { decActiveUpload: Metrics['decActiveUpload'] }).decActiveUpload =
 otelMetrics.decActiveUpload.bind(otelMetrics);
 (metrics as unknown as { recordPipelineDuration: Metrics['recordPipelineDuration'] }).recordPipelineDuration =
 otelMetrics.recordPipelineDuration.bind(otelMetrics);
 (metrics as unknown as { snapshot: Metrics['snapshot'] }).snapshot = otelMetrics.snapshot.bind(otelMetrics);
 emit('otel_metrics_enabled', { mode: 'fake-otel-meter' }, { service: 'capture-service', level: 'info' });
 }

 const repo = new PostgresCaptureRepository({ pg: pgClient });
 // Use Redis if REDIS_URL is set, else in-memory.
 let idempotency: { get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>; };
 if (process.env.REDIS_URL) {
 const { RedisIdempotencyStore, createDefaultRedisClient } = await import('./redis-idempotency.js');
 const redisClient = await createDefaultRedisClient({ url: process.env.REDIS_URL });
 idempotency = new RedisIdempotencyStore({ redis: redisClient });
 emit('redis_idempotency_connected', { url: 'redacted' }, { service: 'capture-service', level: 'info' });
 } else {
 idempotency = new InMemoryIdempotencyStore();
 emit('redis_idempotency_disabled', { reason: 'REDIS_URL not set' }, { service: 'capture-service', level: 'warn' });
 }
 const bus = new InMemoryEventBus(); // Phase 1.b: Redis pub/sub
 const { PostgresOutboxWriter } = await import('./outbox-writer.js');
 const { MultiInstanceOutboxDispatcher } = await import('./outbox-multi.js');
 const outboxWriter = new PostgresOutboxWriter({ pg: pgClient });
 const captureApp = await buildCaptureServer({ repo, idempotency, bus, outboxWriter: outboxWriter.write.bind(outboxWriter) });
 void app;
 await captureApp.listen({ port, host });

 // Multi-instance safe outbox dispatcher — uses FOR UPDATE SKIP LOCKED
 // so multiple capture-service instances can run concurrently.
 const dispatcher = new MultiInstanceOutboxDispatcher({
 pg: pgClient,
 sink: async (row) => {
 await bus.publish({
 type: row.event_type as 'capture.initiated' | 'capture.uploaded' | 'capture.failed' | 'capture.archived',
 captureId: row.capture_id,
 orgId: row.org_id,
 projectId: row.project_id,
 occurredAt: new Date(row.created_at),
 });
 },
 pollIntervalMs: 1000,
 });
 dispatcher.start();
 emit('outbox_dispatcher_started', { pollIntervalMs: 1000, mode: 'multi-instance' }, { service: 'capture-service', level: 'info' });

 return {
 port,
 host,
 url: `http://127.0.0.1:${port}`,
 close: async () => {
 await dispatcher.stop();
 await captureApp.close();
 },
 };
}

async function main(): Promise<void> {
 const DATABASE_URL = process.env.DATABASE_URL;
 const PORT = Number(process.env.PORT ?? DEFAULT_PORT);
 const HOST = process.env.HOST ?? DEFAULT_HOST;

 if (DATABASE_URL) {
 emit('capture_service_booting', { mode: 'postgres', port: PORT }, { service: 'capture-service', level: 'info' });
 // Lazy-load pg so tests don't need it
 const pgModule = await import('pg');
 const pool = new pgModule.default.Pool({ connectionString: DATABASE_URL });
 const server = await startPostgresServer(pool, { port: PORT, host: HOST });
 emit('capture_service_ready', { port: server.port, host: server.host }, { service: 'capture-service', level: 'info' });
 } else {
 emit('capture_service_booting', { mode: 'in-memory', port: PORT }, { service: 'capture-service', level: 'info' });
 const server = await startInMemoryServer({ port: PORT, host: HOST });
 emit('capture_service_ready', { port: server.port, host: server.host, mode: 'in-memory' }, { service: 'capture-service', level: 'info' });
 }
 // Avoid unused
 void metrics;
}

const isMain = process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts');
if (isMain) {
 main().catch((err) => {
 // eslint-disable-next-line no-console
 console.error(JSON.stringify({
 ts: new Date().toISOString(),
 level: 'error',
 service: 'capture-service',
 request_id: '-',
 msg: 'boot_failed',
 fields: { error: (err as Error).message, stack: (err as Error).stack },
 }));
 process.exit(1);
 });
}
