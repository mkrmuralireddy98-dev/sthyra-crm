import { buildDashboardServer } from './http.js';
import { StubDashboardFetcher } from './service.js';
import { HttpDashboardFetcher } from './fetcher-http.js';
import type { FastifyInstance } from 'fastify';

export interface StartedServer {
  readonly app: FastifyInstance;
  readonly port: number;
  stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
  // Use real HTTP fetcher in production (calls actual backend services)
  // Falls back to stub if USE_STUB_FETCHER=1
  const useStub = process.env.USE_STUB_FETCHER === '1';
  const fetcher = useStub ? new StubDashboardFetcher() : new HttpDashboardFetcher();
  const app = await buildDashboardServer({ fetcher });
  const address = await app.listen({ port: opts.port ?? 0, host: process.env.HOST ?? '0.0.0.0' });
  const port = typeof address === 'string' ? Number(address.split(':').pop()) : (opts.port ?? 0);
  return {
    app, port,
    async stop() { await app.close(); },
  };
}
