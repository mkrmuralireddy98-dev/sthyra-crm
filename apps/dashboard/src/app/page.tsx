import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Org {
 id: string;
 name: string;
 region: string;
 plan: string;
}

interface Project {
 id: string;
 orgId: string;
 name: string;
 status: 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';
 progressPct: number;
 capturesCount?: number;
 issuesCount?: number;
}

async function fetchJson<T>(url: string, tenantId: string): Promise<T> {
 const res = await fetch(url, {
 headers: { 'x-tenant-id': tenantId, 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 return res.json();
}

export default async function DashboardHome() {
 const requestId = randomUUID();
 const tenantId = 'org_a';

 let orgs: Org[] = [];
 let totalProjects = 0;
 let activeProjects = 0;
 let openIssues = 0;
 let totalCaptures = 0;

 try {
 orgs = await fetchJson<Org[]>('http://localhost:9103/v1/orgs', tenantId);
 } catch {}

 try {
 const projects = await fetchJson<Project[]>('http://localhost:9102/v1/projects?orgId=' + tenantId, tenantId);
 totalProjects = projects.length;
 activeProjects = projects.filter(p => p.status === 'active').length;
 } catch {}

 try {
 const issuesData = await fetchJson<any>('http://localhost:9091/v1/projects/prj_demo/issues', tenantId);
 openIssues = (issuesData.data || []).filter((i: any) => i.status === 'open').length;
 } catch {}

 try {
 const capturesData = await fetchJson<any>('http://localhost:9090/v1/projects/prj_demo/captures', tenantId);
 totalCaptures = (capturesData.data || []).length;
 } catch {}

 return (
 <div className="app-shell">
 <Sidebar currentOrgId={tenantId} currentPath="/" />

 <main className="main">
 <header className="page-header fade-in">
 <div className="page-header-content">
 <h1 className="page-title">Dashboard</h1>
 <p className="page-subtitle">Real-time view of construction operations across all projects</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
 <span className="tenant-badge">{tenantId}</span>
 <Link href="/orgs/new" className="btn btn-primary">+ New organization</Link>
 </div>
 </header>

 <section className="stats-grid mount-stagger" aria-label="Key metrics">
 <div className="stat-card">
 <div className="stat-label">Organizations</div>
 <div className="stat-value">{orgs.length}</div>
 <div className="stat-trend">Across {new Set(orgs.map(o => o.region)).size || 0} regions</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">Active Projects</div>
 <div className="stat-value">{activeProjects}</div>
 <div className="stat-trend">{totalProjects} total</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">Open Issues</div>
 <div className="stat-value">{openIssues}</div>
 <div className="stat-trend">{openIssues > 0 ? 'Needs attention' : 'All clear'}</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">Captures</div>
 <div className="stat-value">{totalCaptures}</div>
 <div className="stat-trend">360° photos uploaded</div>
 </div>
 </section>

 <section className="section fade-in" aria-label="Organizations">
 <div className="section-header">
 <h2 className="section-title">Your organizations</h2>
 <Link href="/orgs" className="section-action">View all →</Link>
 </div>

 {orgs.length === 0 ? (
 <div className="empty">
 <div className="empty-icon" aria-hidden="true">⌂</div>
 <h3 className="empty-title">No organizations yet</h3>
 <p className="empty-description">
 Get started by creating your first organization. Each org gets its own projects, captures, and team.
 </p>
 <Link href="/orgs/new" className="btn btn-primary">Create organization</Link>
 </div>
 ) : (
 <div className="project-grid">
 {orgs.slice(0, 6).map((org) => (
 <Link key={org.id} href={`/orgs/${org.id}/projects`} className="project-card">
 <div className="project-name">{org.name}</div>
 <div className="project-id">{org.id}</div>
 <div className="card-meta">
 <span className="badge badge-teal">{org.plan}</span>
 <span>{org.region}</span>
 </div>
 <div className="progress-text">
 <span>0% complete</span>
 <span>0 projects</span>
 </div>
 </Link>
 ))}
 </div>
 )}
 </section>

 <section className="section fade-in" aria-label="Quick actions">
 <div className="section-header">
 <h2 className="section-title">Quick actions</h2>
 </div>
 <div className="project-grid">
 <Link href="/orgs/org_a/captures" className="project-card">
 <div className="project-name">📷 Upload capture</div>
 <div className="card-description">360° photos, walkthroughs, floor plans</div>
 </Link>
 <Link href="/orgs/org_a/projects" className="project-card">
 <div className="project-name">▣ Manage projects</div>
 <div className="card-description">Track milestones, status, captures</div>
 </Link>
 <Link href="/orgs/org_a/issues" className="project-card">
 <div className="project-name">⚠ Field issues</div>
 <div className="card-description">Punch list, RFIs, defects</div>
 </Link>
 <Link href="/orgs/org_a/reports" className="project-card">
 <div className="project-name">▤ Reports</div>
 <div className="card-description">Daily, weekly, portfolio summaries</div>
 </Link>
 </div>
 </section>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code> · Sthyra CRM Platform v0.13
 </footer>
 </main>
 </div>
 );
}
