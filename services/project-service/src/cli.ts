import { buildServer } from './http.js';
import { ProjectService, InMemoryProjectRepository } from './index.js';

const port = Number(process.env.PORT ?? 8082);
const host = process.env.HOST ?? '0.0.0.0';

const service = new ProjectService(new InMemoryProjectRepository());
const app = buildServer({ service });

app
  .listen({ port, host })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`[project-service] listening on ${addr}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[project-service] failed to start', err);
    process.exit(1);
  });
