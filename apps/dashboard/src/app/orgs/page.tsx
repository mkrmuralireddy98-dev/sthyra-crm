import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

const ORGS = [
 { id: 'org_a', name: 'Acme Construction', region: 'us-east', plan: 'pro', status: 'active', projects: 12, members: 12, captures: 24, storage: '1.2 GB' },
 { id: 'org_b', name: 'BuildRight Inc', region: 'eu-west', plan: 'enterprise', status: 'active', projects: 47, members: 124, captures: 412, storage: '18.4 GB' },
 { id: 'org_c', name: 'MegaStructures LLC', region: 'us-west', plan: 'starter', status: 'trial', projects: 3, members: 5, captures: 4, storage: '0.1 GB' },
];

export default async function OrgsPage() {
 return (
 <div className="app-shell">
 <TopNav />

 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// organizations · {ORGS.length}</span>
 </div>
 <h1 className="page-title">
 all tenants on<br />
 <span className="page-title-accent">sthyra.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520 }}>
 every workspace on the platform · active and trial tenants · multi-region
 </p>
 </div>
 <Link href="/orgs/new" className="btn btn-primary">
 + new organization
 </Link>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// organizations</div>
 <div className="stat-value">{ORGS.length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// active</div>
 <div className="stat-value">{ORGS.filter(o => o.status === 'active').length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// trial</div>
 <div className="stat-value">{ORGS.filter(o => o.status === 'trial').length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// regions</div>
 <div className="stat-value">{new Set(ORGS.map(o => o.region)).size}</div>
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// all organizations</span>
 </div>

 <div style={{ border: '1px solid var(--line)', overflowX: 'auto' }}>
 <table className="data-table" style={{ border: 'none' }}>
 <thead>
 <tr>
 <th>// organization</th>
 <th>// region</th>
 <th>// plan</th>
 <th>// status</th>
 <th>// projects</th>
 <th>// members</th>
 <th>// captures</th>
 <th>// storage</th>
 </tr>
 </thead>
 <tbody>
 {ORGS.map((o) => (
 <tr key={o.id}>
 <td>
 <Link href={`/orgs/${o.id}`} style={{ fontWeight: 600 }}>
 {o.name}
 </Link>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 2 }}>{o.id}</div>
 </td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{o.region}</td>
 <td>
 <span className={`badge ${o.plan === 'enterprise' ? 'badge-teal' : o.plan === 'pro' ? 'badge-info' : 'badge-neutral'}`}>
 {o.plan}
 </span>
 </td>
 <td>
 <span className={`badge ${o.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
 <span className="badge-dot" />
 {o.status}
 </span>
 </td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{o.projects}</td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{o.members}</td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{o.captures}</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{o.storage}</td>
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
 <span>3 organizations · 3 regions</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
