'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { toast } from '@/components/toast';
import { getOrg, updateOrg, suspendOrg, resumeOrg, deleteOrg, type Org } from '@/lib/api';

const COUNTRIES = [
 { code: 'US', name: 'United States', flag: '🇺🇸' },
 { code: 'CA', name: 'Canada', flag: '🇨🇦' },
 { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
 { code: 'DE', name: 'Germany', flag: '🇩🇪' },
 { code: 'IN', name: 'India', flag: '🇮🇳' },
 { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
 { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
 { code: 'JP', name: 'Japan', flag: '🇯🇵' },
 { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
 { code: 'AU', name: 'Australia', flag: '🇦🇺' },
] as const;

const PLANS = [
 { id: 'free', name: 'free' },
 { id: 'pro', name: 'pro' },
 { id: 'enterprise', name: 'enterprise' },
 { id: 'gov', name: 'gov' },
] as const;

export default function EditOrgPage({ params }: { params: { orgId: string } }) {
 const router = useRouter();
 const orgId = params.orgId;
 const [org, setOrg] = useState<Org | null>(null);
 const [auth, setAuth] = useState<{ role: string } | null>(null);

 // Read auth from localStorage
 useEffect(() => {
 try {
 const raw = localStorage.getItem('sthyra-auth');
 if (raw) setAuth(JSON.parse(raw));
 } catch {}
 if (typeof window !== 'undefined' && !localStorage.getItem('sthyra-auth')) {
 setAuth({ role: 'user' });
 }
 }, []);
 const [name, setName] = useState('');
 const [country, setCountry] = useState('US');
 const [plan, setPlan] = useState('pro');
 const [status, setStatus] = useState('active');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [confirmDelete, setConfirmDelete] = useState(false);

 useEffect(() => {
 (async () => {
 try {
 const fetched = await getOrg(orgId);
 if (!fetched) {
 setError('Organization not found');
 setLoading(false);
 return;
 }
 setOrg(fetched);
 setName(fetched.name);
 setCountry(fetched.country ?? fetched.region ?? 'US');
 setPlan(fetched.plan);
 setStatus(fetched.status);
 setLoading(false);
 } catch (e: any) {
 setError(e.message ?? 'Failed to load org');
 setLoading(false);
 }
 })();
 }, [orgId]);

 const onSave = async (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);
 setError(null);
 try {
 await updateOrg(orgId, { name, country, plan, status });
 toast({ title: 'organization updated', description: `${name} · ${country} · ${plan}` });
 router.push(`/orgs/${orgId}`);
 } catch (err: any) {
 setError(err.message ?? 'failed to update');
 toast({ title: 'failed to update', description: err.message, variant: 'error' });
 setSubmitting(false);
 }
 };

 const onSuspend = async () => {
 try {
 await suspendOrg(orgId, 'suspended via admin UI');
 toast({ title: 'org suspended', description: orgId });
 setStatus('suspended');
 } catch (err: any) {
 toast({ title: 'failed', description: err.message, variant: 'error' });
 }
 };

 const onResume = async () => {
 try {
 await resumeOrg(orgId, 'resumed via admin UI');
 toast({ title: 'org resumed', description: orgId });
 setStatus('active');
 } catch (err: any) {
 toast({ title: 'failed', description: err.message, variant: 'error' });
 }
 };

 const onDelete = async () => {
 try {
 await deleteOrg(orgId, 'deleted via admin UI');
 toast({ title: 'org deleted', description: `${name} removed` });
 router.push('/orgs');
 } catch (err: any) {
 toast({ title: 'failed to delete', description: err.message, variant: 'error' });
 setConfirmDelete(false);
 }
 };

 // Role gate — only admins can edit orgs
if (auth && auth.role !== 'admin') {
 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div className="page-eyebrow"><span className="page-eyebrow-marker" /><span>// 403 · forbidden</span></div>
 <h1 className="page-title">admin only<span className="page-title-accent">.</span></h1>
 <p className="page-subtitle">switch to admin in the bottom-left role selector to edit organizations.</p>
 <Link href={`/orgs/\${orgId}`} className="btn btn-primary" style={{ marginTop: 'var(--space-5)' }}>← back</Link>
 </section>
 </main>
 </div>
 );
}

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

 if (error && !org) {
 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// 404 · not found</span>
 </div>
 <h1 className="page-title">organization not found.</h1>
 <Link href="/admin" className="btn btn-primary" style={{ marginTop: 'var(--space-5)' }}>
 ← back to admin
 </Link>
 </section>
 </main>
 </div>
 );
 }

 const selectedCountry = COUNTRIES.find(c => c.code === country);

 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <section className="page-mast">
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
 <div>
 <div className="page-eyebrow">
 <span className="page-eyebrow-marker" />
 <span>// admin · edit organization · {orgId}</span>
 </div>
 <div style={{ marginTop: 'var(--space-3)' }}>
 <span className={`badge ${status === 'active' ? 'badge-success' : 'badge-warning'}`}>
 <span className="badge-dot" />{status}
 </span>
 </div>
 <h1 className="page-title">edit<br /><span className="page-title-accent">tenant.</span></h1>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href={`/orgs/${orgId}`} className="btn btn-ghost">← back</Link>
 </div>
 </div>
 </section>

 <div style={{ maxWidth: 720, margin: 'var(--space-7) auto var(--space-9)' }}>
 <form onSubmit={onSave} className="card" style={{ padding: 'var(--space-6)' }}>
 <span className="card-number">// 01 · org details</span>

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
 <label htmlFor="org-name" className="form-label">// organization name *</label>
 <input
 id="org-name"
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="form-input"
 style={{ fontSize: 18, padding: 'var(--space-3) 0' }}
 />
 </div>

 <div>
 <label htmlFor="org-country" className="form-label">// country *</label>
 <select
 id="org-country"
 value={country}
 onChange={(e) => setCountry(e.target.value)}
 className="form-input"
 style={{ fontSize: 16 }}
 >
 {COUNTRIES.map((c) => (
 <option key={c.code} value={c.code}>
 {c.flag} {c.name}
 </option>
 ))}
 </select>
 {selectedCountry && (
 <div style={{
 marginTop: 'var(--space-3)',
 display: 'flex',
 alignItems: 'center',
 gap: 'var(--space-2)',
 padding: 'var(--space-3)',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--line)',
 }}>
 <span style={{ fontSize: 18 }}>{selectedCountry.flag}</span>
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.05em' }}>
 {selectedCountry.name} · ISO {selectedCountry.code}
 </span>
 </div>
 )}
 </div>

 <div>
 <label className="form-label">// plan</label>
 <div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
 gap: 1,
 background: 'var(--line)',
 border: '1px solid var(--line)',
 }}>
 {PLANS.map((p) => {
 const active = plan === p.id;
 return (
 <button
 key={p.id}
 type="button"
 onClick={() => setPlan(p.id)}
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
 // {p.name}
 </div>
 </button>
 );
 })}
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--line)' }}>
 <button type="button" onClick={() => router.back()} className="btn btn-ghost">
 ← cancel
 </button>
 <button type="submit" disabled={submitting} className="btn btn-primary" style={{ opacity: submitting ? 0.6 : 1 }}>
 {submitting ? '// saving...' : 'save changes →'}
 </button>
 </div>
 </form>

 {/* Admin actions */}
 <section style={{ marginTop: 'var(--space-7)' }}>
 <div className="page-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
 <span className="page-eyebrow-marker" />
 <span>// admin actions</span>
 </div>

 <div style={{
 border: '1px solid var(--line)',
 background: 'var(--bg-page)',
 }}>
 {/* Suspend / Resume */}
 <div style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 padding: 'var(--space-5)',
 borderBottom: '1px solid var(--line)',
 }}>
 <div>
 <div style={{ fontSize: 14, fontWeight: 510 }}>suspend organization</div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
 // pause access for all members · reversible
 </div>
 </div>
 {status === 'active' ? (
 <button onClick={onSuspend} className="btn btn-ghost">
 ⏸ suspend
 </button>
 ) : (
 <button onClick={onResume} className="btn btn-ghost">
 ▶ resume
 </button>
 )}
 </div>

 {/* Delete */}
 <div style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 padding: 'var(--space-5)',
 }}>
 <div>
 <div style={{ fontSize: 14, fontWeight: 510, color: '#ff4444' }}>delete organization</div>
 <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
 // permanent · cannot be undone
 </div>
 </div>
 {confirmDelete ? (
 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
 <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost">
 cancel
 </button>
 <button onClick={onDelete} className="btn" style={{ background: '#ff4444', color: '#fff', borderColor: '#ff4444' }}>
 confirm delete
 </button>
 </div>
 ) : (
 <button onClick={() => setConfirmDelete(true)} className="btn" style={{ background: 'transparent', color: '#ff4444', borderColor: '#ff4444' }}>
 delete
 </button>
 )}
 </div>
 </div>
 </section>
 </div>
 </main>
 </div>
 );
}

