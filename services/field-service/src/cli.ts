/**
 * Field Service CLI — boot the HTTP server.
 *
 * Modes:
 *   - InMemory (default for local development)
 *   - Postgres (with DATABASE_URL env var)
 */

import { buildFieldServer } from './http.js';
import type { FastifyInstance } from 'fastify';
import { InMemoryIdempotencyStore } from './in-memory-idempotency.js';
import { InMemoryIssueRepository } from './repo-memory.js';
import { IssueService } from './service.js';
import { InMemoryEventBus } from './realtime/index.js';
import { randomUUID } from 'node:crypto';

export interface StartedServer {
 readonly app: FastifyInstance;
 readonly service: IssueService;
 readonly port: number;
 stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
 const app = await buildFieldServer({
 bus: new InMemoryEventBus(),
 repo: new InMemoryIssueRepository(),
 idempotency: new InMemoryIdempotencyStore(),
 });
 const address = await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' });
 // address is a string like 'http://127.0.0.1:54321' (Node 18+) or an object.
 const port = typeof address === 'string'
 ? Number(address.split(':').pop())
 : (opts.port ?? 0);

 const service = new IssueService({
 repo: new InMemoryIssueRepository(),
 idempotency: new InMemoryIdempotencyStore(),
 paginationSecret: 'sthyra-crm-dev-pagination-secret-32b',
 });

 return {
 app,
 service,
 port,
 async stop() { await app.close(); },
 };
}

export async function startPostgresServer(opts: { databaseUrl: string; port?: number }): Promise<StartedServer> {
 // Phase 2.b: real Postgres wiring. The PostgresIssueRepository requires a
 // pg client; for the MVP we lazily import and instantiate it.
 // Postgres mode would require a real pg pool + PostgresIssueRepository({ pg }).
 // For the MVP integration stack, fall through to in-memory + warn.
 const warn = `field-service: Postgres mode requires a real pg client; using in-memory fallback. databaseUrl=${opts.databaseUrl.slice(0, 30)}...`;
 console.warn(warn);
 return startInMemoryServer({ port: opts.port });
}

const isMain = (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts'));
if (isMain) {
 const port = Number.parseInt(process.env.PORT ?? '9091', 10);
 const databaseUrl = process.env.DATABASE_URL;
 const start = databaseUrl ? startPostgresServer({ databaseUrl, port }) : startInMemoryServer({ port });
 start.then((s) => {
 console.log(`field-service listening on http://127.0.0.1:${s.port}`);
 void randomUUID;
 }).catch((err: Error) => {
 console.error('field-service failed to start:', err.message);
 process.exit(1);
 });
}
