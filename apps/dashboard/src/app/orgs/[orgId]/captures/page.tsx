import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Capture {
 id: string;
 projectId: string;
 name: string;
 status: string;
 createdAt: string;
}

async function fetchCaptures(projectId: string, tenantId: string): Promise<Capture[]> {
 try {
 const res = await fetch(`http://capture-service:9090/v1/projects/${projectId}/captures`, {
 headers: { 'x-tenant-id': tenantId, 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return (data.data || []) as Capture[];
 } catch {
 return [];
 }
}

const ACCEPTED_TYPES = {
 '360-video': 'video/mp4,video/quicktime,.mp4,.mov',
 'floor-plan': 'image/png,image/jpeg,application/pdf,.png,.jpg,.pdf',
 'bim-model': '.ifc,.glb,.gltf,.obj,.fbx,.rvt,.dwg',
 'photo': 'image/*,.jpg,.jpeg,.png',
};

function CaptureUploader() {
 return (
 <section className="section">
 <div className="section-header">
 <h2 className="section-title">Upload capture</h2>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
 <UploadCard
 icon="🎥"
 title="360° walkthrough"
 subtitle="MP4, MOV up to 5GB"
 accept={ACCEPTED_TYPES['360-video']}
 kind="360-video"
 />
 <UploadCard
 icon="🗺"
 title="Floor plan"
 subtitle="PDF, PNG, JPG"
 accept={ACCEPTED_TYPES['floor-plan']}
 kind="floor-plan"
 />
 <UploadCard
 icon="🏗"
 title="BIM model"
 subtitle="IFC, GLB, GLTF, RVT"
 accept={ACCEPTED_TYPES['bim-model']}
 kind="bim-model"
 />
 <UploadCard
 icon="📷"
 title="Site photo"
 subtitle="JPG, PNG"
 accept={ACCEPTED_TYPES['photo']}
 kind="photo"
 />
 </div>
 </section>
 );
}

function UploadCard({ icon, title, subtitle, accept, kind }: { icon: string; title: string; subtitle: string; accept: string; kind: string }) {
 return (
 <form action="/api/captures" method="post" encType="multipart/form-data" style={{ display: 'contents' }}>
 <label className="upload-zone" htmlFor={`upload-${kind}`} style={{ padding: 'var(--space-5)' }}>
 <div className="upload-icon" aria-hidden="true" style={{ fontSize: '20px', width: '40px', height: '40px' }}>{icon}</div>
 <div className="upload-title" style={{ fontSize: '13px' }}>{title}</div>
 <div className="upload-subtitle">{subtitle}</div>
 <input
 id={`upload-${kind}`}
 name="file"
 type="file"
 accept={accept}
 multiple
 style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
 aria-label={`Upload ${title}`}
 />
 <input type="hidden" name="kind" value={kind} />
 </label>
 </form>
 );
}

export default async function CapturesPage({ params }: { params: { orgId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const projectId = 'prj_demo';
 const captures = await fetchCaptures(projectId, tenantId);

 return (
 <div className="app-shell">
 <Sidebar currentOrgId={tenantId} currentPath={`/orgs/${tenantId}/captures`} />

 <main className="main">
 <header className="page-header">
 <div className="page-header-content">
 <h1 className="page-title">Captures</h1>
 <p className="page-subtitle">360° walkthroughs, floor plans, BIM models, and site photos</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <span className="tenant-badge">{tenantId}</span>
 <button className="btn btn-primary">+ Upload</button>
 </div>
 </header>

 <section className="stats-grid" aria-label="Capture metrics">
 <div className="stat-card">
 <div className="stat-label">Total captures</div>
 <div className="stat-value">{captures.length}</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">Processing</div>
 <div className="stat-value">{captures.filter(c => c.status === 'processing').length}</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">Ready</div>
 <div className="stat-value">{captures.filter(c => c.status === 'ready').length}</div>
 </div>
 <div className="stat-card">
 <div className="stat-label">Storage</div>
 <div className="stat-value">0 GB</div>
 <div className="stat-trend">Used</div>
 </div>
 </section>

 <CaptureUploader />

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">Recent captures</h2>
 <span className="section-action">{captures.length} items</span>
 </div>

 {captures.length === 0 ? (
 <div className="empty">
 <div className="empty-icon" aria-hidden="true">📷</div>
 <h3 className="empty-title">No captures yet</h3>
 <p className="empty-description">Upload your first capture to start building visual context. 360° walkthroughs, BIM models, floor plans, and photos all sync here.</p>
 <button className="btn btn-primary">Upload first capture</button>
 </div>
 ) : (
 <table className="data-table">
 <thead>
 <tr>
 <th>Name</th>
 <th>Status</th>
 <th>Created</th>
 </tr>
 </thead>
 <tbody>
 {captures.map((capture) => (
 <tr key={capture.id}>
 <td><Link href={`/orgs/${tenantId}/captures/${capture.id}`}>{capture.name}</Link></td>
 <td><span className="badge badge-neutral">{capture.status}</span></td>
 <td><time style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{new Date(capture.createdAt).toLocaleDateString()}</time></td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </section>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
