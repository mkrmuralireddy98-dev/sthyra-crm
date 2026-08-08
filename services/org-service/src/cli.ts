import { buildServer } from './http.js';
import { OrgService, InMemoryOrgRepository } from './index.js';

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

const service = new OrgService(new InMemoryOrgRepository());
const app = buildServer({ service });

app.listen({ port, host }).then((addr) => {
  // eslint-disable-next-line no-console
  console.log(`[org-service] listening on ${addr}`);
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[org-service] failed to start', err);
  process.exit(1);
});
