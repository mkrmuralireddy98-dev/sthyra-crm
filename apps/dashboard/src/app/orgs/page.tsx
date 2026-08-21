import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const ORGS = [
 { id: 'org_a', name: 'Acme Construction', region: 'us-east', plan: 'pro', status: 'active', projects: 12, members: 28 },
 { id: 'org_b', name: 'BuildRight Inc', region: 'eu-west', plan: 'enterprise', status: 'active', projects: 47, members: 124 },
 { id: 'org_c', name: 'MegaStructures LLC', region: 'us-west', plan: 'starter', status: 'trial', projects: 3, members: 5 },
];

export default async function OrgsPage() {
 const requestId = randomUUID();
 return (
 <div className="app-shell">
 <Sidebar currentPath="/orgs" />
 <main className="main">
 <header className="page-header fade-in">
 <div className="page-header-content">
 <h1 className="page-title">Organizations</h1>
 <p className="page-subtitle">All tenants on the Sthyra CRM platform</p>
 </div>
 <Link href="/orgs/new" className="btn btn-primary">+ New organization</Link>
 </header>

 <section className="stats-grid mount-stagger">
 <div className="stat-card"><div className="stat-label">Organizations</div><div className="stat-value">{ORGS.length}</div></div>
 <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value">{ORGS.filter(o => o.status === 'active').length}</div></div>
 <div className="stat-card"><div className="stat-label">Trial</div><div className="stat-value">{ORGS.filter(o => o.status === 'trial').length}</div></div>
 <div className="stat-card"><div className="stat-label">Regions</div><div className="stat-value">{new Set(ORGS.map(o => o.region)).size}</div></div>
 </section>

 <section className="section fade-in">
 <div className="section-header"><h2 className="section-title">All organizations</h2></div>
 <table className="data-table">
 <thead><tr><th>Name</th><th>Region</th><th>Plan</th><th>Status</th><th>Projects</th><th>Members</th><th></th></tr></thead>
 <tbody>
 {ORGS.map((o) => (
 <tr key={o.id}>
 <td>
 <Link href={`/orgs/${o.id}`} style={{ fontWeight: 590 }}>{o.name}</Link>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-quaternary)', marginTop: 2 }}>{o.id}</div>
 </td>
 <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{o.region}</code></td>
 <td><span className={`badge ${o.plan === 'enterprise' ? 'badge-teal' : o.plan === 'pro' ? 'badge-info' : 'badge-neutral'}`}>{o.plan}</span></td>
 <td><span className={`badge ${o.status === 'active' ? 'badge-success' : 'badge-warning'}`}><span className="badge-dot" />{o.status}</span></td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{o.projects}</td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{o.members}</td>
 <td><Link href={`/orgs/${o.id}/projects`} style={{ color: 'var(--teal-400)', fontSize: 12 }}>View →</Link></td>
 </tr>
 ))}
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
