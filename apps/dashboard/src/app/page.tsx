import Link from 'next/link';
import { listOrgs, listProjects, ApiError } from '@/lib/api';
import { randomUUID } from 'node:crypto';
import { tokensFor } from '@plumb/tokens';

export const dynamic = 'force-dynamic'; // SSR — fetch live data on every request

/**
 * Plumb dashboard home. Shows each org with a rollup of its active projects.
 * Real data path: org-service GET /v1/orgs + project-service GET /v1/projects?orgId=...
 * The order is sequential (orgs first, then projects per org) so we surface
 * a clear error per service if either is down.
 */
export default async function DashboardHome() {
  const requestId = randomUUID();
  const tokens = tokensFor('dark');

  let orgs: Awaited<ReturnType<typeof listOrgs>> = [];
  let orgError: string | null = null;
  try {
    orgs = await listOrgs({ requestId });
  } catch (err) {
    orgError = err instanceof ApiError ? `${err.title} (request ${err.traceId})` : String(err);
  }

  // Fetch projects per org in parallel — bounded by org count displayed.
  const projectsByOrg = new Map<string, Awaited<ReturnType<typeof listProjects>>>();
  const projectErrors: string[] = [];
  await Promise.all(
    orgs.map(async (org) => {
      try {
        const projects = await listProjects(org.id, { requestId });
        projectsByOrg.set(org.id, projects);
      } catch (err) {
        projectErrors.push(
          `${org.name}: ${err instanceof ApiError ? err.title : String(err)}`,
        );
      }
    }),
  );

  const totals = orgs.reduce(
    (acc, o) => {
      const projects = projectsByOrg.get(o.id) ?? [];
      acc.projects += projects.length;
      acc.active += projects.filter((p) => p.status === 'active').length;
      return acc;
    },
    { projects: 0, active: 0 },
  );

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-10)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-3xl)', letterSpacing: 'var(--tracking-tight)' }}>
            Plumb
          </h1>
          <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-fg-muted)' }}>
            Visual intelligence for the built world.
          </p>
        </div>
        <Link href="/orgs/new" className="plumb-button">+ New org</Link>
      </header>

      <section
        aria-label="Key metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <div className="plumb-card">
          <div className="plumb-stat-label">Organizations</div>
          <div className="plumb-stat">{orgs.length}</div>
        </div>
        <div className="plumb-card">
          <div className="plumb-stat-label">Total projects</div>
          <div className="plumb-stat">{totals.projects}</div>
        </div>
        <div className="plumb-card">
          <div className="plumb-stat-label">Active projects</div>
          <div className="plumb-stat">{totals.active}</div>
        </div>
        <div className="plumb-card">
          <div className="plumb-stat-label">Regions</div>
          <div className="plumb-stat" style={{ fontSize: 'var(--text-xl)' }}>
            {[...new Set(orgs.map((o) => o.region))].length || '—'}
          </div>
        </div>
      </section>

      <section aria-label="Organizations">
        <h2 style={{ fontSize: 'var(--text-xl)', margin: '0 0 var(--space-4)' }}>Organizations</h2>

        {orgError && (
          <div className="plumb-card" role="alert" style={{ borderColor: 'var(--color-critical)' }}>
            <strong>org-service unavailable.</strong> {orgError}
            <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
              Start it with{' '}
              <code style={{ background: 'var(--color-surface-sunken)', padding: '2px 6px', borderRadius: 4 }}>
                pnpm --filter=@plumb/org-service start:inmem
              </code>
            </p>
          </div>
        )}

        {!orgError && orgs.length === 0 && (
          <div className="plumb-empty">
            No organizations yet. <Link href="/orgs/new">Create your first org</Link> to get started.
          </div>
        )}

        {!orgError && orgs.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-3)' }}>
            {orgs.map((org) => {
              const projects = projectsByOrg.get(org.id) ?? [];
              const active = projects.filter((p) => p.status === 'active').length;
              return (
                <li key={org.id} className="plumb-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fontWeight-medium)' }}>{org.name}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
                      {org.region} · {org.plan} · {active} active of {projects.length} projects
                    </div>
                  </div>
                  <Link
                    href={`/orgs/${org.id}/projects`}
                    className="plumb-button plumb-button--ghost"
                    style={{ textDecoration: 'none' }}
                  >
                    View projects →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {projectErrors.length > 0 && (
          <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-warning)' }}>
            project-service partial failure: {projectErrors.join('; ')}
          </p>
        )}
      </section>

      <footer style={{ marginTop: 'var(--space-16)', color: 'var(--color-fg-subtle)', fontSize: 'var(--text-xs)' }}>
        Request <code style={{ fontFamily: 'var(--fontFamily-mono, monospace)' }}>{requestId}</code> ·
        Token bg <code style={{ fontFamily: 'var(--fontFamily-mono, monospace)' }}>{tokens.color.bg}</code>
      </footer>
    </main>
  );
}
