import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

async function fetchStats() {
 try {
 const res = await fetch('http://127.0.0.1:9091/v1/projects/prj_demo/issues', {
 headers: { 'x-tenant-id': 'org_a', 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return { issues: 0, open: 0, high: 0 };
 const data = await res.json();
 const items = data.data || [];
 return {
 issues: items.length,
 open: items.filter((i: any) => i.status === 'open').length,
 high: items.filter((i: any) => i.severity === 'high' || i.severity === 'critical').length,
 };
 } catch {
 return { issues: 0, open: 0, high: 0 };
 }
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
 <filter id="blur">
 <feGaussianBlur stdDeviation="20" />
 </filter>
 </defs>
 <g filter="url(#blur)">
 <ellipse cx="120" cy="140" rx="80" ry="100" fill="url(#blob-grad)" />
 <ellipse cx="280" cy="180" rx="90" ry="110" fill="url(#blob-grad)" />
 <ellipse cx="200" cy="280" rx="100" ry="80" fill="url(#blob-grad)" />
 <ellipse cx="150" cy="240" rx="60" ry="70" fill="url(#blob-grad)" />
 </g>
 </svg>
 );
}

export default async function Home() {
 const stats = await fetchStats();

 return (
 <div className="app-shell">
 <TopNav currentOrgId="org_a" />

 <main className="app-main">
 {/* ─── HERO ──────────────────────────────────────────────── */}
 <section className="hero-grid">
 <div className="hero-bg-grid" />

 <div className="hero-blob">
 <BlobSVG />
 </div>

 <div className="hero-content">
 <div className="hero-eyebrow">
 <span>// Sthyra CRM — v0.13</span>
 </div>

 <h1 className="hero-headline">
 visual<br />
 intelligence<br />
 for the<br />
 <span className="glitch" data-text="built world.">built world.</span>
 </h1>

 <div className="hero-meta">
 <div className="hero-meta-item">
 <span className="hero-meta-label">// projects</span>
 <span className="hero-meta-value">12</span>
 </div>
 <div className="hero-meta-item">
 <span className="hero-meta-label">// captures</span>
 <span className="hero-meta-value">24</span>
 </div>
 <div className="hero-meta-item">
 <span className="hero-meta-label">// open issues</span>
 <span className="hero-meta-value hero-meta-value-accent">{stats.open}</span>
 </div>
 <div className="hero-meta-item">
 <span className="hero-meta-label">// build</span>
 <span className="hero-meta-value">13/13</span>
 </div>
 </div>
 </div>
 </section>

 <LiveMarquee />

 {/* ─── FEATURE BLOCKS — editorial 2-column ────────────── */}
 <section style={{ padding: 'var(--space-9) 0', maxWidth: 1200, margin: '0 auto' }}>

 {/* Block 01 */}
 <div className="feature-row mount-stagger">
 <div>
 <div className="feature-content-num">// 01 — capture</div>
 <h2 className="feature-content-title">walkthrough → model in 4 hours.</h2>
 <p className="feature-content-text">
 Upload a 360° walkthrough. We fuse it to your BIM model,
 pin the issues to elements, and route them to the right people —
 automatically. No more screenshots in chat threads.
 </p>
 <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)' }}>
 <Link href="/orgs/org_a/captures" className="btn btn-primary">
 upload capture
 </Link>
 <Link href="/orgs/org_a/captures/cap_demo" className="btn btn-ghost">
 view demo
 </Link>
 </div>
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
 }}>// panorama · 360°</div>
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 96,
 fontWeight: 700,
 color: 'var(--accent)',
 letterSpacing: '-0.04em',
 }}>
 360°
 </div>
 </div>
 </div>

 {/* Block 02 — REVERSED */}
 <div className="feature-row feature-row-reverse mount-stagger">
 <div>
 <div className="feature-content-num">// 02 — bim</div>
 <h2 className="feature-content-title">ifc → progress, element by element.</h2>
 <p className="feature-content-text">
 Upload your IFC model. Every issue, capture, and milestone
 ties to a specific element. Track 67% complete with column-level
 granularity — not just "phase 2 done".
 </p>
 <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)' }}>
 <Link href="/orgs/org_a/projects/prj_demo" className="btn btn-primary">
 view project
 </Link>
 </div>
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
 }}>// bim · 3d viewer</div>
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 64,
 fontWeight: 700,
 color: 'var(--fg)',
 letterSpacing: '-0.04em',
 lineHeight: 1,
 }}>
 67%
 </div>
 <div style={{
 marginTop: 8,
 fontFamily: 'var(--font-mono)',
 fontSize: 11,
 color: 'var(--accent)',
 letterSpacing: '0.05em',
 }}>project_tower_b · 12 of 18 milestones</div>
 </div>
 </div>

 {/* Block 03 */}
 <div className="feature-row mount-stagger">
 <div>
 <div className="feature-content-num">// 03 — copilot</div>
 <h2 className="feature-content-title">ask. don't dig.</h2>
 <p className="feature-content-text">
 "What got blocked last week?" "Show me all high-severity
 concrete issues." The Copilot reads your project data and
 answers in plain English — no SQL, no spreadsheets.
 </p>
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
 }}>// copilot · ai</div>
 <div style={{
 fontFamily: 'var(--font-mono)',
 fontSize: 13,
 color: 'var(--fg)',
 padding: 'var(--space-3)',
 lineHeight: 1.6,
 }}>
 <div style={{ color: 'var(--accent)', marginBottom: 8 }}>$ what blocked last week?</div>
 <div style={{ color: 'var(--fg-muted)' }}>
 → 3 milestones overdue:<br />
 &nbsp;&nbsp;· MEP rough-in (tower B, level 4)<br />
 &nbsp;&nbsp;· Inspection hold (column 3-B)<br />
 &nbsp;&nbsp;· Permit renewal (county office)
 </div>
 </div>
 </div>
 </div>

 </section>

 {/* ─── BENTO GRID ─────────────────────────────────────────────── */}
 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-mast" style={{ padding: 'var(--space-7) 0', borderBottom: 'none' }}>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 04 — the platform</span>
 </div>
 <h2 className="page-title" style={{ fontSize: 'clamp(36px, 6vw, 80px)' }}>
 thirteen products.<br />
 <span className="page-title-accent">one workspace.</span>
 </h2>
 </div>

 <div className="bento-grid">
 {/* Large — captures */}
 <div className="bento-cell large">
 <span className="bento-num">// 01</span>
 <div>
 <h3 className="bento-title">360° capture</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8, maxWidth: 360 }}>
 upload a walkthrough. we fuse to BIM.
 </p>
 </div>
 <div className="bento-viz">
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 80,
 fontWeight: 700,
 color: 'var(--accent)',
 letterSpacing: '-0.04em',
 lineHeight: 1,
 }}>
 ◐
 </div>
 </div>
 </div>

 {/* Wide — issues */}
 <div className="bento-cell wide">
 <span className="bento-num">// 02</span>
 <div>
 <h3 className="bento-title">field issues</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8 }}>
 punch list · RFIs · defects
 </p>
 </div>
 <div className="bento-viz">
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 56,
 fontWeight: 700,
 color: 'var(--fg)',
 letterSpacing: '-0.04em',
 }}>
 {stats.issues}
 </div>
 </div>
 </div>

 {/* Wide — projects */}
 <div className="bento-cell wide">
 <span className="bento-num">// 03</span>
 <div>
 <h3 className="bento-title">projects</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8 }}>
 milestones · status · BIM sync
 </p>
 </div>
 <div className="bento-viz">
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 56,
 fontWeight: 700,
 color: 'var(--fg)',
 letterSpacing: '-0.04em',
 }}>
 12
 </div>
 </div>
 </div>

 {/* Tall — workflows */}
 <div className="bento-cell tall">
 <span className="bento-num">// 04</span>
 <div>
 <h3 className="bento-title">workflows</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8 }}>
 event-driven rules engine
 </p>
 </div>
 <div className="bento-viz">
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 80,
 fontWeight: 700,
 color: 'var(--accent)',
 letterSpacing: '-0.04em',
 lineHeight: 1,
 }}>
 ↯
 </div>
 </div>
 </div>

 {/* Large — integrations */}
 <div className="bento-cell large">
 <span className="bento-num">// 05</span>
 <div>
 <h3 className="bento-title">integrations</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8, maxWidth: 360 }}>
 procore · BIM360 · plan grid · acc · box
 </p>
 </div>
 <div className="bento-viz">
 <div style={{
 display: 'flex',
 gap: 'var(--space-3)',
 flexWrap: 'wrap',
 }}>
 {['P', 'B', 'PG', 'A', 'X'].map((c, i) => (
 <div key={i} style={{
 width: 40, height: 40,
 border: '1px solid var(--line)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
 color: 'var(--accent)',
 }}>
 {c}
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Wide — reports */}
 <div className="bento-cell wide">
 <span className="bento-num">// 06</span>
 <div>
 <h3 className="bento-title">reports</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8 }}>
 daily · weekly · portfolio
 </p>
 </div>
 </div>

 {/* Wide — copilot */}
 <div className="bento-cell wide">
 <span className="bento-num">// 07</span>
 <div>
 <h3 className="bento-title">copilot</h3>
 <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 8 }}>
 ask in plain english
 </p>
 </div>
 </div>
 </div>
 </section>

 {/* ─── CTA ───────────────────────────────────────────────────── */}
 <section style={{
 padding: 'var(--space-9) 0',
 borderTop: '1px solid var(--line)',
 textAlign: 'left',
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
 <Link href="/orgs/org_a/issues/new" className="btn btn-ghost" style={{ padding: '14px 24px' }}>
 create first issue →
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
 }}>
 <span>© 2026 — sthyra</span>
 <span>built in san francisco · MIT</span>
 <span>v0.13 · 13/13 services</span>
 </footer>
 </main>
 </div>
 );
}
