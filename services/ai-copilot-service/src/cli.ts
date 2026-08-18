/**
 * AI Copilot CLI — boot the HTTP server.
 */

import { buildCopilotServer } from './http.js';
import type { FastifyInstance } from 'fastify';
import { InMemoryCopilotRepository } from './repo-memory.js';
import { CopilotService } from './service.js';
import { InMemoryEventBus } from './realtime/index.js';

export interface StartedServer {
 readonly app: FastifyInstance;
 readonly service: CopilotService;
 readonly port: number;
 stop(): Promise<void>;
}

export async function startInMemoryServer(opts: { port?: number } = {}): Promise<StartedServer> {
 const repo = new InMemoryCopilotRepository();
 const bus = new InMemoryEventBus();
 const app = await buildCopilotServer({ repo, bus });
 const address = await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' });
 const port = typeof address === 'string'
 ? Number(address.split(':').pop())
 : (opts.port ?? 0);
 const service = new CopilotService({ repo });
 return {
 app, service, port,
 async stop() { await app.close(); },
 };
}

const isMain = (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts'));
if (isMain) {
 const port = Number.parseInt(process.env.PORT ?? '9093', 10);
 startInMemoryServer({ port }).then((s) => {
 console.log(`ai-copilot-service listening on http://127.0.0.1:${s.port}`);
 }).catch((err: Error) => {
 console.error('ai-copilot-service failed to start:', err.message);
 process.exit(1);
 });
}
