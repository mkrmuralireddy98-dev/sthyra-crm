import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Project {
 id: string;
 name: string;
 status: 'planning' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';
 progressPct: number;
 location: string;
 startedAt: string;
 manager: string;
 capturesCount: number;
 issuesOpen: number;
 issuesCritical: number;
 lastActivity: string;
 nextMilestone: string;
 team: string[];
}

const PROJECT_POOL: Project[] = [
 { id: 'prj_demo', name: 'Tower B — North Wing', status: 'active', progressPct: 67, location: 'San Francisco, CA', startedAt: '2026-03-15', manager: 'Sarah Chen', capturesCount: 24, issuesOpen: 8, issuesCritical: 1, lastActivity: '2 hours ago', nextMilestone: 'MEP rough-in · Aug 20', team: ['Sarah Chen', 'Mike Rodriguez', 'Lisa Park', 'Tom Bradley'] },
 { id: 'prj_skyline', name: 'Skyline Tower', status: 'planning', progressPct: 12, location: 'New York, NY', startedAt: '2026-07-01', manager: 'Marcus Wei', capturesCount: 4, issuesOpen: 1, issuesCritical: 0, lastActivity: '1 day ago', nextMilestone: 'Foundation inspection · Sep 5', team: ['Marcus Wei', 'Aisha Patel'] },
 { id: 'prj_harbor', name: 'Harbor Bridge Retrofit', status: 'at_risk', progressPct: 45, location: 'Seattle, WA', startedAt: '2026-01-10', manager: 'Diego Morales', capturesCount: 18, issuesOpen: 23, issuesCritical: 3, lastActivity: '15 min ago', nextMilestone: 'Cable tensioning · Aug 25', team: ['Diego Morales', 'Priya Singh', 'James Park'] },
 { id: 'prj_central', name: 'Central Plaza Mall', status: 'active', progressPct: 89, location: 'Chicago, IL', startedAt: '2025-09-22', manager: 'Hana Kim', capturesCount: 56, issuesOpen: 4, issuesCritical: 0, lastActivity: '3 days ago', nextMilestone: 'Tenant fit-out · Sep 12', team: ['Hana Kim', 'Robert Zhang', 'Maya Singh'] },
 { id: 'prj_reservoir', name: 'Reservoir Pump Station', status: 'delayed', progressPct: 23, location: 'Phoenix, AZ', startedAt: '2026-04-08', manager: 'Alex Rivera', capturesCount: 7, issuesOpen: 12, issuesCritical: 2, lastActivity: '5 hours ago', nextMilestone: 'Permit renewal · Aug 18', team: ['Alex Rivera', 'Jordan Park'] },
 { id: 'prj_hospital', name: 'Mercy Hospital Expansion', status: 'active', progressPct: 54, location: 'Boston, MA', startedAt: '2025-12-04', manager: 'Kavita Reddy', capturesCount: 32, issuesOpen: 6, issuesCritical: 0, lastActivity: '30 min ago', nextMilestone: 'OR wing inspection · Aug 22', team: ['Kavita Reddy', 'Ben Tanaka', 'Sofia Russo', 'Daniel Okoye'] },
];

const ORG_TO_PROJECTS: Record<string, string[]> = {
 org_a: ['prj_demo', 'prj_hospital', 'prj_skyline'],
 org_b: ['prj_central', 'prj_harbor'],
 org_c: ['prj_reservoir'],
};

const ORG_NAMES: Record<string, string> = {
 org_a: 'Acme Construction',
 org_b: 'BuildRight Inc',
 org_c: 'MegaStructures LLC',
};

async function fetchIssues() {
 try {
 const res = await fetch('http://127.0.0.1:9091/v1/projects/prj_demo/issues', {
 headers: { 'x-tenant-id': 'org_a' },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return (data.data || []).slice(0, 8);
 } catch {
 return [];
 }
}

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, { label: string; cls: string }> = {
 active: { label: 'active', cls: 'badge-success' },
 planning: { label: 'planning', cls: 'badge-info' },
 at_risk: { label: 'at risk', cls: 'badge-warning' },
 delayed: { label: 'delayed', cls: 'badge-warning' },
 completed: { label: 'completed', cls: 'badge-success' },
 cancelled: { label: 'cancelled', cls: 'badge-neutral' },
 };
 const s = map[status] ?? { label: status, cls: 'badge-neutral' };
 return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
 const map: Record<string, string> = {
 critical: 'badge-danger',
 high: 'badge-danger',
 medium: 'badge-warning',
 low: 'badge-neutral',
 };
 return <span className={`badge ${map[severity] ?? 'badge-neutral'}`}>{severity}</span>;
}

function MiniBar({ value }: { value: number }) {
 const pct = Math.min(100, value);
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ flex: 1, height: 4, background: 'var(--line)' }}>
 <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
 </div>
 <span style={{
 fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
 minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
 }}>
 {pct}%
 </span>
 </div>
 );
}

export default async function Dashboard() {
 const cookieStore = await cookies();
 const role = cookieStore.get('sthyra-role')?.value ?? 'user';

 // If user is admin, redirect them to /admin
 if (role === 'admin') redirect('/admin');
 const orgId = cookieStore.get('sthyra-org')?.value ?? 'org_a';

 const issues = await fetchIssues();
 const visibleProjectIds: string[] = ORG_TO_PROJECTS[orgId] ?? ORG_TO_PROJECTS.org_a ?? [];
 const projects = PROJECT_POOL.filter(p => visibleProjectIds.includes(p.id));
 const orgName = ORG_NAMES[orgId] ?? ORG_NAMES.org_a;

 const totals = {
 projects: projects.length,
 active: projects.filter(p => p.status === 'active').length,
 atRisk: projects.filter(p => p.status === 'at_risk' || p.status === 'delayed').length,
 captures: projects.reduce((a, p) => a + p.capturesCount, 0),
 openIssues: projects.reduce((a, p) => a + p.issuesOpen, 0),
 critical: projects.reduce((a, p) => a + p.issuesCritical, 0),
 };

 return (
 <div className="app-shell">
 <TopNav />

 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// workspace · {orgId} · us-east</span>
 </div>
 <h1 className="page-title">
 operations<br />
 <span className="page-title-accent">console.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520, lineHeight: 1.55 }}>
 {orgName} · {totals.openIssues} open issues ·{' '}
 <span style={{ color: 'var(--accent)' }}>{totals.critical} critical</span> · updated 2 min ago.
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${orgId}/issues/new`} className="btn btn-primary">
 + new issue
 </Link>
 <Link href={`/orgs/${orgId}/projects/new`} className="btn btn-ghost">
 + new project
 </Link>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// projects</div>
 <div className="stat-value">{totals.projects}</div>
 <div className="stat-delta">{totals.active} active · {totals.atRisk} at risk</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// captures · 7d</div>
 <div className="stat-value">{totals.captures}</div>
 <div className="stat-delta">+12 this week</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// open issues</div>
 <div className="stat-value">{totals.openIssues}</div>
 <div className="stat-delta" style={{ color: totals.critical > 0 ? '#ff4444' : 'var(--accent)' }}>
 {totals.critical > 0 ? `↑ ${totals.critical} critical` : '✓ within SLA'}
 </div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// team</div>
 <div className="stat-value">{projects[0]?.team.length ?? 0}</div>
 <div className="stat-delta">active</div>
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 16 }}>
 <div className="page-eyebrow" style={{ marginBottom: 0 }}>
 <span className="page-eyebrow-marker" />
 <span>// projects · {totals.projects}</span>
 </div>
 <Link href={`/orgs/${orgId}/projects`} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
 view all →
 </Link>
 </div>

 <div style={{ border: '1px solid var(--line)', overflowX: 'auto' }}>
 <table className="data-table" style={{ border: 'none' }}>
 <thead>
 <tr>
 <th>// project</th>
 <th>// status</th>
 <th>// progress</th>
 <th>// captures</th>
 <th>// open</th>
 <th>// next milestone</th>
 <th>// last activity</th>
 </tr>
 </thead>
 <tbody>
 {projects.map((p) => (
 <tr key={p.id}>
 <td>
 <Link href={`/orgs/${orgId}/projects/${p.id}`} style={{ fontWeight: 600 }}>
 {p.name}
 </Link>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 2 }}>
 {p.id} · {p.location}
 </div>
 </td>
 <td><StatusBadge status={p.status} /></td>
 <td style={{ minWidth: 160 }}><MiniBar value={p.progressPct} /></td>
 <td><span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.capturesCount}</span></td>
 <td>
 <span style={{
 color: p.issuesCritical > 0 ? '#ff4444' : 'var(--fg)',
 fontVariantNumeric: 'tabular-nums',
 }}>
 {p.issuesOpen}
 </span>
 {p.issuesCritical > 0 && (
 <span style={{ color: '#ff4444', fontSize: 10, marginLeft: 4 }}>
 ({p.issuesCritical} crit)
 </span>
 )}
 </td>
 <td style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{p.nextMilestone}</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)' }}>{p.lastActivity}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>

 <section style={{
 display: 'grid',
 gridTemplateColumns: '1.4fr 1fr',
 gap: 1,
 background: 'var(--line)',
 border: '1px solid var(--line)',
 marginTop: 'var(--space-7)',
 }}>
 <div style={{ background: 'var(--bg-page)', padding: 'var(--space-5)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// needs attention · {totals.openIssues}</span>
 </div>
 {issues.length === 0 ? (
 <div className="empty">
 <div className="empty-eyebrow">// all clear</div>
 <h3 className="empty-title">no issues detected.</h3>
 </div>
 ) : (
 <table className="data-table" style={{ border: 'none' }}>
 <thead>
 <tr>
 <th>// severity</th>
 <th>// title</th>
 <th>// project</th>
 </tr>
 </thead>
 <tbody>
 {issues.slice(0, 6).map((issue: any) => (
 <tr key={issue.id}>
 <td><SeverityBadge severity={issue.severity} /></td>
 <td><Link href={`/orgs/${orgId}/issues/${issue.id}`}>{issue.title}</Link></td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)' }}>{issue.projectId}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>

 <div style={{ background: 'var(--bg-page)', padding: 'var(--space-5)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// recent activity</span>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
 {[
 { who: 'Sarah Chen', what: 'raised', target: 'ISS-9182', when: '2h' },
 { who: 'Mike Rodriguez', what: 'uploaded', target: 'cap_0281', when: '4h' },
 { who: 'Lisa Park', what: 'resolved', target: 'ISS-9160', when: '6h' },
 { who: 'Workflow', what: 'auto-assigned', target: 'ISS-9182 → Lisa Park', when: '2h' },
 { who: 'Capture service', what: 'processed', target: 'cap_0278 (4hr stitch)', when: '5h' },
 ].map((a, i) => (
 <div key={i} style={{
 display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
 paddingBottom: 'var(--space-3)',
 borderBottom: i < 4 ? '1px solid var(--line)' : 'none',
 }}>
 <div style={{
 width: 24, height: 24, flexShrink: 0,
 border: '1px solid var(--line)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
 color: 'var(--fg-muted)',
 }}>
 {a.who[0]}
 </div>
 <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>
 <span style={{ color: 'var(--fg)', fontWeight: 510 }}>{a.who}</span>
 <span style={{ color: 'var(--fg-muted)' }}> {a.what} </span>
 <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{a.target}</span>
 </div>
 <span style={{
 fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-quaternary)',
 whiteSpace: 'nowrap',
 }}>
 {a.when}
 </span>
 </div>
 ))}
 </div>
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
 flexWrap: 'wrap',
 gap: 16,
 }}>
 <span>© 2026 — sthyra</span>
 <span>{orgName} · us-east · {totals.projects} projects</span>
 <span>v0.13 · user role</span>
 </footer>
 </main>
 </div>
 );
}
