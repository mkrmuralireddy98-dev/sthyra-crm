import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';
import { listProjects } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

interface Project {
 id: string;
 name: string;
 status: 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';
 progressPct: number;
 capturesCount?: number;
 issuesCount?: number;
 location: string;
}

const MOCK_PROJECTS: Project[] = [
 { id: 'prj_demo', name: 'Tower B — North Wing', status: 'active', progressPct: 67, capturesCount: 24, issuesCount: 8, location: 'San Francisco, CA' },
 { id: 'prj_skyline', name: 'Skyline Tower', status: 'planning', progressPct: 12, capturesCount: 4, issuesCount: 1, location: 'New York, NY' },
 { id: 'prj_harbor', name: 'Harbor Bridge Retrofit', status: 'at_risk', progressPct: 45, capturesCount: 18, issuesCount: 23, location: 'Seattle, WA' },
 { id: 'prj_central', name: 'Central Plaza Mall', status: 'active', progressPct: 89, capturesCount: 56, issuesCount: 4, location: 'Chicago, IL' },
 { id: 'prj_reservoir', name: 'Reservoir Pump Station', status: 'delayed', progressPct: 23, capturesCount: 7, issuesCount: 12, location: 'Phoenix, AZ' },
 { id: 'prj_hospital', name: 'Mercy Hospital Expansion', status: 'active', progressPct: 54, capturesCount: 32, issuesCount: 6, location: 'Boston, MA' },
];

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

function MiniBar({ value }: { value: number }) {
 const pct = Math.min(100, value);
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ flex: 1, height: 4, background: 'var(--line)' }}>
 <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
 </div>
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
 </div>
 );
}

export default async function ProjectsPage({ params }: { params: { orgId: string } }) {
 const tenantId = params.orgId;
 const realProjects = await listProjects(tenantId);
 const projects: any[] = [
 ...realProjects.map(p => ({
 id: p.id, name: p.name, status: p.status, progressPct: p.progressPct,
 capturesCount: 0, issuesCount: 0, location: p.location,
 })),
 ...MOCK_PROJECTS.filter(mp => !realProjects.find(rp => rp.id === mp.id)),
 ];

 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// workspace · {tenantId}</span>
 </div>
 <h1 className="page-title">
 projects<span className="page-title-accent">.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)' }}>
 all construction projects · {projects.length} total · {projects.filter(p => p.status === 'active').length} active
 </p>
 </div>
 <Link href={`/orgs/${tenantId}/projects/new`} className="btn btn-primary">
 + new project
 </Link>
 </div>
 </section>

 <LiveMarquee />

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// all projects · {projects.length}</span>
 </div>

 <div style={{ border: '1px solid var(--line)', overflowX: 'auto' }}>
 <table className="data-table" style={{ border: 'none' }}>
 <thead>
 <tr>
 <th>// project</th>
 <th>// status</th>
 <th>// progress</th>
 <th>// captures</th>
 <th>// issues</th>
 <th>// location</th>
 </tr>
 </thead>
 <tbody>
 {projects.map((p) => (
 <tr key={p.id}>
 <td>
 <Link href={`/orgs/${tenantId}/projects/${p.id}`} style={{ fontWeight: 600 }}>
 {p.name}
 </Link>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 2 }}>{p.id}</div>
 </td>
 <td><StatusBadge status={p.status} /></td>
 <td style={{ minWidth: 200 }}><MiniBar value={p.progressPct} /></td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{p.capturesCount ?? 0}</td>
 <td style={{ fontVariantNumeric: 'tabular-nums', color: (p.issuesCount ?? 0) > 5 ? '#ff4444' : 'var(--fg)' }}>
 {p.issuesCount ?? 0}
 </td>
 <td style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{p.location}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>

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
 <span>{projects.length} projects</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
