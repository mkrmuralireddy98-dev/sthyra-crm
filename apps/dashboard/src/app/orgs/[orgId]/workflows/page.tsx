import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Workflow {
 id: string;
 name: string;
 enabled: boolean;
 triggerType: string;
 lastRunAt: string | null;
}

async function fetchWorkflows(orgId: string): Promise<Workflow[]> {
 try {
 const res = await fetch(`http://127.0.0.1:9097/v1/orgs/${orgId}/workflows`, {
 headers: { 'x-tenant-id': orgId, 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return (data.data || []) as Workflow[];
 } catch {
 return [];
 }
}

export default async function WorkflowsPage({ params }: { params: { orgId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const workflows = await fetchWorkflows(tenantId);

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <header className="page-header">
 <div className="page-header-content">
 <h1 className="page-title">Workflows</h1>
 <p className="page-subtitle">Automated rules triggered by events, schedules, or thresholds</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <span className="tenant-badge">{tenantId}</span>
 <button className="btn btn-primary">+ New workflow</button>
 </div>
 </header>

 <section className="stats-grid">
 <div className="stat-card"><div className="stat-label">Total workflows</div><div className="stat-value">{workflows.length}</div></div>
 <div className="stat-card"><div className="stat-label">Enabled</div><div className="stat-value">{workflows.filter(w => w.enabled).length}</div></div>
 <div className="stat-card"><div className="stat-label">Triggered today</div><div className="stat-value">0</div></div>
 <div className="stat-card"><div className="stat-label">Failed runs</div><div className="stat-value">0</div><div className="stat-trend">All clear</div></div>
 </section>

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">All workflows</h2>
 </div>

 {workflows.length === 0 ? (
 <div className="empty">
 <div className="empty-icon">↯</div>
 <h3 className="empty-title">No workflows configured</h3>
 <p className="empty-description">
 Create your first workflow to automate issue triage, notifications, and field operations.
 Workflows trigger on events (e.g. issue created), schedules (e.g. daily report), or thresholds (e.g. milestone overdue).
 </p>
 <button className="btn btn-primary">Create first workflow</button>
 </div>
 ) : (
 <table className="data-table">
 <thead><tr><th>Name</th><th>Trigger</th><th>Status</th><th>Last run</th></tr></thead>
 <tbody>
 {workflows.map((w) => (
 <tr key={w.id}>
 <td><Link href={`/orgs/${tenantId}/workflows/${w.id}`}>{w.name}</Link></td>
 <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{w.triggerType}</code></td>
 <td><span className={`badge ${w.enabled ? 'badge-success' : 'badge-neutral'}`}>{w.enabled ? 'enabled' : 'disabled'}</span></td>
 <td><time style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{w.lastRunAt ? new Date(w.lastRunAt).toLocaleString() : 'never'}</time></td>
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
