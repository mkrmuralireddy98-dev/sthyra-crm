'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
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
 const { createIssue } = await import('@/lib/api');
 const created = await createIssue({
 tenantId,
 projectId: 'prj_demo',
 title,
 description,
 severity,
 trade,
 });
 toast({
 title: 'issue created',
 description: `${created.id} → ${created.title}`,
 });
 router.push(`/orgs/${tenantId}/issues`);
 } catch (e: any) {
 setError(e.message ?? 'failed to create issue');
 toast({
 title: 'could not create issue',
 description: e.message,
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
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// new · field issue</span>
 </div>
 <h1 className="page-title">file a <span className="page-title-accent">punch item.</span></h1>
 <p className="page-subtitle">
 capture details so the right team gets notified.
 photos, location, and trade auto-route the work.
 </p>
 </section>

 <div style={{ maxWidth: 720, margin: 'var(--space-7) auto', padding: '0 0 var(--space-9)' }}>
 <form onSubmit={submit} className="card">
 <span className="card-number">// 01</span>

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

 <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
 <div>
 <label htmlFor="title" className="form-label">// title *</label>
 <input
 id="title"
 type="text"
 required
 autoFocus
 placeholder="concrete spalling on column 3-B"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 className="form-input"
 />
 </div>

 <div>
 <label htmlFor="description" className="form-label">// description</label>
 <textarea
 id="description"
 rows={4}
 placeholder="add details — what you saw, when, photos to attach…"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="form-input"
 style={{ resize: 'vertical', minHeight: 100 }}
 />
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
 <div>
 <label htmlFor="severity" className="form-label">// severity</label>
 <select
 id="severity"
 value={severity}
 onChange={(e) => setSeverity(e.target.value)}
 className="form-input"
 >
 <option value="low">low</option>
 <option value="medium">medium</option>
 <option value="high">high</option>
 <option value="critical">critical</option>
 </select>
 </div>
 <div>
 <label htmlFor="trade" className="form-label">// trade</label>
 <select
 id="trade"
 value={trade}
 onChange={(e) => setTrade(e.target.value)}
 className="form-input"
 >
 <option value="general">general</option>
 <option value="concrete">concrete</option>
 <option value="steel">steel</option>
 <option value="mep">mep</option>
 <option value="finishes">finishes</option>
 <option value="electrical">electrical</option>
 <option value="plumbing">plumbing</option>
 </select>
 </div>
 </div>

 <div>
 <label className="form-label">// photos</label>
 <div className="upload-zone">
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' }}>
 // drop files here
 </div>
 <div className="upload-title">drag photos or click to upload</div>
 <div className="upload-subtitle">JPG, PNG · up to 10MB each · multi-select OK</div>
 <input
 type="file"
 multiple
 accept="image/*"
 style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
 aria-label="Upload photos"
 />
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--line)' }}>
 <button
 type="button"
 onClick={() => router.back()}
 className="btn btn-ghost"
 >
 ← cancel
 </button>
 <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>
 ⌘ ↵ submit
 </span>
 <button
 type="submit"
 disabled={submitting || !title}
 className="btn btn-primary"
 style={{ opacity: (submitting || !title) ? 0.6 : 1 }}
 >
 {submitting ? '// creating...' : 'create issue →'}
 </button>
 </div>
 </div>
 </form>
 </div>
 </main>
 </div>
 );
}
