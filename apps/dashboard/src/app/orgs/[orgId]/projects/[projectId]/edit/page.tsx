'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { toast } from '@/components/toast';
import { listProjects, updateProject, type Project } from '@/lib/api';

const TYPES = [
 { id: 'commercial', name: 'commercial', desc: 'office · retail · hospitality' },
 { id: 'residential', name: 'residential', desc: 'single-family · multi-family' },
 { id: 'industrial', name: 'industrial', desc: 'warehouse · manufacturing' },
 { id: 'infrastructure', name: 'infrastructure', desc: 'bridge · road · utility' },
 { id: 'mixed-use', name: 'mixed-use', desc: 'commercial + residential' },
] as const;

export default function EditProjectPage({ params }: { params: { orgId: string; projectId: string } }) {
 const router = useRouter();
 const tenantId = params.orgId;
 const projectId = params.projectId;
 const [project, setProject] = useState<Project | null>(null);
 const [name, setName] = useState('');
 const [location, setLocation] = useState('');
 const [type, setType] = useState('commercial');
 const [status, setStatus] = useState('planning');
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 (async () => {
 try {
 const projects = await listProjects(tenantId);
 const found = projects.find(p => p.id === projectId);
 if (!found) {
 setError('project not found');
 setLoading(false);
 return;
 }
 setProject(found);
 setName(found.name);
 setLocation(found.location ?? '');
 setType(found.type ?? 'commercial');
 setStatus(found.status ?? 'planning');
 setLoading(false);
 } catch (e: any) {
 setError(e.message ?? 'failed to load project');
 setLoading(false);
 }
 })();
 }, [tenantId, projectId]);

 const onSave = async (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);
 setError(null);
 try {
 await updateProject(tenantId, projectId, { name, location, type, status });
 toast({ title: 'project updated', description: `${name} · ${location}` });
 router.push(`/orgs/${tenantId}/projects/${projectId}`);
 } catch (err: any) {
 setError(err.message ?? 'failed to update project');
 toast({ title: 'failed to update', description: err.message, variant: 'error' });
 setSubmitting(false);
 }
 };

 if (loading) {
 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <p className="page-subtitle">// loading...</p>
 </section>
 </main>
 </div>
 );
 }

 if (error && !project) {
 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 404 · not found</span>
 </div>
 <h1 className="page-title">project not found.</h1>
 <Link href={`/orgs/${tenantId}/projects`} className="btn btn-primary" style={{ marginTop: 'var(--space-5)' }}>
 ← back to projects
 </Link>
 </section>
 </main>
 </div>
 );
 }

 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// {tenantId} · {projectId}</span>
 </div>
 <h1 className="page-title">
 edit<br />
 <span className="page-title-accent">project.</span>
 </h1>
 <p className="page-subtitle">
 updating {project?.name ?? projectId}
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${tenantId}/projects/${projectId}`} className="btn btn-ghost">
 ← back
 </Link>
 </div>
 </div>
 </section>

 <div style={{ maxWidth: 720, margin: 'var(--space-7) auto var(--space-9)' }}>
 <form onSubmit={onSave} className="card" style={{ padding: 'var(--space-6)' }}>
 <span className="card-number">// 01 · project details</span>

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
 gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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
 }}>
 // {t.name}
 </div>
 <div style={{
 fontSize: 11,
 color: 'var(--fg-quaternary)',
 fontFamily: 'var(--font-mono)',
 letterSpacing: '0.05em',
 marginTop: 4,
 }}>
 {t.desc}
 </div>
 </button>
 );
 })}
 </div>
 </div>

 <div>
 <label htmlFor="proj-status" className="form-label">// status</label>
 <select
 id="proj-status"
 value={status}
 onChange={(e) => setStatus(e.target.value)}
 className="form-input"
 >
 <option value="planning">planning</option>
 <option value="active">active</option>
 <option value="at_risk">at risk</option>
 <option value="delayed">delayed</option>
 <option value="completed">completed</option>
 <option value="cancelled">cancelled</option>
 </select>
 </div>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--line)' }}>
 <Link href={`/orgs/${tenantId}/projects/${projectId}`} className="btn btn-ghost">
 ← cancel
 </Link>
 <button
 type="submit"
 disabled={submitting || !name || !location}
 className="btn btn-primary"
 style={{ opacity: (submitting || !name || !location) ? 0.6 : 1 }}
 >
 {submitting ? '// saving...' : 'save changes →'}
 </button>
 </div>
 </form>
 </div>
 </main>
 </div>
 );
}
