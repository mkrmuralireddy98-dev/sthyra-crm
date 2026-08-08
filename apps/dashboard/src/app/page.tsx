import Link from 'next/link';
import { listProjects, ApiError } from '@/lib/api';
import { randomUUID } from 'node:crypto';
import { tokensFor } from '@plumb/tokens';

export const dynamic = 'force-dynamic'; // SSR — fetch live data on every request

const DEMO_ORG_ID = 'org_00000001';

export default async function DashboardHome() {
  const requestId = randomUUID();
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let error: string | null = null;
  try {
    projects = await listProjects(DEMO_ORG_ID, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      error = `${err.title} (request ${err.traceId})`;
    } else {
      error = `Unable to reach project-service: ${String(err)}`;
    }
  }

  const tokens = tokensFor('dark');
  const activeProjects = projects.filter((p) => p.status === 'active').length;

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
          <div className="plumb-stat-label">Active projects</div>
          <div className="plumb-stat">{activeProjects}</div>
        </div>
        <div className="plumb-card">
          <div className="plumb-stat-label">Total projects</div>
          <div className="plumb-stat">{projects.length}</div>
        </div>
        <div className="plumb-card">
          <div className="plumb-stat-label">Plan</div>
          <div className="plumb-stat" style={{ fontSize: 'var(--text-xl)' }}>Pro</div>
        </div>
        <div className="plumb-card">
          <div className="plumb-stat-label">Region</div>
          <div className="plumb-stat" style={{ fontSize: 'var(--text-xl)' }}>us-east</div>
        </div>
      </section>

      <section aria-label="Projects">
        <h2 style={{ fontSize: 'var(--text-xl)', margin: '0 0 var(--space-4)' }}>Projects</h2>
        {error && (
          <div className="plumb-card" role="alert" style={{ borderColor: 'var(--color-critical)' }}>
            <strong>Service unavailable.</strong> {error}
            <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
              Start the project-service with{' '}
              <code style={{ background: 'var(--color-surface-sunken)', padding: '2px 6px', borderRadius: 4 }}>
                pnpm --filter=@plumb/project-service start:inmem
              </code>
            </p>
          </div>
        )}

        {!error && projects.length === 0 && (
          <div className="plumb-empty">
            No projects yet. <Link href="/orgs/new">Create your first org</Link> to get started.
          </div>
        )}

        {!error && projects.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-3)' }}>
            {projects.map((p) => (
              <li key={p.id} className="plumb-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fontWeight-medium)' }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>{p.address}</div>
                </div>
                <span className="plumb-badge">{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer style={{ marginTop: 'var(--space-16)', color: 'var(--color-fg-subtle)', fontSize: 'var(--text-xs)' }}>
        Request <code style={{ fontFamily: 'var(--fontFamily-mono, monospace)' }}>{requestId}</code> ·
        Token bg <code style={{ fontFamily: 'var(--fontFamily-mono, monospace)' }}>{tokens.color.bg}</code>
      </footer>
    </main>
  );
}
