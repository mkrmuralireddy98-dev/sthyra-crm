'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { toast } from '@/components/toast';
import { createProject } from '@/lib/api';

const TYPES = [
 { id: 'commercial', name: 'commercial', desc: 'office · retail · hospitality' },
 { id: 'residential', name: 'residential', desc: 'single-family · multi-family' },
 { id: 'industrial', name: 'industrial', desc: 'warehouse · manufacturing' },
 { id: 'infrastructure', name: 'infrastructure', desc: 'bridge · road · utility' },
 { id: 'mixed-use', name: 'mixed-use', desc: 'commercial + residential' },
] as const;

export default function NewProjectPage({ params }: { params: { orgId: string } }) {
 const router = useRouter();
 const tenantId = params.orgId;
 const [name, setName] = useState('');
 const [location, setLocation] = useState('');
 const [type, setType] = useState<string>('commercial');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const onSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 setSubmitting(true);
 try {
 const created = await createProject({ tenantId, name, location, type });
 toast({
 title: 'project created',
 description: `${created.id} · ${created.name}`,
 });
 router.push(`/orgs/${tenantId}/projects/${created.id}`);
 } catch (err: any) {
 setError(err.message ?? 'failed to create project');
 toast({
 title: 'failed to create project',
 description: err.message,
 variant: 'error',
 });
 setSubmitting(false);
 }
 };

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
 new<br />
 <span className="page-title-accent">project.</span>
 </h1>
 <p className="page-subtitle">
 add a new construction project · visible to all members of {tenantId}
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-ghost">
 ← back
 </Link>
 </div>
 </div>
 </section>

 <div style={{ maxWidth: 720, margin: 'var(--space-7) auto var(--space-9)' }}>
 <form onSubmit={onSubmit} className="card" style={{ padding: 'var(--space-6)' }}>
 <span className="card-number">// 01 · project setup</span>

 {error && (
 <div style={{
 padding: 'var(--space-3) var(--space-4)',
 background: 'rgba(255,68,68,0.08)',
 border: '1px solid #ff4444',
 color: '#ff4444',
 fontFamily: 'var(--font-mono)',
 fontSize: 12,
 marginBottom: 'var(--space-4)',
 }}>
 // error: {error}
 </div>
 )}

 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
 <div>
 <label htmlFor="proj-name" className="form-label">// project name *</label>
 <input
 id="proj-name"
 type="text"
 required
 autoFocus
 placeholder="tower b — north wing"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="form-input"
 style={{ fontSize: 18, padding: 'var(--space-3) 0' }}
 />
 </div>

 <div>
 <label htmlFor="proj-location" className="form-label">// location *</label>
 <input
 id="proj-location"
 type="text"
 required
 placeholder="San Francisco, CA"
 value={location}
 onChange={(e) => setLocation(e.target.value)}
 className="form-input"
 style={{ fontSize: 16 }}
 />
 </div>

 <div>
 <label className="form-label">// project type</label>
 <div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
 gap: 1,
 background: 'var(--line)',
 border: '1px solid var(--line)',
 }}>
 {TYPES.map((t) => {
 const active = type === t.id;
 return (
 <button
 key={t.id}
 type="button"
 onClick={() => setType(t.id)}
 style={{
 padding: 'var(--space-4)',
 background: active ? 'var(--bg-elevated)' : 'var(--bg-page)',
 border: 'none',
 cursor: 'pointer',
 textAlign: 'left',
 position: 'relative',
 borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
 }}
 >
 <div style={{
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 color: active ? 'var(--accent)' : 'var(--fg-tertiary)',
 letterSpacing: '0.15em',
 textTransform: 'uppercase',
 marginBottom: 'var(--space-2)',
 }}>
 // {t.name}
 </div>
 <div style={{
 fontSize: 11,
 color: 'var(--fg-quaternary)',
 fontFamily: 'var(--font-mono)',
 letterSpacing: '0.05em',
 }}>
 {t.desc}
 </div>
 </button>
 );
 })}
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--line)' }}>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-ghost">
 ← cancel
 </Link>
 <button
 type="submit"
 disabled={submitting || !name || !location}
 className="btn btn-primary"
 style={{ opacity: (submitting || !name || !location) ? 0.6 : 1 }}
 >
 {submitting ? '// creating...' : 'create project →'}
 </button>
 </div>
 </form>
 </div>
 </main>
 </div>
 );
}
