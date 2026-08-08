import { buildServer } from './http.js';
import {
  UserService,
  InMemoryUserRepository,
  InMemoryTokenStore,
} from './index.js';

const port = Number(process.env.PORT ?? 8084);
const host = process.env.HOST ?? '0.0.0.0';

const users = new InMemoryUserRepository();
const tokens = new InMemoryTokenStore();
const service = new UserService({ users, tokens, tokenTtlSeconds: 3600 });
const app = buildServer({ service });

app
  .listen({ port, host })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`[user-service] listening on ${addr}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[user-service] failed to start', err);
    process.exit(1);
  });
