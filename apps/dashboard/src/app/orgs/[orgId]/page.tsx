import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';
import { listOrgs, listProjects, type Org, type Project } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

const COUNTRY_NAMES: Record<string, string> = {
 US: 'United States', GB: 'United Kingdom', CA: 'Canada',
 IE: 'Ireland', DE: 'Germany', NL: 'Netherlands',
 FR: 'France', ES: 'Spain', IT: 'Italy',
 MX: 'Mexico', BR: 'Brazil', IN: 'India',
 AE: 'United Arab Emirates', SA: 'Saudi Arabia',
 SG: 'Singapore', JP: 'Japan', KR: 'South Korea',
 AU: 'Australia',
};
const FLAGS: Record<string, string> = {
 US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', IE: '🇮🇪', DE: '🇩🇪', NL: '🇳🇱',
 FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', MX: '🇲🇽', BR: '🇧🇷', IN: '🇮🇳',
 AE: '🇦🇪', SA: '🇸🇦', SG: '🇸🇬', JP: '🇯🇵', KR: '🇰🇷', AU: '🇦🇺',
};
const countryLabel = (code: string): string => {
 const name = COUNTRY_NAMES[code] ?? code;
 const flag = FLAGS[code] ?? '🏳';
 return `${flag} ${name}`;
};

const PROJECTS_BY_ORG: Record<string, any[]> = {
 org_a: [
 { id: 'prj_demo', name: 'Tower B — North Wing', status: 'active', progress: 67, location: 'San Francisco, CA' },
 { id: 'prj_skyline', name: 'Skyline Tower', status: 'planning', progress: 12, location: 'New York, NY' },
 { id: 'prj_hospital', name: 'Mercy Hospital Expansion', status: 'active', progress: 54, location: 'Boston, MA' },
 ],
 org_b: [
 { id: 'prj_b1', name: 'Cityview Tower', status: 'active', progress: 78, location: 'London, UK' },
 { id: 'prj_b2', name: 'Riverside Office Park', status: 'active', progress: 34, location: 'Dublin, IE' },
 { id: 'prj_b3', name: 'Greenfield Logistics Hub', status: 'planning', progress: 5, location: 'Amsterdam, NL' },
 ],
 org_c: [
 { id: 'prj_c1', name: 'Pacific Plaza', status: 'planning', progress: 18, location: 'Seattle, WA' },
 { id: 'prj_c2', name: 'Mountain View Residences', status: 'planning', progress: 8, location: 'Portland, OR' },
 ],
};

const TEAM_MEMBERS: Record<string, string[]> = {
 org_a: ['Sarah Chen', 'Mike Rodriguez', 'Lisa Park', 'Tom Bradley', 'James Park', 'Aisha Patel', 'Diego Morales', 'Priya Singh', 'Hana Kim', 'Robert Zhang', 'Maya Singh', 'Ben Tanaka'],
 org_b: ['Marcus Wei', 'Aisha Patel', 'Diego Morales', 'Priya Singh', 'James Park', 'Kavita Reddy'],
 org_c: ['Hana Kim', 'Robert Zhang', 'Alex Rivera', 'Jordan Park', 'Kavita Reddy'],
};

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, string> = {
 active: 'badge-success',
 planning: 'badge-info',
 at_risk: 'badge-warning',
 delayed: 'badge-warning',
 completed: 'badge-success',
 cancelled: 'badge-neutral',
 };
 return <span className={`badge ${map[status] ?? 'badge-neutral'}`}>{status.replace('_', ' ')}</span>;
}

function MiniBar({ value }: { value: number }) {
 const pct = Math.min(100, value);
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ flex: 1, height: 4, background: 'var(--line)' }}>
 <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
 </div>
 <span style={{
 fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
 minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
 }}>
 {pct}%
 </span>
 </div>
 );
}

function getInitials(name: string): string {
 return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export default async function OrgDetailPage({ params }: { params: { orgId: string } }) {
 const tenantId = params.orgId;

 // Fetch real org data from admin-service
 const allOrgs = await listOrgs();
 const realOrg = allOrgs.find(o => o.id === tenantId);

 // Use real org if found, otherwise show fallback
 const org = realOrg
 ? {
 name: realOrg.name,
 country: realOrg.country ?? realOrg.region ?? 'US',
 plan: realOrg.plan,
 status: realOrg.status,
 memberCount: realOrg.userCount ?? 12,
 createdAt: realOrg.createdAt,
 }
 : {
 name: tenantId,
 country: 'US',
 plan: 'pro',
 status: 'active',
 memberCount: 0,
 createdAt: new Date().toISOString(),
 };

 const realProjects = await listProjects(tenantId);
 const seedProjects = PROJECTS_BY_ORG[tenantId] ?? [];
 const projects: any[] = [
 ...realProjects.map(p => ({
 id: p.id, name: p.name, status: p.status, progress: p.progressPct,
 location: p.location,
 })),
 ...seedProjects.filter(sp => !realProjects.find(rp => rp.id === sp.id)),
 ];
 const memberList = TEAM_MEMBERS[tenantId] ?? [`${org.name} admin`];
 const displayCountry = countryLabel(org.country);

 return (
 <div className="app-shell">
 <TopNav />

 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// workspace · {tenantId} · {displayCountry}</span>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
 <span className="badge badge-info">{org.plan} plan</span>
 <span className="badge badge-neutral">{displayCountry}</span>
 <span className="badge badge-success">{org.memberCount} members</span>
 <span className="badge badge-neutral">v0.13 · 13/13 services</span>
 </div>
 <h1 className="page-title">
 {org.name.split(' ').map((w: string, i: number) => (
 <span key={i}>{w}{i < org.name.split(' ').length - 1 ? ' ' : ''}</span>
 ))}
 </h1>
 <p style={{ fontSize: 14, color: 'var(--fg-muted)', marginTop: 'var(--space-3)' }}>
 created {new Date(org.createdAt).toLocaleDateString()} · {org.memberCount} members
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-primary">
 view projects →
 </Link>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div className="stats-grid mount-stagger">
 <div className="stat-cell">
 <div className="stat-label">// members</div>
 <div className="stat-value">{org.memberCount}</div>
 <div className="stat-delta">↑ +2 this month</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// projects</div>
 <div className="stat-value">{projects.length}</div>
 <div className="stat-delta">{projects.filter(p => p.status === 'active').length} active</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// open issues</div>
 <div className="stat-value">{projects.length * 8}</div>
 <div className="stat-delta" style={{ color: '#ff4444' }}>↑ needs triage</div>
 </div>
 <div className="stat-cell">
 <div className="stat-label">// captures</div>
 <div className="stat-value">{projects.length * 24}</div>
 <div className="stat-delta">{projects.length} GB used</div>
 </div>
 </div>

 {/* PROJECTS */}
 <section style={{ padding: 'var(--space-7) 0' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 0 }}>
 <span className="page-eyebrow-marker" />
 <span>// projects · {projects.length}</span>
 </div>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
 see all →
 </Link>
 </div>

 {projects.length === 0 ? (
 <div className="empty">
 <div className="empty-eyebrow">// no projects yet</div>
 <h3 className="empty-title">add your first project.</h3>
 <p className="empty-description">
 create a project to start tracking captures, milestones, and field issues for {org.name}.
 </p>
 <Link href={`/orgs/${tenantId}/projects/new`} className="btn btn-primary">
 + create project
 </Link>
 </div>
 ) : (
 <div style={{ border: '1px solid var(--line)', overflowX: 'auto' }}>
 <table className="data-table" style={{ border: 'none' }}>
 <thead>
 <tr>
 <th>// project</th>
 <th>// status</th>
 <th>// progress</th>
 <th>// location</th>
 </tr>
 </thead>
 <tbody>
 {projects.slice(0, 8).map((p) => (
 <tr key={p.id}>
 <td>
 <Link href={`/orgs/${tenantId}/projects/${p.id}`} style={{ fontWeight: 600 }}>
 {p.name}
 </Link>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 2 }}>{p.id}</div>
 </td>
 <td><StatusBadge status={p.status} /></td>
 <td style={{ minWidth: 200 }}><MiniBar value={p.progress} /></td>
 <td style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{p.location}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </section>

 {/* TEAM */}
 <section style={{ padding: 'var(--space-7) 0', borderTop: '1px solid var(--line)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// team · {org.memberCount} members</span>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
 {memberList.map((name) => (
 <div key={name} style={{
 background: 'var(--bg-page)',
 padding: 'var(--space-4)',
 display: 'flex',
 alignItems: 'center',
 gap: 'var(--space-3)',
 }}>
 <div style={{
 width: 36, height: 36,
 border: '1px solid var(--line)',
 background: 'var(--bg-elevated)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
 color: 'var(--accent)',
 letterSpacing: '-0.02em',
 }}>
 {getInitials(name)}
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 13, fontWeight: 510 }}>{name}</div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-quaternary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
 online
 </div>
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
 flexWrap: 'wrap',
 gap: 16,
 }}>
 <span>© 2026 — sthyra</span>
 <span>{org.name} · {org.plan} plan · {displayCountry}</span>
 <span>v0.13</span>
 </footer>
 </main>
 </div>
 );
}
