import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

const PLATFORM_STATS = [
 { label: 'organizations', value: '3' },
 { label: 'projects · all', value: '12' },
 { label: 'captures · 7d', value: '24' },
 { label: 'open issues', value: '54' },
 { label: 'users', value: '141' },
 { label: 'storage', value: '19.7 GB' },
];

export default function AdminPage() {
 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// platform · admin console · global · pro</span>
 </div>
 <h1 className="page-title">
 platform<br />
 <span className="page-title-accent">overview.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520 }}>
 every workspace on sthyra · every project, every user · all in one console
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href="/orgs" className="btn btn-primary">view organizations →</Link>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 {PLATFORM_STATS.map((s) => (
 <div className="stat-cell" key={s.label}>
 <div className="stat-label">// {s.label}</div>
 <div className="stat-value">{s.value}</div>
 </div>
 ))}
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// organizations · 3</span>
 </div>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginBottom: 'var(--space-5)', maxWidth: 540 }}>
 you see <strong style={{ color: 'var(--accent)' }}>every organization</strong> on the platform.
 click an org to drill into its projects, members, captures, and issues.
 </p>

 <div className="bento-grid">
 <Link href="/orgs" className="bento-cell large" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
 <span className="bento-num">// 01 · all orgs</span>
 <div>
 <h3 className="bento-title">Acme Construction</h3>
 <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6 }}>
 12 projects · 12 members · 🇺🇸 United States · pro
 </p>
 </div>
 <div className="bento-viz">
 <div style={{ fontFamily: 'var(--font-display)', fontSize: 80, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.04em' }}>
 ◐
 </div>
 </div>
 </Link>

 <Link href="/orgs" className="bento-cell wide" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
 <span className="bento-num">// 02</span>
 <div>
 <h3 className="bento-title">BuildRight Inc</h3>
 <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6 }}>
 47 projects · 124 members · 🇬🇧 United Kingdom · enterprise
 </p>
 </div>
 <div className="bento-viz">
 <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.04em' }}>
 ◑
 </div>
 </div>
 </Link>

 <Link href="/orgs" className="bento-cell wide" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
 <span className="bento-num">// 03</span>
 <div>
 <h3 className="bento-title">MegaStructures LLC</h3>
 <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6 }}>
 3 projects · 5 members · 🇺🇸 United States · starter
 </p>
 </div>
 <div className="bento-viz">
 <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.04em' }}>
 ◓
 </div>
 </div>
 </Link>
 </div>
 </section>

 <section style={{ padding: 'var(--space-7) 0', borderTop: '1px solid var(--line)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// platform services · 13/13</span>
 </div>

 <table className="data-table">
 <thead>
 <tr>
 <th>// service</th>
 <th>// port</th>
 <th>// uptime</th>
 <th>// health</th>
 </tr>
 </thead>
 <tbody>
 {[
 { name: 'capture', port: '9090', uptime: '99.99%' },
 { name: 'field', port: '9091', uptime: '99.97%' },
 { name: 'bim-viewer', port: '9092', uptime: '99.98%' },
 { name: 'ai-copilot', port: '9093', uptime: '99.92%' },
 { name: 'mobile-bff', port: '9094', uptime: '99.99%' },
 { name: 'track', port: '9095', uptime: '99.99%' },
 { name: 'report', port: '9096', uptime: '99.95%' },
 { name: 'workflow', port: '9097', uptime: '99.99%' },
 { name: 'integration', port: '9098', uptime: '99.98%' },
 { name: 'dashboard', port: '9099', uptime: '99.99%' },
 { name: 'admin', port: '9100', uptime: '99.99%' },
 ].map((s) => (
 <tr key={s.name}>
 <td style={{ fontWeight: 600 }}>{s.name}</td>
 <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{s.port}</td>
 <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>{s.uptime}</td>
 <td><span className="badge badge-success"><span className="badge-dot" />healthy</span></td>
 </tr>
 ))}
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
 <span>platform · admin · 3 orgs</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
