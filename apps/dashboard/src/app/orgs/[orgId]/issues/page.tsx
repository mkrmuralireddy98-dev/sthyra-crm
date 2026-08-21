import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

interface Issue {
 id: string;
 title: string;
 status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
 severity: 'low' | 'medium' | 'high' | 'critical';
 kind: string;
 trade?: string;
 createdAt: string;
}

async function fetchIssues(): Promise<Issue[]> {
 try {
 const res = await fetch('http://127.0.0.1:9091/v1/projects/prj_demo/issues', {
 headers: { 'x-tenant-id': 'org_a', 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return (data.data || []) as Issue[];
 } catch {
 return [];
 }
}

function StatusPill({ status }: { status: string }) {
 const map: Record<string, string> = {
 open: 'badge-warning',
 in_progress: 'badge-info',
 resolved: 'badge-success',
 wont_fix: 'badge-neutral',
 };
 return <span className={`badge ${map[status] || 'badge-neutral'}`}>{status.replace('_', ' ')}</span>;
}

function SeverityPill({ severity }: { severity: string }) {
 const map: Record<string, string> = {
 critical: 'badge-danger',
 high: 'badge-danger',
 medium: 'badge-warning',
 low: 'badge-neutral',
 };
 return <span className={`badge ${map[severity] || 'badge-neutral'}`}>{severity}</span>;
}

export default async function IssuesPage({ params }: { params: { orgId: string } }) {
 const tenantId = params.orgId;
 const issues = await fetchIssues();

 const counts = {
 total: issues.length,
 open: issues.filter(i => i.status === 'open').length,
 inProgress: issues.filter(i => i.status === 'in_progress').length,
 high: issues.filter(i => i.severity === 'high' || i.severity === 'critical').length,
 };

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />

 <main className="app-main">
 <section className="page-mast">
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 04 — field intelligence</span>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <h1 className="page-title">field issues<span className="page-title-accent">.</span></h1>
 <p className="page-subtitle">
 punch list, RFIs, and defects · {counts.total} total · {counts.open} open
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${tenantId}/issues/new`} className="btn btn-primary">
 + new issue
 </Link>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// total</div>
 <div className="stat-value">{counts.total}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// open</div>
 <div className="stat-value">{counts.open}</div>
 {counts.open > 0 && <div className="stat-delta">↑ needs attention</div>}
 </div>
 <div className="stat-cell">
 <div className="stat-label">// in_progress</div>
 <div className="stat-value">{counts.inProgress}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// high severity</div>
 <div className="stat-value">{counts.high}</div>
 {counts.high > 0 ? (
 <div className="stat-delta" style={{ color: '#ff4444' }}>↑ action required</div>
 ) : (
 <div className="stat-delta">✓ clear</div>
 )}
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 0 }}>
 <span className="page-eyebrow-marker" />
 <span>// all issues — {issues.length}</span>
 </div>
 </div>

 {issues.length === 0 ? (
 <div className="empty">
 <div className="empty-eyebrow">// nothing here yet</div>
 <h3 className="empty-title">no issues detected.</h3>
 <p className="empty-description">
 upload a 360° capture or file a manual issue from the field.
 we'll auto-route them to the right team.
 </p>
 <Link href={`/orgs/${tenantId}/issues/new`} className="btn btn-primary">
 + new issue
 </Link>
 </div>
 ) : (
 <table className="data-table">
 <thead>
 <tr>
 <th>// status</th>
 <th>// severity</th>
 <th>// title</th>
 <th>// kind</th>
 <th>// trade</th>
 <th>// created</th>
 </tr>
 </thead>
 <tbody>
 {issues.map((issue) => (
 <tr key={issue.id}>
 <td><StatusPill status={issue.status} /></td>
 <td><SeverityPill severity={issue.severity} /></td>
 <td><Link href={`/orgs/${tenantId}/issues/${issue.id}`}>{issue.title}</Link></td>
 <td>{issue.kind}</td>
 <td>{issue.trade ?? '—'}</td>
 <td>{new Date(issue.createdAt).toLocaleDateString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </section>
 </main>
 </div>
 );
}
