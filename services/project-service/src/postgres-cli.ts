/**
 * Postgres-backed CLI for the project-service.
 *
 * To run locally:
 *   docker compose -f ../../docker-compose.yml up postgres -d
 *   DATABASE_URL=postgres://sthyra-crm:sthyra-crm@localhost:5432/sthyra-crm pnpm --filter @sthyra-crm/project-service start:pg
 *
 * Note: requires the orgs table to exist (run the org-service Postgres CLI once
 * first, or run a manual migration). The project-service foreign-key references
 * orgs(id).
 */

import { Pool } from 'pg';
import { buildServer } from './http.js';
import { ProjectService } from './index.js';
import { PostgresProjectRepository } from './postgres-repo.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // eslint-disable-next-line no-console
  console.error('DATABASE_URL is required. See services/project-service/README.md.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8082);
const host = process.env.HOST ?? '0.0.0.0';

const pool = new Pool({ connectionString: databaseUrl });
const repo = new PostgresProjectRepository({ client: pool });

repo
  .ensureSchema()
  .then(() => {
    const service = new ProjectService(repo);
    const app = buildServer({ service });
    return app.listen({ port, host });
  })
  .then((addr) => {
    // eslint-disable-next-line no-console
    console.log(`[project-service/postgres] listening on ${addr}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[project-service/postgres] failed to start', err);
    process.exit(1);
  });
