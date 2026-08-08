/**
 * Postgres-backed OrgRepository.
 *
 * Uses `pg` (node-postgres) with parameterized queries. No string concatenation
 * — every value flows through `$1, $2, ...` placeholders.
 *
 * Idempotent migrations: ensureSchema() runs the schema once per process and
 * skips re-runs after the first successful application.
 *
 * Testability: the PgClient interface is the only seam. Production uses the
 * real `pg.Pool`; tests pass a FakePgClient (see postgres-repo.test.ts).
 */

import type { Org, OrgRepository, Region } from './index.js';

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

export class UniqueViolationError extends Error {
  override readonly name = 'UniqueViolationError';
  readonly code = '23505';
  constructor(message: string) {
    super(message);
    // Required when targeting ES2022 with `useDefineForClassFields`.
    Object.setPrototypeOf(this, UniqueViolationError.prototype);
  }
}

export const defaultMigrations: MigrationRunner = {
  applied: false,
  async run(client: PgClient) {
    if (this.applied) return;
    await client.query(`
      CREATE TABLE IF NOT EXISTS orgs (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        region      TEXT NOT NULL,
        plan        TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT orgs_name_region_unique UNIQUE (region, LOWER(name))
      );
      CREATE INDEX IF NOT EXISTS orgs_region_idx ON orgs (region);
    `);
    this.applied = true;
  },
};

export interface PostgresOrgRepositoryOptions {
  client: PgClient;
  migrations?: MigrationRunner;
}

interface OrgRow {
  id: string;
  name: string;
  region: string;
  plan: string;
  created_at: Date | string;
  [key: string]: unknown;
}

function rowToOrg(row: OrgRow): Org {
  return {
    id: row.id,
    name: row.name,
    region: row.region as Region,
    plan: row.plan as Org['plan'],
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

export class PostgresOrgRepository implements OrgRepository {
  private readonly migrations: MigrationRunner;

  constructor(private readonly opts: PostgresOrgRepositoryOptions) {
    this.migrations = opts.migrations ?? defaultMigrations;
  }

  async ensureSchema(): Promise<void> {
    await this.migrations.run(this.opts.client);
  }

  async insert(org: Org): Promise<void> {
    try {
      await this.opts.client.query(
        `INSERT INTO orgs (id, name, region, plan, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [org.id, org.name, org.region, org.plan, org.createdAt],
      );
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e?.code === '23505') {
        throw new UniqueViolationError(
          `Organization "${org.name}" already exists in region "${org.region}".`,
        );
      }
      throw err;
    }
  }

  async findById(id: string): Promise<Org | null> {
    const result = await this.opts.client.query<OrgRow>(
      `SELECT id, name, region, plan, created_at FROM orgs WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? rowToOrg(row) : null;
  }

  async findByNameAndRegion(name: string, region: Region): Promise<Org | null> {
    const result = await this.opts.client.query<OrgRow>(
      `SELECT id, name, region, plan, created_at FROM orgs
       WHERE region = $1 AND LOWER(name) = LOWER($2)
       LIMIT 1`,
      [region, name],
    );
    const row = result.rows[0];
    return row ? rowToOrg(row) : null;
  }
}
