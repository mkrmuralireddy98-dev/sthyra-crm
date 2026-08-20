import { buildReportServer } from './http.js';
import { InMemoryReportRepository } from './repo-memory.js';
import { StubReportFetcher } from './fetcher.js';
import { ReportService } from './service.js';
import type { FastifyInstance } from 'fastify';

export interface StartedServer {
  readonly app: FastifyInstance;
  readonly port: number;
  stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
  const repo = new InMemoryReportRepository();
  const fetcher = new StubReportFetcher();
  const service = new ReportService({ repo, fetcher });
  const app = await buildReportServer({ service, repo, fetcher });
  const address = await app.listen({ port: opts.port ?? 0, host: process.env.HOST ?? '0.0.0.0' });
  const port = typeof address === 'string' ? Number(address.split(':').pop()) : (opts.port ?? 0);
  return {
    app, port,
    async stop() { await app.close(); },
  };
}

const isMain = (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts'));
if (isMain) {
  const port = Number.parseInt(process.env.PORT ?? '9096', 10);
  startInMemoryServer({ port }).then((s) => {
    console.log(`report-service listening on http://0.0.0.0:${s.port}`);
  }).catch((err: Error) => {
    console.error('report-service failed to start:', err.message);
    process.exit(1);
  });
}
