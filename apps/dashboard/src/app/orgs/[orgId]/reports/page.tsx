import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const REPORTS = [
 { kind: 'daily', title: 'Daily Report', description: 'Captures processed, issues raised, milestones hit', icon: '◐', port: 9096 },
 { kind: 'weekly', title: 'Weekly Report', description: 'Velocity, blockers, key decisions', icon: '◑', port: 9096 },
 { kind: 'deep-dive', title: 'Project Deep Dive', description: 'Comprehensive analysis with charts', icon: '◓', port: 9096 },
 { kind: 'portfolio', title: 'Portfolio Summary', description: 'All projects at a glance', icon: '●', port: 9096 },
];

export default async function ReportsPage({ params }: { params: { orgId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const today = new Date().toISOString().slice(0, 10);

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <header className="page-header">
 <div className="page-header-content">
 <h1 className="page-title">Reports</h1>
 <p className="page-subtitle">Automated reports across projects, captures, and issues</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <span className="tenant-badge">{tenantId}</span>
 </div>
 </header>

 <section className="stats-grid">
 <div className="stat-card"><div className="stat-label">Reports generated</div><div className="stat-value">24</div><div className="stat-trend">Last 30 days</div></div>
 <div className="stat-card"><div className="stat-label">Subscribers</div><div className="stat-value">12</div><div className="stat-trend">Active users</div></div>
 <div className="stat-card"><div className="stat-label">Avg delivery</div><div className="stat-value">2.3s</div><div className="stat-trend">P95 latency</div></div>
 <div className="stat-card"><div className="stat-label">Storage</div><div className="stat-value">42MB</div><div className="stat-trend">PDF + CSV exports</div></div>
 </section>

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">Report types</h2>
 </div>
 <div className="project-grid">
 {REPORTS.map((r) => (
 <Link key={r.kind} href={`/orgs/${tenantId}/reports/${r.kind}`} className="project-card">
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
 <div style={{
 width: 40, height: 40, borderRadius: 'var(--radius-md)',
 background: 'var(--teal-50)', color: 'var(--teal-400)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 20, fontWeight: 700,
 border: '1px solid rgba(0,184,148,0.25)',
 }}>{r.icon}</div>
 <div style={{ flex: 1 }}>
 <div className="project-name">{r.title}</div>
 <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.description}</div>
 </div>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)' }}>
 <span className="badge badge-teal">Daily · Weekly · On-demand</span>
 <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Generate →</span>
 </div>
 </Link>
 ))}
 </div>
 </section>

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">Recent reports</h2>
 </div>
 <table className="data-table">
 <thead><tr><th>Report</th><th>Period</th><th>Generated</th><th>Status</th></tr></thead>
 <tbody>
 <tr>
 <td><Link href={`/orgs/${tenantId}/reports/daily?date=${today}`}>Daily Report</Link></td>
 <td><time>{today}</time></td>
 <td><time style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{new Date().toLocaleTimeString()}</time></td>
 <td><span className="badge badge-success"><span className="badge-dot" />ready</span></td>
 </tr>
 <tr>
 <td><Link href={`/orgs/${tenantId}/reports/weekly`}>Weekly Summary</Link></td>
 <td>This week</td>
 <td><time style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>3 hours ago</time></td>
 <td><span className="badge badge-success"><span className="badge-dot" />delivered</span></td>
 </tr>
 </tbody>
 </table>
 </section>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
