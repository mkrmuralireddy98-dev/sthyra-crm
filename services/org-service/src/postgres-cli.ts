/**
 * Postgres-backed CLI for the org-service.
 * Uses the real pg.Pool against DATABASE_URL.
 *
 * To run locally:
 *   docker compose -f ../../docker-compose.yml up postgres -d
 *   DATABASE_URL=postgres://sthyra-crm:sthyra-crm@localhost:5432/sthyra-crm pnpm start:pg
 */

import { Pool } from 'pg';
import { buildServer } from './http.js';
import { OrgService } from './index.js';
import { PostgresOrgRepository } from './postgres-repo.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // eslint-disable-next-line no-console
  console.error('DATABASE_URL is required. See services/org-service/README.md.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

const pool = new Pool({ connectionString: databaseUrl });
const repo = new PostgresOrgRepository({ client: pool });

repo.ensureSchema()
  .then(() => {
    const service = new OrgService(repo);
    const app = buildServer({ service });
    return app.listen({ port, host });
  })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`[org-service/postgres] listening on ${addr}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[org-service/postgres] failed to start', err);
    process.exit(1);
  });
