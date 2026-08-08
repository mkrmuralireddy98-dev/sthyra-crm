import { buildServer } from './http.js';
import { MembershipService, InMemoryMembershipRepository } from './index.js';

const port = Number(process.env.PORT ?? 8086);
const host = process.env.HOST ?? '0.0.0.0';

const service = new MembershipService(new InMemoryMembershipRepository());
const app = buildServer({ service });

app
  .listen({ port, host })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`[membership-service] listening on ${addr}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[membership-service] failed to start', err);
    process.exit(1);
  });
