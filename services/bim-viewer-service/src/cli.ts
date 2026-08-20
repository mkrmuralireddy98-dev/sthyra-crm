/**
 * Bim Viewer CLI — boot the HTTP server.
 */

import { buildBimServer } from './http.js';
import type { FastifyInstance } from 'fastify';
import { InMemoryBimRepository } from './repo-memory.js';
import { BimService } from './service.js';
import { InMemoryEventBus } from './realtime/index.js';

export interface StartedServer {
 readonly app: FastifyInstance;
 readonly service: BimService;
 readonly port: number;
 stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
 const repo = new InMemoryBimRepository();
 const bus = new InMemoryEventBus();
 const app = await buildBimServer({ repo, bus });
 const address = await app.listen({ port: opts.port ?? 0, host: process.env.HOST ?? '0.0.0.0' });
 const port = typeof address === 'string'
 ? Number(address.split(':').pop())
 : (opts.port ?? 0);
 const service = new BimService({ repo });
 return {
 app, service, port,
 async stop() { await app.close(); },
 };
}

const isMain = (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts'));
if (isMain) {
 const port = Number.parseInt(process.env.PORT ?? '9092', 10);
 startInMemoryServer({ port }).then((s) => {
 console.log(`bim-viewer-service listening on http://0.0.0.0:${s.port}`);
 }).catch((err: Error) => {
 console.error('bim-viewer-service failed to start:', err.message);
 process.exit(1);
 });
}
