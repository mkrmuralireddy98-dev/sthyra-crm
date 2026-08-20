/**
 * Mobile BFF CLI — boot the HTTP server.
 */

import { buildMobileServer } from './http.js';
import type { FastifyInstance } from 'fastify';
import { InMemoryMobileRepository } from './repo-memory.js';
import { MobileSessionService } from './service.js';

export interface StartedServer {
  readonly app: FastifyInstance;
  readonly service: MobileSessionService;
  readonly port: number;
  stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
  const repo = new InMemoryMobileRepository();
  const app = await buildMobileServer({ repo });
  const address = await app.listen({ port: opts.port ?? 0, host: process.env.HOST ?? '0.0.0.0' });
  const port = typeof address === 'string'
    ? Number(address.split(':').pop())
    : (opts.port ?? 0);
  const service = new MobileSessionService({ repo });
  return {
    app, service, port,
    async stop() { await app.close(); },
  };
}

const isMain = (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts'));
if (isMain) {
  const port = Number.parseInt(process.env.PORT ?? '9094', 10);
  startInMemoryServer({ port }).then((s) => {
    console.log(`mobile-bff-service listening on http://0.0.0.0:${s.port}`);
  }).catch((err: Error) => {
    console.error('mobile-bff-service failed to start:', err.message);
    process.exit(1);
  });
}