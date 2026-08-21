import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
 { id: 'procore', name: 'Procore', desc: 'Sync projects, RFIs, submittals', color: '#FF6E00' },
 { id: 'bim360', name: 'Autodesk BIM 360', desc: 'Sync BIM models, drawings, issues', color: '#0696D7' },
 { id: 'plangrid', name: 'PlanGrid', desc: 'Sync drawings, sheets, markups', color: '#3B7BFB' },
 { id: 'acc', name: 'Autodesk Construction Cloud', desc: 'Sync docs, models, issues', color: '#000000' },
 { id: 'box', name: 'Box', desc: 'Sync drawings and documents', color: '#0061D5' },
];

export default async function IntegrationsPage({ params }: { params: { orgId: string } }) {
 const tenantId = params.orgId;

 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// workspace · {tenantId}</span>
 </div>
 <h1 className="page-title">
 integrations<span className="page-title-accent">.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520 }}>
 connect sthyra to your existing construction tools · {PROVIDERS.length} providers available
 </p>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// connected</div>
 <div className="stat-value">0</div>
 <div className="stat-delta">awaiting setup</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// available</div>
 <div className="stat-value">{PROVIDERS.length}</div>
 <div className="stat-delta">providers</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// sync pending</div>
 <div className="stat-value">0</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// errors</div>
 <div className="stat-value">0</div>
 <div className="stat-delta">✓ all clear</div>
 </div>
 </div>

 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// available providers</span>
 </div>

 <div className="bento-grid">
 {PROVIDERS.map((p, i) => (
 <div
 key={p.id}
 className={`bento-cell ${i === 0 || i === 2 ? 'wide' : 'wide'}`}
 style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
 >
 <span className="bento-num">// 0{i + 1}</span>
 <div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
 <div style={{
 width: 40, height: 40,
 border: `1px solid ${p.color}`,
 color: p.color,
 background: `${p.color}11`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
 }}>
 {p.name[0]}
 </div>
 <div>
 <h3 className="bento-title">{p.name}</h3>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-quaternary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
 not connected
 </div>
 </div>
 </div>
 <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 'var(--space-3)' }}>
 {p.desc}
 </p>
 </div>
 <div className="bento-viz">
 <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 11, width: '100%' }}>
 + connect
 </button>
 </div>
 </div>
 ))}
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
 <span>{PROVIDERS.length} providers available</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
