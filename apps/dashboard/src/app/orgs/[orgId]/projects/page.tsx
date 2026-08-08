import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrg, listProjects, archiveProject, ApiError } from '@/lib/api';
import { ArchiveButton } from './archive-button';

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function OrgProjectsPage({ params }: PageProps) {
  const { orgId } = await params;
  let org;
  try {
    org = await getOrg(orgId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  if (!org) notFound();

  const projects = await listProjects(orgId);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
      <Link href="/" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
        ← Dashboard
      </Link>

      <header style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', letterSpacing: 'var(--tracking-tight)' }}>
          {org.name}
        </h1>
        <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-fg-muted)' }}>
          {org.region} · {org.plan} · {projects.length} project{projects.length === 1 ? '' : 's'}
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="plumb-empty">
          No projects in this organization yet.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-3)' }}>
          {projects.map((p) => (
            <li key={p.id} className="plumb-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fontWeight-medium)' }}>{p.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>{p.address}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-subtle)', marginTop: 'var(--space-1)' }}>
                  Started {new Date(p.startedAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span className="plumb-badge">{p.status}</span>
                {p.status !== 'archived' && <ArchiveButton projectId={p.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
