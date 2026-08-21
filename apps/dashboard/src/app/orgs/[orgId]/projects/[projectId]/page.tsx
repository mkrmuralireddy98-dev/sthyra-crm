import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { BimViewer } from '@/components/bim-viewer';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const MOCK_PROJECTS: Record<string, any> = {
 prj_demo: {
 name: 'Tower B — North Wing',
 status: 'active',
 progressPct: 67,
 location: 'San Francisco, CA',
 startedAt: '2026-03-15',
 totalArea: '125,000 sqft',
 levels: 12,
 capturesCount: 24,
 issuesCount: 8,
 milestones: [
 { name: 'Foundation', status: 'completed', date: '2026-04-30' },
 { name: 'Steel frame', status: 'completed', date: '2026-06-15' },
 { name: 'MEP rough-in', status: 'in_progress', date: '2026-08-20' },
 { name: 'Drywall', status: 'pending', date: '2026-09-15' },
 { name: 'Finishes', status: 'pending', date: '2026-11-01' },
 { name: 'TCO', status: 'pending', date: '2026-12-15' },
 ],
 },
 prj_skyline: { name: 'Skyline Tower', status: 'planning', progressPct: 12, location: 'New York, NY', startedAt: '2026-07-01', totalArea: '450,000 sqft', levels: 45 },
 prj_harbor: { name: 'Harbor Bridge Retrofit', status: 'at_risk', progressPct: 45, location: 'Seattle, WA', startedAt: '2026-01-10', totalArea: '—', levels: 0 },
};

export default async function ProjectDetailPage({ params }: { params: { orgId: string; projectId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const project = MOCK_PROJECTS[params.projectId] ?? MOCK_PROJECTS.prj_demo;
 const milestones = project.milestones ?? [];

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <header className="page-header">
 <div className="page-header-content">
 <h1 className="page-title">{project.name}</h1>
 <p className="page-subtitle">
 {project.location} · Started {project.startedAt} · {project.totalArea} · {project.levels} levels
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <span className="tenant-badge">{tenantId}</span>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-ghost">← All projects</Link>
 </div>
 </header>

 <section className="stats-grid">
 <div className="stat-card">
 <div className="stat-label">Progress</div>
 <div className="stat-value">{project.progressPct}%</div>
 <div className="progress-bar" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: project.progressPct + '%' }} /></div>
 </div>
 <div className="stat-card"><div className="stat-label">Captures</div><div className="stat-value">{project.capturesCount ?? 0}</div></div>
 <div className="stat-card"><div className="stat-label">Open issues</div><div className="stat-value">{project.issuesCount ?? 0}</div></div>
 <div className="stat-card">
 <div className="stat-label">Status</div>
 <div className="stat-value" style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: 1 }}>{project.status}</div>
 </div>
 </section>

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">BIM Model — 3D View</h2>
 <span className="section-action">Drag to rotate · Scroll to zoom</span>
 </div>
 <BimViewer />
 <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>
 Interactive 3D model rendered with Three.js. Production version supports IFC files via web-ifc.
 </p>
 </section>

 {milestones.length > 0 && (
 <section className="section">
 <div className="section-header">
 <h2 className="section-title">Milestones</h2>
 </div>
 <table className="data-table">
 <thead><tr><th>Milestone</th><th>Date</th><th>Status</th></tr></thead>
 <tbody>
 {milestones.map((m: any, i: number) => (
 <tr key={i}>
 <td>{m.name}</td>
 <td><time style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{m.date}</time></td>
 <td><span className={`badge ${m.status === 'completed' ? 'badge-success' : m.status === 'in_progress' ? 'badge-info' : 'badge-neutral'}`}>{m.status.replace('_', ' ')}</span></td>
 </tr>
 ))}
 </tbody>
 </table>
 </section>
 )}

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
