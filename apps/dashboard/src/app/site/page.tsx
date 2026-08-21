import Link from 'next/link';

export const metadata = {
 title: 'Sthyra CRM — Visual Intelligence for the Built World',
 description: 'Continuous reality capture fused to BIM, with a Copilot for the field.',
};

export default function MarketingSite() {
 return (
 <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
 {/* Top nav */}
 <nav style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 padding: '16px 32px',
 borderBottom: '1px solid var(--border-subtle)',
 position: 'sticky',
 top: 0,
 background: 'rgba(8, 9, 10, 0.8)',
 backdropFilter: 'blur(12px)',
 zIndex: 10,
 }}>
 <Link href="/site" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <span className="sidebar-brand-mark" style={{ width: 26, height: 26, fontSize: 12 }}>S</span>
 <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>Sthyra CRM</span>
 </Link>
 <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
 <a href="#features">Features</a>
 <a href="#pricing">Pricing</a>
 <a href="#docs">Docs</a>
 <a href="#changelog">Changelog</a>
 </div>
 <div style={{ display: 'flex', gap: 8 }}>
 <Link href="/signin" className="btn btn-ghost">Sign in</Link>
 <Link href="/welcome" className="btn btn-primary">Get started</Link>
 </div>
 </nav>

 {/* Hero */}
 <section style={{
 padding: '96px 32px 64px',
 textAlign: 'center',
 position: 'relative',
 overflow: 'hidden',
 }}>
 <div style={{
 position: 'absolute',
 inset: 0,
 background: 'radial-gradient(circle at 50% 0%, rgba(0, 184, 148, 0.15), transparent 50%)',
 pointerEvents: 'none',
 }} />
 <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto' }}>
 <div className="badge badge-teal fade-in" style={{ marginBottom: 24, fontSize: 11 }}>
 <span className="badge-dot" /> Now in beta · 13 product features shipped
 </div>
 <h1 className="fade-in" style={{
 fontSize: 64,
 fontWeight: 510,
 letterSpacing: '-2.5px',
 lineHeight: 1.05,
 marginBottom: 20,
 background: 'linear-gradient(180deg, #f7f8f8 0%, #8a8f98 120%)',
 WebkitBackgroundClip: 'text',
 WebkitTextFillColor: 'transparent',
 backgroundClip: 'text',
 animationDelay: '60ms',
 }}>
 Visual intelligence<br/>for the built world.
 </h1>
 <p className="fade-in" style={{
 fontSize: 18,
 color: 'var(--text-secondary)',
 maxWidth: 620,
 margin: '0 auto 32px',
 lineHeight: 1.55,
 animationDelay: '120ms',
 }}>
 Sthyra CRM captures 360° walkthroughs, fuses them to BIM, and routes field issues
 to the right people — automatically.
 </p>
 <div className="fade-in" style={{ display: 'flex', gap: 12, justifyContent: 'center', animationDelay: '180ms' }}>
 <Link href="/welcome" className="btn btn-primary" style={{ padding: '12px 20px', fontSize: 14 }}>
 Start free trial →
 </Link>
 <Link href="/site#demo" className="btn btn-ghost" style={{ padding: '12px 20px', fontSize: 14 }}>
 Watch demo
 </Link>
 </div>
 <p style={{ fontSize: 12, color: 'var(--text-quaternary)', marginTop: 16 }}>
 14-day free trial · No credit card required
 </p>
 </div>

 {/* Hero dashboard mock */}
 <div className="fade-in" style={{
 maxWidth: 1080,
 margin: '64px auto 0',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-xl)',
 background: 'var(--bg-panel)',
 boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
 overflow: 'hidden',
 }}>
 <div style={{
 display: 'flex',
 alignItems: 'center',
 gap: 6,
 padding: '10px 14px',
 borderBottom: '1px solid var(--border-subtle)',
 }}>
 <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
 <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F5A524' }} />
 <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--teal-500)' }} />
 <span style={{
 marginLeft: 'auto',
 fontFamily: 'var(--font-mono)',
 fontSize: 11,
 color: 'var(--text-quaternary)',
 }}>localhost:9099/orgs/org_a/issues</span>
 </div>
 <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12, minHeight: 360 }}>
 <aside style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 12 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, marginBottom: 12 }}>
 <span className="sidebar-brand-mark" style={{ width: 22, height: 22, fontSize: 10 }}>S</span>
 <span style={{ fontSize: 13, fontWeight: 600 }}>Sthyra CRM</span>
 </div>
 {['Dashboard', 'Projects', 'Captures', 'Issues', 'Workflows'].map((item, i) => (
 <div key={item} style={{
 padding: '6px 10px',
 borderRadius: 4,
 fontSize: 12,
 color: i === 3 ? 'var(--teal-400)' : 'var(--text-secondary)',
 background: i === 3 ? 'var(--teal-50)' : 'transparent',
 marginBottom: 2,
 }}>{item}</div>
 ))}
 </aside>
 <main style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 14 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
 <div>
 <div style={{ fontSize: 15, fontWeight: 510 }}>Field Issues</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>8 open · 1 critical</div>
 </div>
 <div style={{ display: 'flex', gap: 4 }}>
 <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal-500)', boxShadow: '0 0 0 3px var(--teal-glow)' }} />
 <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Live</span>
 </div>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
 {[{ l: 'Total', v: '8', c: 'var(--text-secondary)' },
 { l: 'Open', v: '8', c: 'var(--amber-500)' },
 { l: 'Critical', v: '1', c: 'var(--red-500)' },
 { l: 'Resolved', v: '0', c: 'var(--green-500)' }].map(s => (
 <div key={s.l} style={{
 padding: 8,
 background: 'var(--bg-panel)',
 borderRadius: 4,
 border: '1px solid var(--border-default)',
 }}>
 <div style={{ fontSize: 9, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.l}</div>
 <div style={{ fontSize: 18, fontWeight: 510, color: s.c, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
 </div>
 ))}
 </div>
 <div style={{ background: 'var(--bg-panel)', borderRadius: 4, border: '1px solid var(--border-default)', padding: 8 }}>
 {['Concrete spalling on Level 3', 'Rebar exposed', 'HVAC misalignment'].map((t, i) => (
 <div key={t} style={{
 display: 'flex',
 alignItems: 'center',
 gap: 8,
 padding: '5px 6px',
 borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none',
 fontSize: 11,
 }}>
 <span className={`badge ${i === 0 ? 'badge-danger' : i === 1 ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 9, padding: '1px 6px' }}>{i === 0 ? 'high' : i === 1 ? 'med' : 'low'}</span>
 <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{t}</span>
 <span style={{ color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>iss_{i}234</span>
 </div>
 ))}
 </div>
 </main>
 </div>
 </div>
 </section>

 {/* Logos */}
 <section style={{
 padding: '48px 32px',
 borderTop: '1px solid var(--border-subtle)',
 borderBottom: '1px solid var(--border-subtle)',
 }}>
 <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: 0.1, marginBottom: 24 }}>
 Trusted by construction teams worldwide
 </p>
 <div style={{ display: 'flex', justifyContent: 'center', gap: 48, opacity: 0.5, flexWrap: 'wrap' }}>
 {['Acme', 'BuildRight', 'MegaStructures', 'Skyline', 'Harbor'].map((n) => (
 <div key={n} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
 {n}
 </div>
 ))}
 </div>
 </section>

 {/* Features */}
 <section id="features" style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
 <div style={{ textAlign: 'center', marginBottom: 64 }}>
 <h2 style={{ fontSize: 36, fontWeight: 510, letterSpacing: '-1px', marginBottom: 12 }}>
 One platform. Every workflow.
 </h2>
 <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto' }}>
 Replace 8 disconnected tools with one connected platform built for the field.
 </p>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
 {[
 { icon: '◉', title: '360° Capture', desc: 'Upload 360° walkthroughs with one tap. Auto-stitched and geo-tagged.' },
 { icon: '▣', title: 'BIM Sync', desc: 'Fuse captures to your BIM model. Track progress element-by-element.' },
 { icon: '⚠', title: 'Field Issues', desc: 'Punch list, RFIs, and defects — all in one place. Auto-routed.' },
 { icon: '↯', title: 'Workflows', desc: 'Automate routing, notifications, and approvals with if-this-then-that rules.' },
 { icon: '◐', title: 'Copilot', desc: 'Ask questions in plain English. Get answers from your project data.' },
 { icon: '⊕', title: 'Integrations', desc: 'Sync with Procore, BIM360, PlanGrid, and your existing tools.' },
 { icon: '▤', title: 'Reports', desc: 'Automated daily, weekly, and portfolio reports delivered to your inbox.' },
 { icon: '◓', title: 'Analytics', desc: 'Real-time dashboards with velocity, blockers, and trend insights.' },
 ].map((f) => (
 <div key={f.title} style={{
 padding: 24,
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-lg)',
 transition: 'all 200ms var(--ease-out)',
 }}>
 <div style={{
 width: 36, height: 36, borderRadius: 'var(--radius-md)',
 background: 'var(--teal-50)', color: 'var(--teal-400)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 18, marginBottom: 12,
 border: '1px solid rgba(0,184,148,0.25)',
 }}>{f.icon}</div>
 <div style={{ fontSize: 15, fontWeight: 590, marginBottom: 6 }}>{f.title}</div>
 <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{f.desc}</div>
 </div>
 ))}
 </div>
 </section>

 {/* CTA */}
 <section style={{ padding: '64px 32px 96px', textAlign: 'center' }}>
 <div style={{
 maxWidth: 600,
 margin: '0 auto',
 padding: 48,
 background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-panel))',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-xl)',
 }}>
 <h2 style={{ fontSize: 28, fontWeight: 510, letterSpacing: '-0.5px', marginBottom: 12 }}>
 Ready to ship faster?
 </h2>
 <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
 Join construction teams saving 10+ hours/week on field-to-office coordination.
 </p>
 <Link href="/welcome" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14 }}>
 Start free trial →
 </Link>
 </div>
 </section>

 {/* Footer */}
 <footer style={{
 padding: '32px',
 borderTop: '1px solid var(--border-subtle)',
 textAlign: 'center',
 color: 'var(--text-quaternary)',
 fontSize: 12,
 }}>
 © 2026 Sthyra CRM · Built with Next.js · MIT License
 </footer>
 </div>
 );
}
