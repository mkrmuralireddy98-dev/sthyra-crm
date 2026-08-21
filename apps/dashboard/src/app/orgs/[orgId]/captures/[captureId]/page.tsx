import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { PanoramaViewer } from '@/components/panorama-viewer';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Capture {
 id: string;
 projectId: string;
 name: string;
 status: string;
 createdAt: string;
}

export default async function CaptureDetailPage({ params }: { params: { orgId: string; captureId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const captureId = params.captureId;

 const capture: Capture = {
 id: captureId,
 projectId: 'prj_demo',
 name: 'Site Walkthrough — North Wing',
 status: 'ready',
 createdAt: new Date().toISOString(),
 };

 // For demo: use a public panorama image (Equirectangular projection)
 const panoramaUrl = 'https://pannellum.org/images/alma.jpg';
 const hotspots = [
 { yaw: 0.1, pitch: 0, text: 'Concrete spalling on column 3-B' },
 { yaw: -0.5, pitch: -0.2, text: 'Rebar exposed — needs inspection' },
 { yaw: 0.8, pitch: 0.3, text: 'HVAC duct misalignment' },
 ];

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <header className="page-header">
 <div className="page-header-content">
 <h1 className="page-title">{capture.name}</h1>
 <p className="page-subtitle">
 Captured {new Date(capture.createdAt).toLocaleString()} ·
 <span style={{ marginLeft: 8 }}>
 <span className={`badge badge-${capture.status === 'ready' ? 'success' : 'neutral'}`}>{capture.status}</span>
 </span>
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <Link href={`/orgs/${tenantId}/captures`} className="btn btn-ghost">← Back</Link>
 </div>
 </header>

 <section className="section">
 <PanoramaViewer imageUrl={panoramaUrl} hotspots={hotspots} />
 <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
 Drag to look around · Scroll to zoom · {hotspots.length} hotspots pinned
 </p>
 </section>

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">Issues detected in this capture</h2>
 </div>
 <table className="data-table">
 <thead><tr><th>Issue</th><th>Severity</th><th>Status</th></tr></thead>
 <tbody>
 {hotspots.map((h, i) => (
 <tr key={i}>
 <td><Link href={`/orgs/${tenantId}/issues/iss_${capture.id.slice(-6)}_${i}`}>{h.text}</Link></td>
 <td><span className="badge badge-warning">{i === 0 ? 'high' : i === 1 ? 'critical' : 'medium'}</span></td>
 <td><span className="badge badge-warning">open</span></td>
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
