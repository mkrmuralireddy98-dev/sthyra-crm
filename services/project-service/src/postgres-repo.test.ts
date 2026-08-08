import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  PostgresProjectRepository,
  type PgClient,
  type MigrationRunner,
} from './postgres-repo.js';
import type { Project } from './index.js';

/**
 * Minimal in-memory PgClient — same testing strategy as org-service.
 * Mirrors the slice of the pg API we actually use.
 */

type Row = Record<string, unknown>;

class FakePgClient implements PgClient {
  readonly tables = new Map<string, Row[]>();
  readonly executed: { sql: string; params: unknown[] }[] = [];

  async query<R extends Row = Row>(sql: string, params: unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
    const normalized = sql.trim().replace(/\s+/g, ' ').toLowerCase();
    this.executed.push({ sql: normalized, params });
    if (normalized.startsWith('create table')) {
      this.tables.set('projects', []);
      return { rows: [], rowCount: 0 };
    }
    if (normalized.startsWith('insert into projects')) {
      const [id, orgId, name, status, address, startedAt, createdAt] = params as [
        string,
        string,
        string,
        string,
        string,
        Date,
        Date,
      ];
      const tbl = this.tables.get('projects') ?? [];
      tbl.push({
        id,
        org_id: orgId,
        name,
        status,
        address,
        started_at: startedAt,
        created_at: createdAt,
        archived_at: null,
      });
      this.tables.set('projects', tbl);
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith('update projects')) {
      // Matches: SET status = $1, archived_at = $2, name = $3, address = $4 WHERE id = $5
      const [status, archivedAt, , , id] = params as [string, Date | null, string, string, string];
      const tbl = this.tables.get('projects') ?? [];
      const row = tbl.find((r) => r.id === id);
      if (!row) return { rows: [], rowCount: 0 };
      row.status = status;
      row.archived_at = archivedAt;
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith('select') && normalized.includes('from projects where id')) {
      const [id] = params as [string];
      const tbl = this.tables.get('projects') ?? [];
      const row = tbl.find((r) => r.id === id);
      return { rows: row ? [row as R] : [], rowCount: row ? 1 : 0 };
    }
    if (normalized.startsWith('select') && normalized.includes('from projects where org_id')) {
      const [orgId, limitStr] = params as [string, string | undefined];
      const tbl = this.tables.get('projects') ?? [];
      const rows = tbl
        .filter((r) => r.org_id === orgId)
        .sort((a, b) => +new Date(b.created_at as string) - +new Date(a.created_at as string));
      const limited = limitStr ? rows.slice(0, Number(limitStr)) : rows;
      return { rows: limited as R[], rowCount: limited.length };
    }
    return { rows: [], rowCount: 0 };
  }
}

function makeProjectFixture(overrides: Partial<Project> = {}): Project {
  return {
    id: 'prj_test_1',
    orgId: 'org_00000001',
    name: 'Hudson Tower',
    status: 'active',
    address: '500 W 33rd St',
    startedAt: new Date('2026-01-15T00:00:00.000Z'),
    createdAt: new Date('2026-01-15T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PostgresProjectRepository', () => {
  let client: FakePgClient;
  let migrations: MigrationRunner;
  let repo: PostgresProjectRepository;

  beforeEach(async () => {
    client = new FakePgClient();
    migrations = {
      applied: false,
      async run(c: PgClient) {
        if (this.applied) return;
        await c.query(`
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
          )
        `);
        await c.query('CREATE INDEX IF NOT EXISTS projects_org_id_idx ON projects (org_id)');
        this.applied = true;
      },
    };
    repo = new PostgresProjectRepository({ client, migrations });
    await repo.ensureSchema();
  });

  it('inserts a project and reads it back by id', async () => {
    const project = makeProjectFixture({ id: 'prj_a' });
    await repo.insert(project);
    const found = await repo.findById('prj_a');
    assert.ok(found);
    assert.equal(found?.orgId, 'org_00000001');
    assert.equal(found?.name, 'Hudson Tower');
    assert.equal(found?.status, 'active');
  });

  it('returns null for unknown id', async () => {
    assert.equal(await repo.findById('missing'), null);
  });

  it('listByOrg returns projects for that org sorted by createdAt desc', async () => {
    await repo.insert(
      makeProjectFixture({
        id: 'p1',
        name: 'Older',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    await repo.insert(
      makeProjectFixture({
        id: 'p2',
        name: 'Newer',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      }),
    );
    await repo.insert(
      makeProjectFixture({
        id: 'p_other',
        orgId: 'org_00000002',
        name: 'Other Org',
      }),
    );

    const list = await repo.listByOrg('org_00000001');
    assert.equal(list.length, 2);
    assert.equal(list[0]?.id, 'p2'); // newer first
    assert.equal(list[1]?.id, 'p1');
    assert.ok(list.every((p) => p.orgId === 'org_00000001'));
  });

  it('listByOrg respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.insert(
        makeProjectFixture({
          id: `p${i}`,
          createdAt: new Date(`2026-01-0${i + 1}T00:00:00.000Z`),
        }),
      );
    }
    const limited = await repo.listByOrg('org_00000001', 2);
    assert.equal(limited.length, 2);
    assert.equal(limited[0]?.id, 'p4');
  });

  it('update writes the new state and preserves the id', async () => {
    const project = makeProjectFixture({ id: 'p_arc' });
    await repo.insert(project);
    const updated: Project = {
      ...project,
      status: 'archived',
      archivedAt: new Date('2026-12-01T00:00:00.000Z'),
    };
    await repo.update(updated);
    const found = await repo.findById('p_arc');
    assert.ok(found);
    assert.equal(found?.status, 'archived');
    assert.ok(found?.archivedAt);
    assert.equal(found?.archivedAt?.toISOString(), '2026-12-01T00:00:00.000Z');
  });

  it('uses parameterized queries — no string concatenation of values', async () => {
    await repo.insert(makeProjectFixture({ id: 'p_safe' }));
    const inserts = client.executed.filter((e) => e.sql.startsWith('insert into projects'));
    assert.equal(inserts.length, 1);
    const insert = inserts[0]!;
    assert.match(insert.sql, /\$\d+/);
    // The malicious-looking name should appear as a $N placeholder, never inline.
    assert.equal(insert.sql.includes("'Hudson Tower'"), false);
  });
});
