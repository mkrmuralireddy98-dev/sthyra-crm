/**
 * Postgres-backed ProjectRepository.
 *
 * Same testing strategy as the org-service Postgres repo: a `PgClient`
 * interface is the only seam. Production uses the real `pg.Pool` against
 * Postgres; tests pass a FakePgClient.
 */

import type { Project, ProjectRepository } from './index.js';

export interface QueryResult<R = Record<string, unknown>> {
  rows: R[];
  rowCount: number;
}

export interface PgClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>;
}

export interface MigrationRunner {
  applied: boolean;
  run(client: PgClient): Promise<void>;
}

export const defaultMigrations: MigrationRunner = {
  applied: false,
  async run(client: PgClient) {
    if (this.applied) return;
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id           TEXT PRIMARY KEY,
        org_id       TEXT NOT NULL,
        name         TEXT NOT NULL,
        status       TEXT NOT NULL,
        address      TEXT NOT NULL,
        started_at   TIMESTAMPTZ NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        archived_at  TIMESTAMPTZ,
        CONSTRAINT projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id)
      );
      CREATE INDEX IF NOT EXISTS projects_org_id_idx ON projects (org_id);
      CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
    `);
    this.applied = true;
  },
};

export interface PostgresProjectRepositoryOptions {
  client: PgClient;
  migrations?: MigrationRunner;
}

interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  status: string;
  address: string;
  started_at: Date | string;
  created_at: Date | string;
  archived_at: Date | string | null;
  [key: string]: unknown;
}

function rowToProject(row: ProjectRow): Project {
  const archivedAtRaw = row.archived_at;
  const archivedAt =
    archivedAtRaw === null || archivedAtRaw === undefined
      ? undefined
      : archivedAtRaw instanceof Date
        ? archivedAtRaw
        : new Date(archivedAtRaw);
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    status: row.status as Project['status'],
    address: row.address,
    startedAt: row.started_at instanceof Date ? row.started_at : new Date(row.started_at),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    ...(archivedAt ? { archivedAt } : {}),
  };
}

export class PostgresProjectRepository implements ProjectRepository {
  private readonly migrations: MigrationRunner;

  constructor(private readonly opts: PostgresProjectRepositoryOptions) {
    this.migrations = opts.migrations ?? defaultMigrations;
  }

  async ensureSchema(): Promise<void> {
    await this.migrations.run(this.opts.client);
  }

  async insert(project: Project): Promise<void> {
    await this.opts.client.query(
      `INSERT INTO projects (id, org_id, name, status, address, started_at, created_at, archived_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        project.id,
        project.orgId,
        project.name,
        project.status,
        project.address,
        project.startedAt,
        project.createdAt,
        project.archivedAt ?? null,
      ],
    );
  }

  async findById(id: string): Promise<Project | null> {
    const result = await this.opts.client.query<ProjectRow>(
      `SELECT id, org_id, name, status, address, started_at, created_at, archived_at
       FROM projects WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? rowToProject(row) : null;
  }

  async listByOrg(orgId: string, limit?: number): Promise<Project[]> {
    const sql = limit
      ? `SELECT id, org_id, name, status, address, started_at, created_at, archived_at
         FROM projects WHERE org_id = $1
         ORDER BY created_at DESC
         LIMIT $2`
      : `SELECT id, org_id, name, status, address, started_at, created_at, archived_at
         FROM projects WHERE org_id = $1
         ORDER BY created_at DESC`;
    const params: unknown[] = limit ? [orgId, limit] : [orgId];
    const result = await this.opts.client.query<ProjectRow>(sql, params);
    return result.rows.map(rowToProject);
  }

  async update(project: Project): Promise<void> {
    await this.opts.client.query(
      `UPDATE projects
       SET status = $1, archived_at = $2, name = $3, address = $4
       WHERE id = $5`,
      [
        project.status,
        project.archivedAt ?? null,
        project.name,
        project.address,
        project.id,
      ],
    );
  }
}
