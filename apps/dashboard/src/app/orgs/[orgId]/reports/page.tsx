import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

const REPORTS = [
 { kind: 'daily', title: 'Daily Report', desc: 'captures processed, issues raised, milestones hit', icon: '◐', count: '24 this month' },
 { kind: 'weekly', title: 'Weekly Report', desc: 'velocity, blockers, key decisions', icon: '◑', count: '6 this quarter' },
 { kind: 'deep-dive', title: 'Project Deep Dive', desc: 'comprehensive analysis with charts', icon: '◓', count: '12 generated' },
 { kind: 'portfolio', title: 'Portfolio Summary', desc: 'all projects at a glance', icon: '●', count: '3 monthly' },
];

export default async function ReportsPage({ params }: { params: { orgId: string } }) {
 const tenantId = params.orgId;

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <section className="page-mast">
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// workspace · {tenantId}</span>
 </div>
 <h1 className="page-title">
 reports<span className="page-title-accent">.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520 }}>
 automated reports across projects, captures, and issues · delivered to stakeholders
 </p>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// reports · 30d</div>
 <div className="stat-value">24</div>
 <div className="stat-delta">↑ +3 this week</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// subscribers</div>
 <div className="stat-value">12</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// avg delivery</div>
 <div className="stat-value">2.3s</div>
 <div className="stat-delta">p95 latency</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// storage</div>
 <div className="stat-value">42MB</div>
 <div className="stat-delta">PDF + CSV exports</div>
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// report types</span>
 </div>

 <div className="bento-grid">
 {REPORTS.map((r, i) => (
 <Link
 key={r.kind}
 href={`/orgs/${tenantId}/reports/${r.kind}`}
 className="bento-cell wide"
 style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
 >
 <span className="bento-num">// 0{i + 1} · {r.kind}</span>
 <div>
 <h3 className="bento-title">{r.title}</h3>
 <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6, lineHeight: 1.5 }}>{r.desc}</p>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginTop: 8, letterSpacing: '0.05em' }}>
 // {r.count}
 </div>
 </div>
 <div className="bento-viz">
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 56,
 fontWeight: 700,
 color: 'var(--accent)',
 letterSpacing: '-0.04em',
 lineHeight: 1,
 }}>
 {r.icon}
 </div>
 </div>
 </Link>
 ))}
 </div>
 </section>

 <section style={{ padding: 'var(--space-7) 0', borderTop: '1px solid var(--line)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// recent reports</span>
 </div>
 <table className="data-table">
 <thead>
 <tr>
 <th>// report</th>
 <th>// period</th>
 <th>// generated</th>
 <th>// status</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td><Link href={`/orgs/${tenantId}/reports/daily`}>Daily Report</Link></td>
 <td>{new Date().toISOString().slice(0, 10)}</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)' }}>{new Date().toLocaleTimeString()}</td>
 <td><span className="badge badge-success"><span className="badge-dot" />ready</span></td>
 </tr>
 <tr>
 <td><Link href={`/orgs/${tenantId}/reports/weekly`}>Weekly Summary</Link></td>
 <td>this week</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)' }}>3 hours ago</td>
 <td><span className="badge badge-success"><span className="badge-dot" />delivered</span></td>
 </tr>
 </tbody>
 </table>
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
 <span>report service · v0.9</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
