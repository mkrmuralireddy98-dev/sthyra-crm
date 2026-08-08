import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { PostgresOrgRepository, type PgClient, type MigrationRunner } from './postgres-repo.js';

/**
 * Minimal in-memory PgClient that implements only the slice of the pg API
 * we actually use (parameterized queries + transactions). This lets the
 * repository tests run in <50ms with no external Postgres required.
 *
 * Production code uses the real `pg` Pool against a real Postgres — same
 * PostgresOrgRepository class, same SQL, same contract.
 */

type Row = Record<string, unknown>;

class FakePgClient implements PgClient {
  readonly tables = new Map<string, Row[]>();
  readonly executed: { sql: string; params: unknown[] }[] = [];
  failNext = false;

  async query<R extends Row = Row>(sql: string, params: unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
    const normalized = sql.trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalized.startsWith('insert into orgs')) {
      const [id, name, region, plan, createdAt] = params as [string, string, string, string, Date];
      const tbl = this.tables.get('orgs') ?? [];
      const dup = tbl.find((r) => r.region === region && (r.name as string).toLowerCase() === name.toLowerCase());
      if (dup) {
        const err = new Error(`duplicate key value violates unique constraint "orgs_name_region_unique"`);
        (err as Error & { code?: string }).code = '23505';
        throw err;
      }
      tbl.push({ id, name, region, plan, created_at: createdAt });
      this.tables.set('orgs', tbl);
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith('select') && normalized.includes('from orgs where id')) {
      const [id] = params as [string];
      const tbl = this.tables.get('orgs') ?? [];
      const row = tbl.find((r) => r.id === id);
      return { rows: row ? [row as R] : [], rowCount: row ? 1 : 0 };
    }
    if (normalized.startsWith('select') && normalized.includes('from orgs where region')) {
      const [region, name] = params as [string, string];
      const tbl = this.tables.get('orgs') ?? [];
      // Match the real SQL: WHERE region = $1 AND LOWER(name) = LOWER($2)
      const row = tbl.find(
        (r) =>
          r.region === region &&
          (r.name as string).toLowerCase() === (name as string).toLowerCase(),
      );
      return { rows: row ? [row as R] : [], rowCount: row ? 1 : 0 };
    }
    if (normalized.startsWith('create table')) {
      this.tables.set('orgs', []);
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('PostgresOrgRepository', () => {
  let client: FakePgClient;
  let migrations: MigrationRunner;
  let repo: PostgresOrgRepository;

  beforeEach(async () => {
    client = new FakePgClient();
    migrations = {
      applied: false,
      async run(c: PgClient) {
        if (this.applied) return;
        await c.query(`
          CREATE TABLE IF NOT EXISTS orgs (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            region      TEXT NOT NULL,
            plan        TEXT NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (region, LOWER(name))
          )
        `);
        this.applied = true;
      },
    };
    repo = new PostgresOrgRepository({ client, migrations });
    await repo.ensureSchema();
  });

  it('inserts a row and returns void on success', async () => {
    await repo.insert({
      id: 'org_test_1',
      name: 'Hudson',
      region: 'us-east',
      plan: 'pro',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const found = await repo.findById('org_test_1');
    assert.ok(found);
    assert.equal(found?.name, 'Hudson');
    assert.equal(found?.region, 'us-east');
  });

  it('throws a typed UniqueViolationError on (region, name) duplicate', async () => {
    const input = {
      id: 'org_a',
      name: 'Acme',
      region: 'us-east' as const,
      plan: 'pro' as const,
      createdAt: new Date(),
    };
    await repo.insert(input);
    await assert.rejects(
      () =>
        repo.insert({
          id: 'org_b',
          name: 'Acme',
          region: 'us-east',
          plan: 'pro',
          createdAt: new Date(),
        }),
      (err: unknown) => {
        const e = err as { name?: string; code?: string };
        return e?.name === 'UniqueViolationError' && e?.code === '23505';
      },
    );
  });

  it('findById returns null for unknown id', async () => {
    const found = await repo.findById('missing');
    assert.equal(found, null);
  });

  it('findByNameAndRegion matches case-insensitively', async () => {
    await repo.insert({
      id: 'org_x',
      name: 'Hudson Tower GC',
      region: 'us-east',
      plan: 'pro',
      createdAt: new Date(),
    });
    const found = await repo.findByNameAndRegion('hudson tower gc', 'us-east');
    assert.ok(found);
    assert.equal(found?.id, 'org_x');
  });

  it('findByNameAndRegion returns null when region differs', async () => {
    await repo.insert({
      id: 'org_y',
      name: 'Acme',
      region: 'us-east',
      plan: 'pro',
      createdAt: new Date(),
    });
    const found = await repo.findByNameAndRegion('Acme', 'eu-west');
    assert.equal(found, null);
  });

  it('preserves createdAt through round-trip', async () => {
    const ts = new Date('2026-08-08T12:00:00.000Z');
    await repo.insert({ id: 'org_t', name: 'Time', region: 'us-east', plan: 'pro', createdAt: ts });
    const found = await repo.findById('org_t');
    assert.ok(found);
    assert.equal(found?.createdAt.toISOString(), ts.toISOString());
  });

  it('runs the migration exactly once across multiple repo instances', async () => {
    const calls: string[] = [];
    const counting: MigrationRunner = {
      applied: false,
      async run(c) {
        calls.push('run');
        if (this.applied) return;
        await c.query('CREATE TABLE IF NOT EXISTS orgs (id TEXT PRIMARY KEY)');
        this.applied = true;
      },
    };
    const r1 = new PostgresOrgRepository({ client, migrations: counting });
    await r1.ensureSchema();
    await r1.ensureSchema();
    const r2 = new PostgresOrgRepository({ client, migrations: counting });
    await r2.ensureSchema();
    assert.equal(calls.length, 3);
    assert.equal(counting.applied, true);
  });
});
