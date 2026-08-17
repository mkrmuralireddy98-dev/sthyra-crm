import { buildIntegrationServer } from './http.js';
import { InMemoryIntegrationRepository } from './repo-memory.js';
import { IntegrationService } from './service.js';
import type { FastifyInstance } from 'fastify';

export interface StartedServer {
  readonly app: FastifyInstance;
  readonly port: number;
  stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
  const repo = new InMemoryIntegrationRepository();
  const service = new IntegrationService({ repo });
  const app = await buildIntegrationServer({ service, repo });
  const address = await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' });
  const port = typeof address === 'string' ? Number(address.split(':').pop()) : (opts.port ?? 0);
  return {
    app, port,
    async stop() { await app.close(); },
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith('cli.js');
if (isMain) {
  const port = Number.parseInt(process.env.PORT ?? '9098', 10);
  startInMemoryServer({ port }).then((s) => {
    console.log(`integration-service listening on http://127.0.0.1:${s.port}`);
  }).catch((err: Error) => {
    console.error('integration-service failed to start:', err.message);
    process.exit(1);
  });
}
