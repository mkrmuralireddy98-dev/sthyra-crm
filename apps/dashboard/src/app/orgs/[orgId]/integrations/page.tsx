import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Integration {
 id: string;
 provider: string;
 status: 'connected' | 'disconnected' | 'error';
 connectedAt: string | null;
}

async function fetchIntegrations(orgId: string): Promise<Integration[]> {
 try {
 const res = await fetch(`http://127.0.0.1:9098/v1/orgs/${orgId}/integrations`, {
 headers: { 'x-tenant-id': orgId, 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return (data.data || []) as Integration[];
 } catch {
 return [];
 }
}

const PROVIDERS = [
 { id: 'procore', name: 'Procore', description: 'Sync projects, RFIs, and submittals', color: '#FF6E00' },
 { id: 'bim360', name: 'Autodesk BIM 360', description: 'Sync BIM models, drawings, and issues', color: '#0696D7' },
 { id: 'plangrid', name: 'PlanGrid', description: 'Sync drawings, sheets, and markups', color: '#3B7BFB' },
 { id: 'acc', name: 'Autodesk Construction Cloud', description: 'Sync docs, models, and issues', color: '#000000' },
 { id: 'box', name: 'Box', description: 'Sync drawings and documents', color: '#0061D5' },
];

export default async function IntegrationsPage({ params }: { params: { orgId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const integrations = await fetchIntegrations(tenantId);

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <header className="page-header">
 <div className="page-header-content">
 <h1 className="page-title">Integrations</h1>
 <p className="page-subtitle">Connect Sthyra to your existing construction tools</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <span className="tenant-badge">{tenantId}</span>
 </div>
 </header>

 <section className="stats-grid">
 <div className="stat-card"><div className="stat-label">Connected</div><div className="stat-value">{integrations.filter(i => i.status === 'connected').length}</div></div>
 <div className="stat-card"><div className="stat-label">Available</div><div className="stat-value">{PROVIDERS.length}</div></div>
 <div className="stat-card"><div className="stat-label">Pending sync</div><div className="stat-value">0</div></div>
 <div className="stat-card"><div className="stat-label">Errors</div><div className="stat-value">{integrations.filter(i => i.status === 'error').length}</div></div>
 </section>

 <section className="section">
 <div className="section-header">
 <h2 className="section-title">Available integrations</h2>
 </div>
 <div className="project-grid">
 {PROVIDERS.map((p) => {
 const connected = integrations.find((i) => i.provider === p.id && i.status === 'connected');
 return (
 <div key={p.id} className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
 <div style={{
 width: 40, height: 40, borderRadius: 'var(--radius-md)',
 background: p.color + '22', color: p.color,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontWeight: 700, fontSize: 18,
 border: `1px solid ${p.color}33`,
 }}>{p.name[0]}</div>
 <div style={{ flex: 1 }}>
 <div className="project-name">{p.name}</div>
 <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.description}</div>
 </div>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
 {connected ? (
 <>
 <span className="badge badge-success"><span className="badge-dot" />connected</span>
 <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}>Manage</button>
 </>
 ) : (
 <>
 <span className="badge badge-neutral">disconnected</span>
 <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}>Connect</button>
 </>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </section>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
