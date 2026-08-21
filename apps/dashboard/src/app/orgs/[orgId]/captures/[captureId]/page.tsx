import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';
import { PanoramaViewer } from '@/components/panorama-viewer';

export const dynamic = 'force-dynamic';

const MOCK_CAPTURES: Record<string, any> = {
 cap_demo: {
 name: 'Tower B - Level 4 walkthrough',
 status: 'ready',
 kind: 'walkthrough',
 size: '2.4 GB',
 createdAt: '2026-08-21T11:24:00Z',
 uploadedBy: 'Sarah Chen',
 project: 'prj_demo',
 hotspots: [
 { yaw: 0.1, pitch: 0, text: 'Concrete spalling on column 3-B', severity: 'high' },
 { yaw: -0.5, pitch: -0.2, text: 'Rebar exposed — needs inspection', severity: 'critical' },
 { yaw: 0.8, pitch: 0.3, text: 'HVAC duct misalignment', severity: 'medium' },
 ],
 },
 cap_0280: {
 name: 'Tower B BIM master model',
 status: 'ready',
 kind: 'bim-model',
 size: '128 MB',
 createdAt: '2026-08-20T14:10:00Z',
 uploadedBy: 'Mike Rodriguez',
 project: 'prj_demo',
 hotspots: [],
 },
};

export default async function CaptureDetailPage({ params }: { params: { orgId: string; captureId: string } }) {
 const tenantId = params.orgId;
 const capture = MOCK_CAPTURES[params.captureId] ?? MOCK_CAPTURES.cap_demo;
 const is360 = capture.kind === 'walkthrough' || capture.kind === 'photo';
 const panoramaUrl = 'https://pannellum.org/images/alma.jpg';

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// {capture.project} · {capture.kind}</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
 <span className={`badge ${capture.status === 'ready' ? 'badge-success' : 'badge-warning'}`}>
 <span className="badge-dot" />{capture.status}
 </span>
 <span className="badge badge-neutral">{capture.size}</span>
 </div>
 <h1 className="page-title" style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>{capture.name}</h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)' }}>
 captured {new Date(capture.createdAt).toLocaleString()} · uploaded by {capture.uploadedBy}
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${tenantId}/captures`} className="btn btn-ghost">← back</Link>
 <button className="btn btn-primary">+ flag issue</button>
 </div>
 </div>
 </section>

 <LiveMarquee />

 {is360 && capture.hotspots.length > 0 && (
 <section style={{ padding: 'var(--space-7) 0' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 0 }}>
 <span className="page-eyebrow-marker" />
 <span>// panorama · 360° · {capture.hotspots.length} hotspots</span>
 </div>
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
 drag to look around · scroll to zoom
 </span>
 </div>
 <div style={{ border: '1px solid var(--line)', overflow: 'hidden' }}>
 <PanoramaViewer imageUrl={panoramaUrl} hotspots={capture.hotspots} />
 </div>
 </section>
 )}

 <section style={{ padding: 'var(--space-7) 0', borderTop: '1px solid var(--line)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// issues detected · {capture.hotspots.length}</span>
 </div>

 {capture.hotspots.length === 0 ? (
 <div className="empty">
 <div className="empty-eyebrow">// clear</div>
 <h3 className="empty-title">no issues detected yet.</h3>
 <p className="empty-description">run the AI detector to find issues in this capture, or flag them manually.</p>
 <button className="btn btn-primary">run AI detector</button>
 </div>
 ) : (
 <table className="data-table">
 <thead>
 <tr>
 <th>// severity</th>
 <th>// issue</th>
 </tr>
 </thead>
 <tbody>
 {capture.hotspots.map((h: any, i: number) => (
 <tr key={i}>
 <td>
 <span className={`badge ${h.severity === 'critical' || h.severity === 'high' ? 'badge-danger' : h.severity === 'medium' ? 'badge-warning' : 'badge-neutral'}`}>
 {h.severity}
 </span>
 </td>
 <td>
 <Link href={`/orgs/${tenantId}/issues/new`}>{h.text}</Link>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
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
 <span>{capture.size} · 360° walkthrough</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
