/**
 * Track CLI — boot the HTTP server.
 */

import { buildTrackServer } from './http.js';
import type { FastifyInstance } from 'fastify';
import { InMemoryTrackRepository } from './repo-memory.js';
import { TrackService } from './service.js';

export interface StartedServer {
 readonly app: FastifyInstance;
 readonly service: TrackService;
 readonly port: number;
 stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
 const repo = new InMemoryTrackRepository();
 const service = new TrackService({ repo });
 const app = await buildTrackServer({ service, repo });
 const address = await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' });
 const port = typeof address === 'string'
 ? Number(address.split(':').pop())
 : (opts.port ?? 0);
 return {
 app, service, port,
 async stop() { await app.close(); },
 };
}

const isMain = process.argv[1] && process.argv[1].endsWith('cli.js');
if (isMain) {
 const port = Number.parseInt(process.env.PORT ?? '9095', 10);
 startInMemoryServer({ port }).then((s) => {
 console.log(`track-service listening on http://127.0.0.1:${s.port}`);
 }).catch((err: Error) => {
 console.error('track-service failed to start:', err.message);
 process.exit(1);
 });
}
