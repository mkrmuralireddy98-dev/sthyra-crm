import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

interface Capture {
 id: string;
 projectId: string;
 name: string;
 status: string;
 kind: string;
 createdAt: string;
 size: string;
}

async function fetchCaptures(): Promise<Capture[]> {
 try {
 const res = await fetch('http://127.0.0.1:9090/v1/projects/prj_demo/captures', {
 headers: { 'x-tenant-id': 'org_a', 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return (data.data || []) as Capture[];
 } catch {
 return [];
 }
}

const UPLOAD_KINDS = [
 { kind: '360-video', icon: '◐', title: '360° walkthrough', desc: 'MP4, MOV · up to 5GB' },
 { kind: 'floor-plan', icon: '◇', title: 'floor plan', desc: 'PDF, PNG, JPG · up to 50MB' },
 { kind: 'bim-model', icon: '▣', title: 'BIM model', desc: 'IFC, GLB, GLTF, RVT · up to 500MB' },
 { kind: 'photo', icon: '◆', title: 'site photo', desc: 'JPG, PNG · up to 10MB' },
];

const MOCK_CAPTURES = [
 { id: 'cap_0281', projectId: 'prj_demo', name: 'Tower B - Level 4 walkthrough', kind: 'walkthrough', status: 'ready', createdAt: '2026-08-21T11:24:00Z', size: '2.4 GB' },
 { id: 'cap_0280', projectId: 'prj_demo', name: 'Tower B BIM master', kind: 'bim-model', status: 'ready', createdAt: '2026-08-20T14:10:00Z', size: '128 MB' },
 { id: 'cap_0278', projectId: 'prj_hospital', name: 'OR wing floor plan v3', kind: 'floor-plan', status: 'processing', createdAt: '2026-08-21T08:45:00Z', size: '24 MB' },
];

export default async function CapturesPage({ params }: { params: { orgId: string } }) {
 const tenantId = params.orgId;
 const captures = await fetchCaptures();
 const allCaptures = captures.length > 0 ? captures : MOCK_CAPTURES;

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
 captures<span className="page-title-accent">.</span>
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)', maxWidth: 520 }}>
 360° walkthroughs · floor plans · BIM models · site photos · all fused to project
 </p>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// total captures</div>
 <div className="stat-value">{allCaptures.length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// processing</div>
 <div className="stat-value">{allCaptures.filter(c => c.status === 'processing').length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// ready</div>
 <div className="stat-value">{allCaptures.filter(c => c.status === 'ready').length}</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// storage</div>
 <div className="stat-value">2.6 GB</div>
 <div className="stat-delta">of 50 GB</div>
 </div>
 </div>

 {/* Upload zones */}
 <section style={{ padding: 'var(--space-7) 0' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// upload capture</span>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
 {UPLOAD_KINDS.map((u) => (
 <label
 key={u.kind}
 htmlFor={`upload-${u.kind}`}
 className="upload-zone"
 style={{ margin: 0, border: 'none', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}
 >
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 40,
 fontWeight: 700,
 color: 'var(--accent)',
 lineHeight: 1,
 marginBottom: 'var(--space-2)',
 }}>
 {u.icon}
 </div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
 // drop or click
 </div>
 <div style={{ fontSize: 13, fontWeight: 510 }}>{u.title}</div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.05em' }}>
 {u.desc}
 </div>
 <input
 id={`upload-${u.kind}`}
 type="file"
 accept={u.kind === '360-video' ? 'video/mp4,video/quicktime,.mp4,.mov' : u.kind === 'floor-plan' ? '.pdf,image/*' : u.kind === 'bim-model' ? '.ifc,.glb,.gltf' : 'image/*'}
 multiple
 style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
 aria-label={`Upload ${u.title}`}
 />
 </label>
 ))}
 </div>
 </section>

 {/* Recent captures */}
 <section style={{ padding: 'var(--space-7) 0', borderTop: '1px solid var(--line)' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 0 }}>
 <span className="page-eyebrow-marker" />
 <span>// recent captures · {allCaptures.length}</span>
 </div>
 </div>

 {allCaptures.length === 0 ? (
 <div className="empty">
 <div className="empty-eyebrow">// empty</div>
 <h3 className="empty-title">no captures yet.</h3>
 <p className="empty-description">
 upload your first capture to start building visual context.
 360° walkthroughs, BIM models, floor plans, and photos all sync here.
 </p>
 </div>
 ) : (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
 {allCaptures.slice(0, 6).map((c) => (
 <Link
 key={c.id}
 href={`/orgs/${tenantId}/captures/${c.id}`}
 style={{
 background: 'var(--bg-page)',
 padding: 'var(--space-4)',
 textDecoration: 'none',
 color: 'inherit',
 display: 'block',
 }}
 >
 <div style={{
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 color: 'var(--accent)',
 letterSpacing: '0.1em',
 textTransform: 'uppercase',
 marginBottom: 4,
 }}>
 // {c.kind || 'capture'}
 </div>
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 18,
 fontWeight: 600,
 letterSpacing: '-0.02em',
 marginBottom: 8,
 lineHeight: 1.3,
 }}>
 {c.name || c.id}
 </div>
 <div style={{
 display: 'flex',
 justifyContent: 'space-between',
 fontFamily: 'var(--font-mono)',
 fontSize: 11,
 color: 'var(--fg-quaternary)',
 }}>
 <span>{new Date(c.createdAt).toLocaleDateString()}</span>
 <span>{c.size}</span>
 </div>
 </Link>
 ))}
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
 <span>capture service · v0.7</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
