import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

interface Issue {
 id: string;
 projectId: string;
 title: string;
 description?: string;
 status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
 severity: 'low' | 'medium' | 'high' | 'critical';
 kind: string;
 trade?: string;
 createdAt: string;
 resolvedAt?: string | null;
}

async function fetchIssue(projectId: string, issueId: string, tenantId: string): Promise<Issue | null> {
 try {
 const res = await fetch(`http://127.0.0.1:9091/v1/projects/${projectId}/issues/${issueId}`, {
 headers: { 'x-tenant-id': tenantId, 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return null;
 return await res.json();
 } catch {
 return null;
 }
}

// Mock status history (real one would come from field-service status history endpoint)
const MOCK_HISTORY = [
 { from: null, to: 'open', at: '2 hours ago', actor: 'Sarah Chen', reason: 'Auto-created from field inspection' },
];

const MOCK_COMMENTS = [
 { id: 'c1', author: 'Mike Rodriguez', at: '1 hour ago', body: 'Photographed the area. Concrete spalling is about 30cm wide.' },
 { id: 'c2', author: 'Lisa Park', at: '30 min ago', body: 'Coordinating with structural engineer for assessment.' },
];

export default async function IssueDetailPage({ params }: { params: { orgId: string; issueId: string } }) {
 const requestId = randomUUID();
 const tenantId = params.orgId;
 const issueId = params.issueId;
 const issue = await fetchIssue('prj_demo', issueId, tenantId);

 if (!issue) {
 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <div className="empty">
 <div className="empty-icon">⚠</div>
 <h3 className="empty-title">Issue not found</h3>
 <p className="empty-description">This issue may not exist or you don't have access to it.</p>
 <Link href={`/orgs/${tenantId}/issues`} className="btn btn-primary">← Back to issues</Link>
 </div>
 </main>
 </div>
 );
 }

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <header className="page-header fade-in">
 <div className="page-header-content">
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 8 }}>
 <span className={`badge ${
 issue.severity === 'critical' || issue.severity === 'high' ? 'badge-danger' :
 issue.severity === 'medium' ? 'badge-warning' : 'badge-neutral'
 }`}>{issue.severity}</span>
 <span className="badge badge-info">{issue.status.replace('_', ' ')}</span>
 <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-quaternary)' }}>{issue.id}</code>
 </div>
 <h1 className="page-title">{issue.title}</h1>
 <p className="page-subtitle">In project <Link href={`/orgs/${tenantId}/projects/${issue.projectId}`} style={{ color: 'var(--teal-400)' }}>{issue.projectId}</Link> · Opened {new Date(issue.createdAt).toLocaleDateString()}</p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <Link href={`/orgs/${tenantId}/issues`} className="btn btn-ghost">← Back</Link>
 <button className="btn btn-primary">Resolve</button>
 </div>
 </header>

 <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
 {/* Main content */}
 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
 {/* Description */}
 <section className="section fade-in">
 <div className="section-header"><h2 className="section-title">Description</h2></div>
 <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
 {issue.description || 'No description provided.'}
 </p>
 </section>

 {/* Photos */}
 <section className="section fade-in">
 <div className="section-header">
 <h2 className="section-title">Photos</h2>
 <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}>+ Add photo</button>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--space-2)' }}>
 {[1, 2, 3].map((i) => (
 <div key={i} style={{
 aspectRatio: '4 / 3',
 background: `linear-gradient(135deg, var(--bg-panel), var(--bg-elevated-2))`,
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 color: 'var(--text-quaternary)',
 fontSize: 11,
 fontFamily: 'var(--font-mono)',
 cursor: 'pointer',
 }}>
 photo_{i}.jpg
 </div>
 ))}
 </div>
 </section>

 {/* Comments */}
 <section className="section fade-in">
 <div className="section-header">
 <h2 className="section-title">Activity ({MOCK_COMMENTS.length})</h2>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
 {MOCK_COMMENTS.map((c) => (
 <div key={c.id} style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <div style={{
 width: 32, height: 32, borderRadius: '50%',
 background: 'var(--bg-elevated)',
 color: 'var(--text-secondary)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 12, fontWeight: 600, flexShrink: 0,
 }}>
 {c.author.split(' ').map((n) => n[0]).join('')}
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 12, marginBottom: 4 }}>
 <span style={{ fontWeight: 510, color: 'var(--text-primary)' }}>{c.author}</span>
 <span style={{ color: 'var(--text-quaternary)', marginLeft: 8 }}>{c.at}</span>
 </div>
 <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{c.body}</p>
 </div>
 </div>
 ))}
 </div>
 <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
 <div style={{
 width: 32, height: 32, borderRadius: '50%',
 background: 'var(--bg-elevated)',
 color: 'var(--text-secondary)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 12, fontWeight: 600, flexShrink: 0,
 }}>You</div>
 <textarea
 placeholder="Add a comment…"
 rows={3}
 style={{
 flex: 1, padding: 'var(--space-3)', background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
 color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
 fontFamily: 'inherit',
 }}
 />
 </div>
 </section>
 </div>

 
 <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
 {/* Status timeline */}
 <section className="card fade-in">
 <h3 style={{ fontSize: 13, fontWeight: 590, marginBottom: 'var(--space-4)' }}>Status timeline</h3>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
 {MOCK_HISTORY.map((h, i) => (
 <div key={i} style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <div style={{
 width: 8, height: 8, borderRadius: '50%',
 background: i === 0 ? 'var(--teal-500)' : 'var(--text-quaternary)',
 marginTop: 6, flexShrink: 0,
 }} />
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 510 }}>
 → <span className="badge badge-info" style={{ marginLeft: 4 }}>{h.to}</span>
 </div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{h.at}</div>
 <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 2 }}>{h.actor}</div>
 {h.reason && (
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>{h.reason}</div>
 )}
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* Properties */}
 <section className="card fade-in">
 <h3 style={{ fontSize: 13, fontWeight: 590, marginBottom: 'var(--space-4)' }}>Properties</h3>
 <dl style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
 {[
 { label: 'Project', value: <Link href={`/orgs/${tenantId}/projects/${issue.projectId}`}>{issue.projectId}</Link> },
 { label: 'Kind', value: issue.kind },
 { label: 'Trade', value: issue.trade || '—' },
 { label: 'Created', value: new Date(issue.createdAt).toLocaleDateString() },
 { label: 'Resolved', value: issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : '—' },
 ].map((row) => (
 <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
 <dt style={{ color: 'var(--text-tertiary)' }}>{row.label}</dt>
 <dd style={{ color: 'var(--text-secondary)', fontWeight: 510 }}>{row.value}</dd>
 </div>
 ))}
 </dl>
 </section>
 </aside>
 </div>

 <footer style={{ marginTop: 'var(--space-9)', padding: 'var(--space-5) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-quaternary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
 Request <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{requestId}</code>
 </footer>
 </main>
 </div>
 );
}
