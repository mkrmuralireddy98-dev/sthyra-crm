import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';
import { listOrgs, type Org } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

const COUNTRY_NAMES: Record<string, string> = {
 US: 'United States', GB: 'United Kingdom', CA: 'Canada',
 IE: 'Ireland', DE: 'Germany', NL: 'Netherlands',
 FR: 'France', ES: 'Spain', IT: 'Italy',
 MX: 'Mexico', BR: 'Brazil', IN: 'India',
 AE: 'United Arab Emirates', SA: 'Saudi Arabia',
 SG: 'Singapore', JP: 'Japan', KR: 'South Korea',
 AU: 'Australia',
};
const FLAGS: Record<string, string> = {
 US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', IE: '🇮🇪', DE: '🇩🇪', NL: '🇳🇱',
 FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', MX: '🇲🇽', BR: '🇧🇷', IN: '🇮🇳',
 AE: '🇦🇪', SA: '🇸🇦', SG: '🇸🇬', JP: '🇯🇵', KR: '🇰🇷', AU: '🇦🇺',
};
const countryLabel = (code: string): string => {
 const name = COUNTRY_NAMES[code] ?? code;
 const flag = FLAGS[code] ?? '🏳';
 return `${flag} ${name}`;
};

// Map admin-service 'region' (which we overloaded as country code) back to display
function adminToCountry(org: Org): string {
 return org.country ?? 'US';
}

export default async function OrgsPage() {
 const orgs = await listOrgs();
 const totalProjects = orgs.length * 12; // mock for now
 const activeOrgs = orgs.filter(o => o.status === 'active').length;
 const trialOrgs = orgs.filter(o => o.status === 'trial').length;
 const countriesCount = new Set(orgs.map(o => adminToCountry(o))).size;

 return (
 <div className="app-shell">
 <TopNav />

 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// organizations · {orgs.length} from admin-service</span>
 </div>
 <h1 className="page-title">
 all tenants on<br />
 <span className="page-title-accent">sthyra.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520 }}>
 every workspace on the platform · fetched from <code style={{ color: 'var(--accent)' }}>admin-service:9100</code>
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
 <div className="stat-value">{orgs.length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// active</div>
 <div className="stat-value">{activeOrgs}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// trial</div>
 <div className="stat-value">{trialOrgs}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// countries</div>
 <div className="stat-value">{countriesCount}</div>
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// all organizations</span>
 </div>

 {orgs.length === 0 ? (
 <div className="empty">
 <div className="empty-eyebrow">// admin-service returned 0</div>
 <h3 className="empty-title">no tenants yet.</h3>
 <p className="empty-description">create your first organization to start tracking projects.</p>
 <Link href="/orgs/new" className="btn btn-primary">+ new organization</Link>
 </div>
 ) : (
 <div style={{ border: '1px solid var(--line)', overflowX: 'auto' }}>
 <table className="data-table" style={{ border: 'none' }}>
 <thead>
 <tr>
 <th>// organization</th>
 <th>// country</th>
 <th>// plan</th>
 <th>// status</th>
 <th>// members</th>
 <th>// created</th>
 </tr>
 </thead>
 <tbody>
 {orgs.map((o) => (
 <tr key={o.id}>
 <td>
 <Link href={`/orgs/${o.id}`} style={{ fontWeight: 600 }}>
 {o.name}
 </Link>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 2 }}>{o.id}</div>
 </td>
 <td style={{ fontSize: 12 }}>{countryLabel(adminToCountry(o))}</td>
 <td>
 <span className={`badge ${o.plan === 'enterprise' ? 'badge-info' : o.plan === 'pro' ? 'badge-success' : 'badge-neutral'}`}>
 {o.plan}
 </span>
 </td>
 <td>
 <span className={`badge ${o.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
 <span className="badge-dot" />
 {o.status}
 </span>
 </td>
 <td style={{ fontVariantNumeric: 'tabular-nums' }}>{o.userCount ?? '—'}</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)' }}>
 {new Date(o.createdAt).toLocaleDateString()}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
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
 <span>{orgs.length} organizations · {countriesCount} countries</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
