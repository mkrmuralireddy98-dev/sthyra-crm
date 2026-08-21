'use client';

import Link from 'next/link';

export default function MarketingSite() {
 return (
 <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
 {/* Top nav — magazine-style */}
 <nav style={{
 display: 'grid',
 gridTemplateColumns: 'auto 1fr auto',
 alignItems: 'center',
 padding: '0 32px',
 height: 60,
 borderBottom: '1px solid var(--line)',
 background: 'rgba(5,5,5,0.85)',
 backdropFilter: 'blur(20px)',
 position: 'sticky',
 top: 0,
 zIndex: 10,
 }}>
 <Link href="/site" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <span className="sthyra-logo">sthyra</span>
 <span style={{
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 color: 'var(--fg-muted)',
 padding: '2px 6px',
 border: '1px solid var(--line)',
 letterSpacing: '0.1em',
 textTransform: 'uppercase',
 }}>crm</span>
 </Link>

 <nav style={{
 display: 'flex',
 justifyContent: 'center',
 gap: 0,
 }}>
 {[
 { href: '/site', label: 'home' },
 { href: '/site#services', label: 'services' },
 { href: '/site#how', label: 'how it works' },
 { href: '/site#pricing', label: 'pricing' },
 { href: '/site#changelog', label: 'changelog' },
 { href: '/docs', label: 'docs' },
 ].map((item, i) => (
 <Link
 key={item.href}
 href={item.href}
 style={{
 padding: '0 16px',
 height: 60,
 display: 'inline-flex',
 alignItems: 'center',
 fontFamily: 'var(--font-mono)',
 fontSize: 11,
 letterSpacing: '0.1em',
 textTransform: 'uppercase',
 color: 'var(--fg-muted)',
 textDecoration: 'none',
 borderLeft: '1px solid var(--line)',
 borderRight: i === 5 ? '1px solid var(--line)' : 'none',
 position: 'relative',
 }}
 onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
 onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-muted)')}
 >
 {item.label}
 </Link>
 ))}
 </nav>

 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 <Link href="/signin" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
 sign in
 </Link>
 <Link href="/welcome" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 11 }}>
 start free →
 </Link>
 </div>
 </nav>

 {/* ─── HERO ──────────────────────────────────────────────── */}
 <section className="hero-grid" id="home">
 <div className="hero-bg-grid" />

 <div className="hero-blob">
 <BlobSVG />
 </div>

 <div className="hero-content">
 <div className="hero-eyebrow">
 <span>// Sthyra CRM — v0.13 · 13/13 services shipped</span>
 </div>

 <h1 className="hero-headline">
 visual<br />
 intelligence<br />
 for the<br />
 <span className="glitch" data-text="built world.">built world.</span>
 </h1>

 <p style={{
 fontSize: 18,
 color: 'var(--fg-muted)',
 maxWidth: 640,
 lineHeight: 1.6,
 marginTop: 'var(--space-5)',
 }}>
 sthyra captures 360° walkthroughs, fuses them to BIM, and routes field
 issues to the right people — automatically.
 </p>

 <div style={{ display: 'flex', gap: 12, marginTop: 'var(--space-6)' }}>
 <Link href="/welcome" className="btn btn-primary" style={{ padding: '14px 24px' }}>
 start free trial →
 </Link>
 <Link href="#services" className="btn btn-ghost" style={{ padding: '14px 24px' }}>
 see all services
 </Link>
 </div>

 <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-7)', flexWrap: 'wrap' }}>
 {[
 { label: '// projects', value: '12' },
 { label: '// captures', value: '24' },
 { label: '// uptime', value: '99.97%' },
 { label: '// team', value: '5' },
 ].map((m) => (
 <div key={m.label}>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{m.label}</div>
 <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em', marginTop: 4 }}>{m.value}</div>
 </div>
 ))}
 </div>
 </div>
 </section>

 <Marquee />

 {/* ─── SERVICES ─────────────────────────────────────────── */}
 <section id="services" style={{ padding: 'var(--space-9) 0', maxWidth: 1200, margin: '0 auto' }}>
 <div className="page-mast" style={{ borderBottom: 'none' }}>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 01 — the services</span>
 </div>
 <h2 className="page-title">
 thirteen products.<br />
 <span className="page-title-accent">one workspace.</span>
 </h2>
 <p className="page-subtitle">
 replace eight disconnected tools with one connected platform
 built for the field — every job site, every trade, every team.
 </p>
 </div>

 <div className="bento-grid">
 {SERVICES.map((s, i) => (
 <Link key={s.slug} href={s.href} className={`bento-cell ${s.size}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
 <span className="bento-num">// {String(i + 1).padStart(2, '0')}</span>
 <div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
 {s.tag}
 </div>
 <h3 className="bento-title">{s.name}</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
 {s.tagline}
 </p>
 </div>
 <div className="bento-viz">
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: s.size === 'large' ? 96 : s.size === 'tall' ? 80 : 56,
 fontWeight: 700,
 color: 'var(--accent)',
 letterSpacing: '-0.04em',
 lineHeight: 1,
 }}>
 {s.glyph}
 </div>
 </div>
 </Link>
 ))}
 </div>
 </section>

 {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
 <section id="how" style={{ padding: 'var(--space-9) 0', maxWidth: 1200, margin: '0 auto' }}>
 <div className="page-mast" style={{ borderBottom: 'none' }}>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 02 — how it works</span>
 </div>
 <h2 className="page-title">
 capture. fuse. route.<br />
 <span className="page-title-accent">done.</span>
 </h2>
 </div>

 {STEPS.map((step, i) => (
 <div key={i} className={`feature-row ${i % 2 === 1 ? 'feature-row-reverse' : ''} mount-stagger`}>
 <div>
 <div className="feature-content-num">// 0{i + 1} — {step.eyebrow}</div>
 <h2 className="feature-content-title">{step.title}</h2>
 <p className="feature-content-text">{step.text}</p>
 </div>
 <div className="feature-visual">
 <div style={{
 fontFamily: 'var(--font-mono)',
 fontSize: 11,
 color: 'var(--fg-muted)',
 letterSpacing: '0.1em',
 position: 'absolute',
 top: 12,
 left: 12,
 }}>// step 0{i + 1}</div>
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 64,
 fontWeight: 700,
 color: 'var(--accent)',
 letterSpacing: '-0.04em',
 }}>
 {step.glyph}
 </div>
 </div>
 </div>
 ))}
 </section>

 {/* ─── PRICING ────────────────────────────────────────────── */}
 <section id="pricing" style={{ padding: 'var(--space-9) 0', maxWidth: 1200, margin: '0 auto' }}>
 <div className="page-mast" style={{ borderBottom: 'none' }}>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 03 — pricing</span>
 </div>
 <h2 className="page-title">
 pick a <span className="page-title-accent">plan.</span>
 </h2>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
 {PLANS.map((p) => (
 <div key={p.name} style={{ background: 'var(--bg-page)', padding: 'var(--space-6)', position: 'relative' }}>
 {p.featured && (
 <div style={{
 position: 'absolute',
 top: 16,
 right: 16,
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 color: '#000',
 background: 'var(--accent)',
 padding: '2px 8px',
 letterSpacing: '0.1em',
 textTransform: 'uppercase',
 }}>
 popular
 </div>
 )}
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
 // {p.name}
 </div>
 <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', marginBottom: 'var(--space-2)' }}>
 {p.price}
 </div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginBottom: 'var(--space-5)' }}>
 {p.period}
 </div>
 <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
 {p.features.map((f) => (
 <li key={f} style={{
 padding: '8px 0',
 borderBottom: '1px solid var(--line)',
 fontSize: 13,
 color: 'var(--fg)',
 display: 'flex',
 alignItems: 'center',
 gap: 8,
 }}>
 <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>//</span>
 {f}
 </li>
 ))}
 </ul>
 <Link href="/welcome" className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`} style={{ marginTop: 'var(--space-5)', width: '100%', justifyContent: 'center' }}>
 start {p.name}
 </Link>
 </div>
 ))}
 </div>
 </section>

 {/* ─── CHANGELOG ─────────────────────────────────────────── */}
 <section id="changelog" style={{ padding: 'var(--space-9) 0', maxWidth: 1200, margin: '0 auto' }}>
 <div className="page-mast" style={{ borderBottom: 'none' }}>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 04 — changelog</span>
 </div>
 <h2 className="page-title">
 what <span className="page-title-accent">shipped.</span>
 </h2>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
 {CHANGELOG.map((entry, i) => (
 <div key={i} style={{ background: 'var(--bg-page)', padding: 'var(--space-5)' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-2)' }}>
 <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
 v{entry.version}
 </span>
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.1em' }}>
 {entry.date}
 </span>
 </div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)' }}>
 {entry.title}
 </div>
 <ul style={{ marginTop: 'var(--space-3)', paddingLeft: 'var(--space-5)' }}>
 {entry.items.map((item, j) => (
 <li key={j} style={{ fontSize: 13, color: 'var(--fg-muted)', padding: '4px 0', listStyle: 'none' }}>
 <span style={{ color: 'var(--accent)', marginRight: 8 }}>+</span>{item}
 </li>
 ))}
 </ul>
 </div>
 ))}
 </div>
 </section>

 {/* ─── CTA ───────────────────────────────────────────────────── */}
 <section style={{
 padding: 'var(--space-9) 0',
 borderTop: '1px solid var(--line)',
 }}>
 <div style={{ maxWidth: 800 }}>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// get started</span>
 </div>
 <h2 className="page-title" style={{ fontSize: 'clamp(48px, 7vw, 120px)' }}>
 ready to <span className="page-title-accent">ship faster?</span>
 </h2>
 <p style={{ fontSize: 16, color: 'var(--fg-muted)', margin: 'var(--space-4) 0 var(--space-6)', maxWidth: 480 }}>
 join construction teams saving 10+ hours/week on field-to-office coordination.
 </p>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href="/welcome" className="btn btn-primary" style={{ padding: '14px 24px' }}>
 start free trial →
 </Link>
 <Link href="/signin" className="btn btn-ghost" style={{ padding: '14px 24px' }}>
 have an account?
 </Link>
 </div>
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
 flexWrap: 'wrap',
 gap: 16,
 }}>
 <span>© 2026 — sthyra</span>
 <span>built in san francisco · MIT</span>
 <span>v0.13 · 13/13 services</span>
 </footer>
 </div>
 );
}

function BlobSVG() {
 return (
 <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
 <defs>
 <radialGradient id="blob-grad" cx="50%" cy="50%" r="50%">
 <stop offset="0%" stopColor="#c8ff00" stopOpacity="0.9" />
 <stop offset="50%" stopColor="#c8ff00" stopOpacity="0.4" />
 <stop offset="100%" stopColor="#c8ff00" stopOpacity="0" />
 </radialGradient>
 <filter id="blur"><feGaussianBlur stdDeviation="20" /></filter>
 </defs>
 <g filter="url(#blur)">
 <ellipse cx="120" cy="140" rx="80" ry="100" fill="url(#blob-grad)" />
 <ellipse cx="280" cy="180" rx="90" ry="110" fill="url(#blob-grad)" />
 <ellipse cx="200" cy="280" rx="100" ry="80" fill="url(#blob-grad)" />
 </g>
 </svg>
 );
}

function Marquee() {
 const items = [
 { label: 'live', value: '8 issues detected', accent: true },
 { label: 'projects', value: '12 active' },
 { label: 'captures', value: '24 uploaded this week' },
 { label: 'storage', value: '1.2 GB / 50 GB' },
 { label: 'api', value: '99.97% uptime' },
 { label: 'build', value: '13 / 13 services healthy' },
 { label: 'team', value: '5 online' },
 ];
 return (
 <div className="marquee">
 <div className="marquee-track">
 {[...items, ...items].map((item, i) => (
 <div key={i} className="marquee-item">
 {item.accent && <span className="marquee-dot" />}
 <span>{item.label}</span>
 <span style={{ color: 'var(--accent)' }}>{item.value}</span>
 </div>
 ))}
 </div>
 </div>
 );
}

const SERVICES = [
 { slug: 'capture', name: 'capture', tag: '01 · reality', tagline: 'upload 360° walkthroughs · 4hr stitch · geo-tagged automatically', glyph: '◐', size: 'large', href: '#' },
 { slug: 'field', name: 'field issues', tag: '02 · field', tagline: 'punch list · RFIs · defects · routing', glyph: '⚠', size: 'wide', href: '#' },
 { slug: 'bim', name: 'bim sync', tag: '03 · bim', tagline: 'IFC → progress, element by element', glyph: '▣', size: 'wide', href: '#' },
 { slug: 'projects', name: 'projects', tag: '04 · delivery', tagline: 'milestones · status · timeline', glyph: '◇', size: 'tall', href: '#' },
 { slug: 'workflows', name: 'workflows', tag: '05 · automation', tagline: 'event-driven rules · if-this-then-that', glyph: '↯', size: 'wide', href: '#' },
 { slug: 'copilot', name: 'copilot', tag: '06 · ai', tagline: 'ask in plain english · answers from project data', glyph: '◆', size: 'wide', href: '#' },
 { slug: 'integrations', name: 'integrations', tag: '07 · external', tagline: 'procore · BIM360 · plan grid · acc · box', glyph: '⊕', size: 'wide', href: '#' },
 { slug: 'reports', name: 'reports', tag: '08 · analytics', tagline: 'daily · weekly · portfolio · delivered', glyph: '▤', size: 'wide', href: '#' },
 { slug: 'admin', name: 'admin', tag: '09 · platform', tagline: 'cross-tenant ops · audit · feature flags', glyph: '◓', size: 'large', href: '#' },
 { slug: 'mobile', name: 'mobile bff', tag: '10 · mobile', tagline: 'iOS · android · JWT · push · geofence', glyph: '◑', size: 'wide', href: '#' },
 { slug: 'org', name: 'org service', tag: '11 · identity', tagline: 'orgs · regions · plans · metadata', glyph: '◒', size: 'wide', href: '#' },
 { slug: 'user', name: 'user service', tag: '12 · users', tagline: 'provisioning · roles · sessions', glyph: '◐', size: 'wide', href: '#' },
 { slug: 'membership', name: 'membership', tag: '13 · access', tagline: 'user ↔ org mapping · RBAC', glyph: '◔', size: 'wide', href: '#' },
];

const STEPS = [
 { eyebrow: 'capture', title: 'upload the walkthrough.', text: 'drop your 360° video. we handle the stitching, geo-tagging, and BIM alignment. no special hardware.', glyph: '◐' },
 { eyebrow: 'fuse', title: 'see it on the model.', text: 'every capture pins to its BIM element. check progress without leaving the page. column 3-B, level 4, day 12.', glyph: '▣' },
 { eyebrow: 'route', title: 'issues find their team.', text: 'spotted something? raise it in the field. workflow auto-assigns to the right person based on trade, severity, and project state.', glyph: '↯' },
 { eyebrow: 'report', title: 'weekly summary, on schedule.', text: 'every monday morning your stakeholders get a generated report — blockers, velocity, decisions needed.', glyph: '▤' },
];

const PLANS = [
 { name: 'starter', price: 'free', period: '14-day trial · 1 project', features: ['1 project', '5 team members', '5GB storage', 'Community support'], featured: false },
 { name: 'pro', price: '$49', period: 'per user / month · billed annually', features: ['Unlimited projects', 'Unlimited team members', '500GB storage', 'AI Copilot', 'Priority support', 'SLA: 99.9%'], featured: true },
 { name: 'enterprise', price: 'custom', period: 'volume + SSO + dedicated', features: ['Everything in pro', 'SSO / SAML', 'Dedicated infra', 'Custom integrations', 'FedRAMP', 'Dedicated CSM'], featured: false },
];

const CHANGELOG = [
 {
 version: '0.13',
 date: '2026-08-20',
 title: 'admin service — cross-tenant operations console',
 items: [
 'tenants · users · audit · feature flags · system health',
 '29 tests passing, RFC 7807 errors, idempotency keys',
 'wired to docker-compose on port 9100',
 ],
 },
 {
 version: '0.12',
 date: '2026-08-19',
 title: 'dashboard service + next.js 14 frontend',
 items: [
 'Linear-inspired dark theme · sidebar · 14 routes',
 'command palette (⌘K) · keyboard shortcuts · toasts',
 'panorama viewer (pannellum) · BIM viewer (three.js)',
 ],
 },
 {
 version: '0.10',
 date: '2026-08-17',
 title: 'workflow automation',
 items: [
 'event-driven rules engine · if-this-then-that',
 '8 built-in workflow templates',
 ],
 },
 {
 version: '0.08',
 date: '2026-08-17',
 title: 'track service — milestones + variance',
 items: [
 'milestones · progress tracking · variance reports',
 'detects cycle conditions · state machine',
 ],
 },
];
