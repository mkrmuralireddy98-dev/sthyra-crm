'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/top-nav';
import { toast } from '@/components/toast';
import { createOrg } from '@/lib/api';

const COUNTRIES = [
 { code: 'US', name: 'United States', flag: '🇺🇸' },
 { code: 'CA', name: 'Canada', flag: '🇨🇦' },
 { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
 { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
 { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
 { code: 'DE', name: 'Germany', flag: '🇩🇪' },
 { code: 'FR', name: 'France', flag: '🇫🇷' },
 { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
 { code: 'ES', name: 'Spain', flag: '🇪🇸' },
 { code: 'IT', name: 'Italy', flag: '🇮🇹' },
 { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
 { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
 { code: 'IN', name: 'India', flag: '🇮🇳' },
 { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
 { code: 'JP', name: 'Japan', flag: '🇯🇵' },
 { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
 { code: 'AU', name: 'Australia', flag: '🇦🇺' },
 { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
] as const;

const PLANS = [
 { id: 'free', name: 'free', desc: '14-day trial · 1 project', price: '$0' },
 { id: 'pro', name: 'pro', desc: 'production-ready · 99.9% SLA', price: '$49/user/mo' },
 { id: 'enterprise', name: 'enterprise', desc: 'SSO + dedicated infra', price: 'custom' },
 { id: 'gov', name: 'gov', desc: 'FedRAMP / IL4 / IL5', price: 'custom' },
] as const;

export default function NewOrgPage() {
 const router = useRouter();
 const [name, setName] = useState('');
 const [country, setCountry] = useState<string>('US');
 const [plan, setPlan] = useState<string>('pro');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) || 'unnamed';
 const orgId = `org_${slug}`;
 const selectedCountry = COUNTRIES.find(c => c.code === country);

 const onSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 setSubmitting(true);

 try {
 const created = await createOrg({ name, country, plan });
 toast({
 title: 'organization created',
 description: `${created.id} · ${created.name} · ${country}`,
 });
 // Redirect to the new org
 router.push(`/orgs/${created.id}`);
 } catch (err: any) {
 const msg = err?.message ?? 'failed to create org';
 setError(msg);
 toast({
 title: 'failed to create org',
 description: msg,
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
 <span>// platform · new organization · admin-service:9100</span>
 </div>
 <h1 className="page-title">
 new<br />
 <span className="page-title-accent">tenant.</span>
 </h1>
 <p className="page-subtitle">
 the org is the top-level tenant · all projects, captures, and users belong to it.
 </p>
 </div>
 <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
 <Link href="/admin" className="btn btn-ghost">
 ← back
 </Link>
 <Link href="/orgs" className="btn btn-ghost">
 view all
 </Link>
 </div>
 </div>
 </section>

 <div style={{ maxWidth: 720, margin: 'var(--space-7) auto var(--space-9)' }}>
 <form onSubmit={onSubmit} className="card" style={{ padding: 'var(--space-6)' }}>
 <span className="card-number">// 01 · tenant setup</span>

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
 autoFocus
 placeholder="abhignya constructions"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="form-input"
 style={{ fontSize: 18, padding: 'var(--space-3) 0' }}
 />
 <div style={{
 marginTop: 'var(--space-2)',
 fontFamily: 'var(--font-mono)',
 fontSize: 11,
 color: 'var(--fg-quaternary)',
 letterSpacing: '0.05em',
 }}>
 // slug: {orgId}
 </div>
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
 gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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
 marginBottom: 'var(--space-2)',
 }}>
 // {p.name}
 </div>
 <div style={{
 fontFamily: 'var(--font-display)',
 fontSize: 24,
 fontWeight: 700,
 letterSpacing: '-0.02em',
 color: active ? 'var(--fg)' : 'var(--fg-muted)',
 marginBottom: 4,
 }}>
 {p.price}
 </div>
 <div style={{
 fontSize: 11,
 color: 'var(--fg-quaternary)',
 fontFamily: 'var(--font-mono)',
 letterSpacing: '0.05em',
 }}>
 {p.desc}
 </div>
 </button>
 );
 })}
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
 <button
 type="submit"
 disabled={submitting || !name}
 className="btn btn-primary"
 style={{ opacity: (submitting || !name) ? 0.6 : 1 }}
 >
 {submitting ? '// creating...' : 'create org →'}
 </button>
 </div>
 </form>
 </div>
 </main>
 </div>
 );
}

