import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { LivePulse } from '@/components/live-pulse';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Issue {
 id: string;
 projectId: string;
 title: string;
 status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
 severity: 'low' | 'medium' | 'high' | 'critical';
 kind: string;
 trade?: string;
 createdAt: string;
}

async function fetchIssues(projectId: string, tenantId: string): Promise<Issue[]> {
 try {
 const res = await fetch(`http://127.0.0.1:9091/v1/projects/${projectId}/issues`, {
 headers: { 'x-tenant-id': tenantId, 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return (data.data || []) as Issue[];
 } catch {
 return [];
 }
}

function StatusBadge({ status }: { status: string }) {
 const cls = status === 'resolved' ? 'badge-success' :
 status === 'in_progress' ? 'badge-info' :
 status === 'wont_fix' ? 'badge-neutral' : 'badge-warning';
 return <span className={`badge ${cls}`}><span className="badge-dot" />{status.replace('_', ' ')}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
 const cls = severity === 'critical' || severity === 'high' ? 'badge-danger' :
 severity === 'medium' ? 'badge-warning' : 'badge-neutral';
 return <span className={`badge ${cls}`}>{severity}</span>;
}

export default async function IssuesPage({ params }: { params: { orgId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const projectId = 'prj_demo';
 const issues = await fetchIssues(projectId, tenantId);

 const counts = {
 total: issues.length,
 open: issues.filter(i => i.status === 'open').length,
 inProgress: issues.filter(i => i.status === 'in_progress').length,
 resolved: issues.filter(i => i.status === 'resolved').length,
 high: issues.filter(i => i.severity === 'high' || i.severity === 'critical').length,
 };

 return (
 <div className="app-shell">
 <Sidebar currentOrgId={tenantId} currentPath={`/orgs/${tenantId}/issues`} />

 <main className="main">
 <header className="page-header fade-in">
 <div className="page-header-content">
 <h1 className="page-title">Field Issues</h1>
 <p className="page-subtitle">Punch list, RFIs, and defects across {projectId}</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
 <LivePulse orgId={tenantId} initialCount={counts.total} />
 <span className="tenant-badge">{tenantId}</span>
 <Link href={`/orgs/${tenantId}/issues/new`} className="btn btn-primary">+ New issue</Link>
 </div>
 </header>

 <section className="stats-grid mount-stagger" aria-label="Issue metrics">
 <div className="stat-card">
 <div className="stat-label">Total issues</div>
 <div className="stat-value">{counts.total}</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">Open</div>
 <div className="stat-value">{counts.open}</div>
 <div className="stat-trend">{counts.open > 0 ? 'Needs attention' : 'Clear'}</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">In progress</div>
 <div className="stat-value">{counts.inProgress}</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">High severity</div>
 <div className="stat-value">{counts.high}</div>
 <div className="stat-trend">{counts.high > 0 ? 'Action required' : 'OK'}</div>
 </div>
 </section>

 <section className="section fade-in">
 <div className="section-header">
 <h2 className="section-title">All issues</h2>
 <span className="section-action">{issues.length} items</span>
 </div>

 {issues.length === 0 ? (
 <div className="empty">
 <div className="empty-icon">⚠</div>
 <h3 className="empty-title">No issues yet</h3>
 <p className="empty-description">Issues created in the field will appear here. Track punch list items, RFIs, and defects in one place.</p>
 <button className="btn btn-primary">Create first issue</button>
 </div>
 ) : (
 <table className="data-table">
 <thead>
 <tr>
 <th>Status</th>
 <th>Severity</th>
 <th>Title</th>
 <th>Kind</th>
 <th>Trade</th>
 <th>Created</th>
 </tr>
 </thead>
 <tbody>
 {issues.map((issue) => (
 <tr key={issue.id}>
 <td><StatusBadge status={issue.status} /></td>
 <td><SeverityBadge severity={issue.severity} /></td>
 <td><Link href={`/orgs/${tenantId}/issues/${issue.id}`}>{issue.title}</Link></td>
 <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{issue.kind}</code></td>
 <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{issue.trade ?? '—'}</code></td>
 <td><time style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{new Date(issue.createdAt).toLocaleDateString()}</time></td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </section>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
