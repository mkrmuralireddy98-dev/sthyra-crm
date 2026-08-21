import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

const WORKFLOWS = [
 { id: 'wf_001', name: 'High-severity issue → structural team', trigger: 'issue.created', enabled: true, runs: 12, lastRun: '2h' },
 { id: 'wf_002', name: 'Daily progress report → stakeholders', trigger: 'schedule.daily', enabled: true, runs: 47, lastRun: '14h' },
 { id: 'wf_003', name: 'Milestone overdue → project manager', trigger: 'schedule.daily', enabled: true, runs: 3, lastRun: '6h' },
 { id: 'wf_004', name: 'New capture ready → assign reviewer', trigger: 'capture.ready', enabled: false, runs: 0, lastRun: 'never' },
];

export default async function WorkflowsPage({ params }: { params: { orgId: string } }) {
 const tenantId = params.orgId;

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// workspace · {tenantId}</span>
 </div>
 <h1 className="page-title">
 workflows<span className="page-title-accent">.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520 }}>
 event-driven rules · if-this-then-that · auto-route work to the right person
 </p>
 </div>
 <button className="btn btn-primary">+ new workflow</button>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// total workflows</div>
 <div className="stat-value">{WORKFLOWS.length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// enabled</div>
 <div className="stat-value">{WORKFLOWS.filter(w => w.enabled).length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// runs · 7d</div>
 <div className="stat-value">{WORKFLOWS.reduce((a, w) => a + w.runs, 0)}</div>
 <div className="stat-delta">↑ healthy</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// failed runs</div>
 <div className="stat-value">0</div>
 <div className="stat-delta">✓ all clear</div>
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// all workflows</span>
 </div>

 {WORKFLOWS.length === 0 ? (
 <div className="empty">
 <div className="empty-eyebrow">// no workflows yet</div>
 <h3 className="empty-title">automate the busywork.</h3>
 <p className="empty-description">
 create your first workflow — trigger on issue creation, schedule, or threshold.
 auto-route notifications, assignments, and reports.
 </p>
 <button className="btn btn-primary">create first workflow</button>
 </div>
 ) : (
 <table className="data-table">
 <thead>
 <tr>
 <th>// name</th>
 <th>// trigger</th>
 <th>// status</th>
 <th>// runs</th>
 <th>// last run</th>
 </tr>
 </thead>
 <tbody>
 {WORKFLOWS.map((w) => (
 <tr key={w.id}>
 <td>
 <Link href={`/orgs/${tenantId}/workflows/${w.id}`} style={{ fontWeight: 600 }}>
 {w.name}
 </Link>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 2 }}>{w.id}</div>
 </td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{w.trigger}</td>
 <td>
 <span className={`badge ${w.enabled ? 'badge-success' : 'badge-neutral'}`}>
 <span className="badge-dot" />{w.enabled ? 'enabled' : 'disabled'}
 </span>
 </td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{w.runs}</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)' }}>{w.lastRun}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
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
 <span>workflow service · v0.10</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
