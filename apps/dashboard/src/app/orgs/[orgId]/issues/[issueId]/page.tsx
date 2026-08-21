import Link from 'next/link';
import { TopNav, LiveMarquee } from '@/components/top-nav';

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

async function fetchIssue(issueId: string, tenantId: string): Promise<Issue | null> {
 try {
 const res = await fetch(`http://127.0.0.1:9091/v1/projects/prj_demo/issues/${issueId}`, {
 headers: { 'x-tenant-id': tenantId, 'accept': 'application/json' },
 cache: 'no-store',
 });
 if (!res.ok) return null;
 return await res.json();
 } catch {
 return null;
 }
}

const MOCK_HISTORY = [
 { from: null, to: 'open', at: '2 hours ago', actor: 'Sarah Chen', reason: 'Auto-created from field inspection' },
];

const MOCK_COMMENTS = [
 { id: 'c1', author: 'Mike Rodriguez', at: '1 hour ago', body: 'Photographed the area. Concrete spalling is about 30cm wide.' },
 { id: 'c2', author: 'Lisa Park', at: '30 min ago', body: 'Coordinating with structural engineer for assessment.' },
];

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, string> = {
 open: 'badge-warning',
 in_progress: 'badge-info',
 resolved: 'badge-success',
 wont_fix: 'badge-neutral',
 };
 return <span className={`badge ${map[status] ?? 'badge-neutral'}`}>{status.replace('_', ' ')}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
 const map: Record<string, string> = {
 critical: 'badge-danger',
 high: 'badge-danger',
 medium: 'badge-warning',
 low: 'badge-neutral',
 };
 return <span className={`badge ${map[severity] ?? 'badge-neutral'}`}>{severity}</span>;
}

export default async function IssueDetailPage({ params }: { params: { orgId: string; issueId: string } }) {
 const tenantId = params.orgId;
 const issueId = params.issueId;
 const issue = await fetchIssue(issueId, tenantId);

 if (!issue) {
 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <section className="page-mast">
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 404 · not found</span>
 </div>
 <h1 className="page-title">issue not found.</h1>
 <p className="page-subtitle">this issue may not exist or you don't have access.</p>
 <Link href={`/orgs/${tenantId}/issues`} className="btn btn-primary" style={{ marginTop: 'var(--space-5)' }}>
 ← back to issues
 </Link>
 </section>
 </main>
 </div>
 );
 }

 return (
 <div className="app-shell">
 <TopNav currentOrgId={tenantId} />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// {issue.projectId} · {issue.id.slice(-8)}</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
 <SeverityBadge severity={issue.severity} />
 <StatusBadge status={issue.status} />
 </div>
 <h1 className="page-title" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>{issue.title}</h1>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${tenantId}/issues`} className="btn btn-ghost">← back</Link>
 <button className="btn btn-primary">resolve →</button>
 </div>
 </div>
 </section>

 <LiveMarquee />

 <div style={{
 display: 'grid',
 gridTemplateColumns: '2fr 1fr',
 gap: 'var(--space-7)',
 padding: 'var(--space-7) 0',
 alignItems: 'start',
 }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
 {/* Description */}
 <section>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
 <span className="page-eyebrow-marker" />
 <span>// description</span>
 </div>
 <p style={{
 color: 'var(--fg-secondary)',
 lineHeight: 1.6,
 padding: 'var(--space-4)',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--line)',
 }}>
 {issue.description || 'no description provided.'}
 </p>
 </section>

 {/* Photos */}
 <section>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
 <span className="page-eyebrow-marker" />
 <span>// photos · 3</span>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
 {[1, 2, 3].map((i) => (
 <div key={i} style={{
 aspectRatio: '4 / 3',
 background: 'var(--bg-page)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 color: 'var(--fg-quaternary)',
 fontSize: 11,
 fontFamily: 'var(--font-mono)',
 }}>
 photo_{i}.jpg
 </div>
 ))}
 </div>
 </section>

 {/* Activity */}
 <section>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
 <span className="page-eyebrow-marker" />
 <span>// activity · {MOCK_COMMENTS.length}</span>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
 {MOCK_COMMENTS.map((c) => (
 <div key={c.id} style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <div style={{
 width: 36, height: 36, flexShrink: 0,
 border: '1px solid var(--line)',
 background: 'var(--bg-elevated)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
 color: 'var(--accent)',
 }}>
 {c.author.split(' ').map(n => n[0]).join('')}
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 12, marginBottom: 4 }}>
 <span style={{ fontWeight: 510, color: 'var(--fg)' }}>{c.author}</span>
 <span style={{ color: 'var(--fg-quaternary)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{c.at}</span>
 </div>
 <p style={{ color: 'var(--fg-secondary)', fontSize: 13, lineHeight: 1.5 }}>{c.body}</p>
 </div>
 </div>
 ))}
 <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
 <div style={{
 width: 36, height: 36, flexShrink: 0,
 border: '1px solid var(--accent)',
 background: 'var(--bg-elevated)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
 color: 'var(--accent)',
 }}>
 You
 </div>
 <textarea
 placeholder="add a comment…"
 rows={3}
 style={{
 flex: 1, padding: 'var(--space-3)',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--line)',
 color: 'var(--fg-primary)',
 fontSize: 13, resize: 'vertical',
 fontFamily: 'inherit',
 }}
 />
 </div>
 </div>
 </section>
 </div>

 {/* Sidebar */}
 <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
 <section>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
 <span className="page-eyebrow-marker" />
 <span>// status timeline</span>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--bg-elevated)', border: '1px solid var(--line)' }}>
 {MOCK_HISTORY.map((h, i) => (
 <div key={i} style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 12, color: 'var(--fg-primary)', fontWeight: 510 }}>
 → <StatusBadge status={h.to} />
 </div>
 <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{h.at}</div>
 <div style={{ fontSize: 11, color: 'var(--fg-quaternary)', marginTop: 2 }}>{h.actor}</div>
 {h.reason && (
 <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4, fontStyle: 'italic' }}>{h.reason}</div>
 )}
 </div>
 </div>
 ))}
 </div>
 </section>

 <section>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
 <span className="page-eyebrow-marker" />
 <span>// properties</span>
 </div>
 <dl style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', background: 'var(--bg-elevated)', border: '1px solid var(--line)' }}>
 {[
 { label: 'project', value: <Link href={`/orgs/${tenantId}/projects/${issue.projectId}`}>{issue.projectId}</Link> },
 { label: 'kind', value: issue.kind },
 { label: 'trade', value: issue.trade || '—' },
 { label: 'created', value: new Date(issue.createdAt).toLocaleDateString() },
 { label: 'resolved', value: issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : '—' },
 ].map((row) => (
 <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
 <dt style={{ color: 'var(--fg-muted)' }}>{row.label}</dt>
 <dd style={{ color: 'var(--fg-primary)', fontWeight: 510 }}>{row.value}</dd>
 </div>
 ))}
 </dl>
 </section>
 </aside>
 </div>
 </main>
 </div>
 );
}
