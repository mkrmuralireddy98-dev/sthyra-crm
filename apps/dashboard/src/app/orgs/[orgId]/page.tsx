import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const ORG_DATA: Record<string, any> = {
 org_a: {
 name: 'Acme Construction',
 region: 'us-east',
 plan: 'pro',
 memberCount: 12,
 projectCount: 12,
 issueCount: 8,
 captureCount: 24,
 storageGb: 1.2,
 },
 org_b: {
 name: 'BuildRight Inc',
 region: 'eu-west',
 plan: 'enterprise',
 memberCount: 124,
 projectCount: 47,
 issueCount: 156,
 captureCount: 412,
 storageGb: 18.4,
 },
 org_c: {
 name: 'MegaStructures LLC',
 region: 'us-west',
 plan: 'starter',
 memberCount: 5,
 projectCount: 3,
 issueCount: 2,
 captureCount: 4,
 storageGb: 0.1,
 },
};

export default async function OrgDetailPage({ params }: { params: { orgId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const org = ORG_DATA[tenantId] ?? ORG_DATA.org_a;

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <header className="page-header fade-in">
 <div className="page-header-content">
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 8 }}>
 <span className="tenant-badge">{tenantId}</span>
 <span className="badge badge-teal">{org.plan}</span>
 <span className="badge badge-info">{org.region}</span>
 </div>
 <h1 className="page-title">{org.name}</h1>
 <p className="page-subtitle">Workspace overview</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-primary">View projects →</Link>
 </div>
 </header>

 <section className="stats-grid mount-stagger">
 <div className="stat-card"><div className="stat-label">Members</div><div className="stat-value">{org.memberCount}</div></div>
 <div className="stat-card"><div className="stat-label">Projects</div><div className="stat-value">{org.projectCount}</div></div>
 <div className="stat-card"><div className="stat-label">Open issues</div><div className="stat-value">{org.issueCount}</div></div>
 <div className="stat-card"><div className="stat-label">Captures</div><div className="stat-value">{org.captureCount}</div><div className="stat-trend">{org.storageGb} GB used</div></div>
 </section>

 <section className="section fade-in">
 <div className="section-header"><h2 className="section-title">Quick links</h2></div>
 <div className="project-grid">
 {[
 { href: `/orgs/${tenantId}/projects`, icon: '▣', title: 'Projects', description: 'All projects for this workspace' },
 { href: `/orgs/${tenantId}/captures`, icon: '◉', title: 'Captures', description: '360° photos, BIM models, floor plans' },
 { href: `/orgs/${tenantId}/issues`, icon: '⚠', title: 'Issues', description: 'Punch list, RFIs, defects' },
 { href: `/orgs/${tenantId}/workflows`, icon: '↯', title: 'Workflows', description: 'Automated rules' },
 { href: `/orgs/${tenantId}/integrations`, icon: '⊕', title: 'Integrations', description: 'Connect external tools' },
 { href: `/orgs/${tenantId}/reports`, icon: '▤', title: 'Reports', description: 'Daily/weekly summaries' },
 ].map((link) => (
 <Link key={link.href} href={link.href} className="project-card">
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
 <div style={{
 width: 40, height: 40, borderRadius: 'var(--radius-md)',
 background: 'var(--teal-50)', color: 'var(--teal-400)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 20, fontWeight: 700,
 border: '1px solid rgba(0,184,148,0.25)',
 }}>{link.icon}</div>
 <div>
 <div className="project-name">{link.title}</div>
 <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{link.description}</div>
 </div>
 </div>
 </Link>
 ))}
 </div>
 </section>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
