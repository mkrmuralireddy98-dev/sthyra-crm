'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { toast } from '@/components/toast';

export default function NewIssuePage({ params }: { params: { orgId: string } }) {
 const router = useRouter();
 const tenantId = params.orgId;
 const [title, setTitle] = useState('');
 const [description, setDescription] = useState('');
 const [severity, setSeverity] = useState('medium');
 const [trade, setTrade] = useState('general');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const submit = async (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);
 setError(null);
 try {
 const idempotencyKey = `create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
 const res = await fetch('http://127.0.0.1:9091/v1/projects/prj_demo/issues', {
 method: 'POST',
 headers: {
 'x-tenant-id': tenantId,
 'x-idempotency-key': idempotencyKey,
 'content-type': 'application/json',
 },
 body: JSON.stringify({
 title,
 description,
 severity,
 trade,
 }),
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const data = await res.json();
 toast({
 title: 'Issue created',
 description: `Issue ${data.id} is now in the punch list`,
 variant: 'success',
 });
 router.push(`/orgs/${tenantId}/issues`);
 } catch (e: any) {
 setError(e.message ?? 'Failed to create issue');
 toast({
 title: 'Could not create issue',
 description: e.message,
 variant: 'error',
 });
 setSubmitting(false);
 }
 };

 return (
 <div className="app-shell">
 <Sidebar currentOrgId={tenantId} currentPath={`/orgs/${tenantId}/issues`} />
 <main className="main">
 <header className="page-header fade-in">
 <div className="page-header-content">
 <h1 className="page-title">New issue</h1>
 <p className="page-subtitle">Create a field issue in the punch list</p>
 </div>
 </header>

 <div style={{ maxWidth: 720, margin: '0 auto' }}>
 <form onSubmit={submit} className="card fade-in" style={{ padding: 28 }}>
 {error && (
 <div style={{
 padding: '10px 14px',
 background: 'rgba(239, 68, 68, 0.12)',
 border: '1px solid rgba(239, 68, 68, 0.3)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--red-500)',
 fontSize: 13,
 marginBottom: 20,
 }}>
 ⚠ {error}
 </div>
 )}

 <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
 <div>
 <label htmlFor="title" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Title <span style={{ color: 'var(--red-500)' }}>*</span>
 </label>
 <input
 id="title"
 type="text"
 required
 autoFocus
 placeholder="Concrete spalling on column 3-B"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 style={{
 width: '100%',
 padding: '10px 12px',
 background: 'var(--bg-panel)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--text-primary)',
 fontSize: 14,
 outline: 'none',
 fontFamily: 'inherit',
 }}
 />
 </div>

 <div>
 <label htmlFor="description" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Description
 </label>
 <textarea
 id="description"
 rows={4}
 placeholder="Add details — what you saw, when, photos to attach…"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 style={{
 width: '100%',
 padding: '10px 12px',
 background: 'var(--bg-panel)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--text-primary)',
 fontSize: 14,
 outline: 'none',
 resize: 'vertical',
 fontFamily: 'inherit',
 minHeight: 100,
 }}
 />
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
 <div>
 <label htmlFor="severity" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Severity
 </label>
 <select
 id="severity"
 value={severity}
 onChange={(e) => setSeverity(e.target.value)}
 style={{
 width: '100%',
 padding: '10px 12px',
 background: 'var(--bg-panel)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--text-primary)',
 fontSize: 14,
 outline: 'none',
 fontFamily: 'inherit',
 }}
 >
 <option value="low">Low</option>
 <option value="medium">Medium</option>
 <option value="high">High</option>
 <option value="critical">Critical</option>
 </select>
 </div>
 <div>
 <label htmlFor="trade" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Trade
 </label>
 <select
 id="trade"
 value={trade}
 onChange={(e) => setTrade(e.target.value)}
 style={{
 width: '100%',
 padding: '10px 12px',
 background: 'var(--bg-panel)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--text-primary)',
 fontSize: 14,
 outline: 'none',
 fontFamily: 'inherit',
 }}
 >
 <option value="general">General</option>
 <option value="concrete">Concrete</option>
 <option value="steel">Steel</option>
 <option value="mep">MEP</option>
 <option value="finishes">Finishes</option>
 <option value="electrical">Electrical</option>
 <option value="plumbing">Plumbing</option>
 </select>
 </div>
 </div>

 <div>
 <label htmlFor="photos" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Photos
 </label>
 <div className="upload-zone" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
 <div className="upload-icon" aria-hidden="true">📷</div>
 <div className="upload-title" style={{ fontSize: 13 }}>Drag photos here or click to upload</div>
 <div className="upload-subtitle">JPG, PNG up to 10MB each</div>
 <input
 id="photos"
 type="file"
 multiple
 accept="image/*"
 style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
 aria-label="Upload photos"
 />
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
 <button
 type="button"
 onClick={() => router.back()}
 className="btn btn-ghost"
 >
 Cancel
 </button>
 <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
 <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
 <kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 6px', background: 'var(--bg-elevated)', borderRadius: 3, fontSize: 10 }}>⌘ ↵</kbd> to submit
 </span>
 <button
 type="submit"
 disabled={submitting || !title}
 className="btn btn-primary"
 style={{ padding: '10px 20px', opacity: (submitting || !title) ? 0.6 : 1 }}
 >
 {submitting ? 'Creating...' : 'Create issue →'}
 </button>
 </div>
 </div>
 </form>
 </div>
 </main>
 </div>
 );
}
