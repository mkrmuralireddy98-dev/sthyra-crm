import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Project {
 id: string;
 name: string;
 status: 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';
 progressPct: number;
 capturesCount?: number;
 issuesCount?: number;
}

const MOCK_PROJECTS: Project[] = [
 { id: 'prj_demo', name: 'Tower B — North Wing', status: 'active', progressPct: 67, capturesCount: 24, issuesCount: 8 },
 { id: 'prj_skyline', name: 'Skyline Tower', status: 'planning', progressPct: 12, capturesCount: 4, issuesCount: 1 },
 { id: 'prj_harbor', name: 'Harbor Bridge Retrofit', status: 'at_risk', progressPct: 45, capturesCount: 18, issuesCount: 23 },
 { id: 'prj_central', name: 'Central Plaza Mall', status: 'active', progressPct: 89, capturesCount: 56, issuesCount: 4 },
 { id: 'prj_reservoir', name: 'Reservoir Pump Station', status: 'delayed', progressPct: 23, capturesCount: 7, issuesCount: 12 },
];

function StatusBadge({ status }: { status: string }) {
 const cls = status === 'completed' ? 'badge-success' :
 status === 'active' ? 'badge-info' :
 status === 'planning' ? 'badge-neutral' :
 status === 'at_risk' || status === 'delayed' ? 'badge-warning' :
 status === 'cancelled' ? 'badge-danger' : 'badge-neutral';
 return <span className={`badge ${cls}`}><span className="badge-dot" />{status.replace('_', ' ')}</span>;
}

export default async function ProjectsPage({ params }: { params: { orgId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const projects = MOCK_PROJECTS;

 return (
 <div className="app-shell">
 <Sidebar currentOrgId={tenantId} currentPath={`/orgs/${tenantId}/projects`} />
 <main className="main">
 <header className="page-header">
 <div className="page-header-content">
 <h1 className="page-title">Projects</h1>
 <p className="page-subtitle">All construction projects for {tenantId}</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <span className="tenant-badge">{tenantId}</span>
 <Link href={`/orgs/${tenantId}/projects/new`} className="btn btn-primary">+ New project</Link>
 </div>
 </header>

 <section className="stats-grid">
 <div className="stat-card"><div className="stat-label">Total projects</div><div className="stat-value">{projects.length}</div></div>
 <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value">{projects.filter(p => p.status === 'active').length}</div></div>
 <div className="stat-card"><div className="stat-label">At risk</div><div className="stat-value">{projects.filter(p => p.status === 'at_risk' || p.status === 'delayed').length}</div></div>
 <div className="stat-card"><div className="stat-label">Avg progress</div><div className="stat-value">{Math.round(projects.reduce((a, p) => a + p.progressPct, 0) / projects.length)}%</div></div>
 </section>

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">All projects</h2>
 <span className="section-action">{projects.length} items</span>
 </div>

 <div className="project-grid">
 {projects.map((p) => (
 <Link key={p.id} href={`/orgs/${tenantId}/projects/${p.id}`} className="project-card">
 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
 <div style={{ flex: 1 }}>
 <div className="project-name">{p.name}</div>
 <div className="project-id">{p.id}</div>
 </div>
 <StatusBadge status={p.status} />
 </div>
 <div className="progress-bar"><div className="progress-fill" style={{ width: p.progressPct + '%' }} /></div>
 <div className="progress-text">
 <span>{p.progressPct}% complete</span>
 <span>{p.capturesCount} captures · {p.issuesCount} issues</span>
 </div>
 </Link>
 ))}
 </div>
 </section>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
