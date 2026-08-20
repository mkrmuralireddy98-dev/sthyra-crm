import { buildDashboardServer } from './http.js';
import { StubDashboardFetcher } from './service.js';
import type { FastifyInstance } from 'fastify';

export interface StartedServer {
  readonly app: FastifyInstance;
  readonly port: number;
  stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
  const fetcher = new StubDashboardFetcher();
  const app = await buildDashboardServer({ fetcher });
  const address = await app.listen({ port: opts.port ?? 0, host: process.env.HOST ?? '0.0.0.0' });
  const port = typeof address === 'string' ? Number(address.split(':').pop()) : (opts.port ?? 0);
  return {
    app, port,
    async stop() { await app.close(); },
  };
}

const isMain = (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts'));
if (isMain) {
  const port = Number.parseInt(process.env.PORT ?? '9099', 10);
  startInMemoryServer({ port }).then((s) => {
    console.log(`dashboard-service listening on http://127.0.0.1:${s.port}`);
  }).catch((err: Error) => {
    console.error('dashboard-service failed to start:', err.message);
    process.exit(1);
  });
}
