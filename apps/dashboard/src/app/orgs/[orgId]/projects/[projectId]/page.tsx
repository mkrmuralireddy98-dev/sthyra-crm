import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';
import { BimViewer } from '@/components/bim-viewer';

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
 prj_skyline: { name: 'Skyline Tower', status: 'planning', progressPct: 12, location: 'New York, NY', startedAt: '2026-07-01', totalArea: '450,000 sqft', levels: 45, capturesCount: 4, issuesCount: 1, milestones: [] },
 prj_harbor: { name: 'Harbor Bridge Retrofit', status: 'at_risk', progressPct: 45, location: 'Seattle, WA', startedAt: '2026-01-10', totalArea: '—', levels: 0, capturesCount: 18, issuesCount: 23, milestones: [] },
};

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, string> = {
 active: 'badge-success',
 planning: 'badge-info',
 at_risk: 'badge-warning',
 delayed: 'badge-warning',
 completed: 'badge-success',
 cancelled: 'badge-neutral',
 };
 return <span className={`badge ${map[status] ?? 'badge-neutral'}`}>{status.replace('_', ' ')}</span>;
}

export default async function ProjectDetailPage({ params }: { params: { orgId: string; projectId: string } }) {
 const tenantId = params.orgId;
 const project = MOCK_PROJECTS[params.projectId] ?? MOCK_PROJECTS.prj_demo;
 const milestones = project.milestones ?? [];

 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// {tenantId} · {params.projectId}</span>
 </div>
 <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
 <StatusBadge status={project.status} />
 </div>
 <h1 className="page-title" style={{ fontSize: 'clamp(36px, 6vw, 80px)' }}>
 {project.name}
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)' }}>
 {project.location} · started {project.startedAt} · {project.totalArea} · {project.levels} levels · {project.capturesCount ?? 0} captures · {project.issuesCount ?? 0} open issues
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-ghost">← back</Link>
 <button className="btn btn-primary">+ upload capture</button>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// progress</div>
 <div className="stat-value">{project.progressPct}<span style={{ fontSize: 18, color: 'var(--accent)' }}>%</span></div>
 <div style={{ marginTop: 8, height: 4, background: 'var(--line)' }}>
 <div style={{ height: '100%', width: `${project.progressPct}%`, background: 'var(--accent)' }} />
 </div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// captures</div>
 <div className="stat-value">{project.capturesCount ?? 0}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// open issues</div>
 <div className="stat-value">{project.issuesCount ?? 0}</div>
 <div className="stat-delta" style={{ color: '#ff4444' }}>↑ needs triage</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// team</div>
 <div className="stat-value">6</div>
 <div className="stat-delta">active</div>
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 0 }}>
 <span className="page-eyebrow-marker" />
 <span>// bim model · 3d view</span>
 </div>
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
 drag to rotate · scroll to zoom
 </span>
 </div>
 <div style={{ border: '1px solid var(--line)', overflow: 'hidden' }}>
 <BimViewer />
 </div>
 <p style={{ fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 'var(--space-3)', textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
 // rendered with three.js · supports IFC files via web-ifc
 </p>
 </section>

 {milestones.length > 0 && (
 <section style={{ padding: 'var(--space-7) 0', borderTop: '1px solid var(--line)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// milestones · {milestones.length}</span>
 </div>

 <table className="data-table">
 <thead>
 <tr>
 <th>// milestone</th>
 <th>// date</th>
 <th>// status</th>
 </tr>
 </thead>
 <tbody>
 {milestones.map((m: any, i: number) => (
 <tr key={i}>
 <td style={{ fontWeight: 510 }}>{m.name}</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{m.date}</td>
 <td>
 <span className={`badge ${
 m.status === 'completed' ? 'badge-success' :
 m.status === 'in_progress' ? 'badge-info' : 'badge-neutral'
 }`}>
 <span className="badge-dot" />{m.status.replace('_', ' ')}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </section>
 )}

 <footer style={{
 padding: 'var(--space-7) 0',
 borderTop: '1px solid var(--line)',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 fontFamily: 'var(--font-mono)',
 fontSize: 11,
 color: 'var(--fg-muted)',
 letterSpacing: '0.1em',
 textTransform: 'uppercase',
 }}>
 <span>© 2026 — sthyra</span>
 <span>{project.name} · {project.progressPct}% complete</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
