'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SignInPage() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [loading, setLoading] = useState(false);
 const [mode, setMode] = useState<'signin' | 'signup'>('signin');

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 // Simulate auth (real implementation would call user-service)
 await new Promise(r => setTimeout(r, 800));
 // Set tenant in localStorage so dashboard reads correct tenant
 localStorage.setItem('x-tenant-id', 'org_a');
 localStorage.setItem('user-email', email);
 window.location.href = '/';
 };

 return (
 <div style={{
 minHeight: '100vh',
 display: 'grid',
 gridTemplateColumns: '1fr 1fr',
 background: 'var(--bg-page)',
 }}>
 {/* Left — form */}
 <div style={{
 display: 'flex',
 flexDirection: 'column',
 justifyContent: 'center',
 padding: '64px',
 maxWidth: 480,
 margin: '0 auto',
 width: '100%',
 }}>
 <Link href="/site" style={{
 display: 'flex',
 alignItems: 'center',
 gap: 8,
 marginBottom: 48,
 color: 'var(--text-secondary)',
 fontSize: 13,
 }}>
 ← Back to site
 </Link>

 <h1 style={{ fontSize: 28, fontWeight: 510, letterSpacing: '-0.5px', marginBottom: 8 }}>
 {mode === 'signin' ? 'Welcome back' : 'Create your account'}
 </h1>
 <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 32 }}>
 {mode === 'signin'
 ? 'Sign in to your Sthyra CRM workspace'
 : 'Get started with 14 days free — no credit card'}
 </p>

 <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
 <div>
 <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Email
 </label>
 <input
 id="email"
 type="email"
 required
 autoComplete="email"
 placeholder="you@company.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 style={{
 width: '100%',
 padding: '10px 12px',
 background: 'var(--bg-elevated)',
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
 <label htmlFor="password" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Password
 </label>
 <input
 id="password"
 type="password"
 required
 autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
 placeholder="••••••••"
 minLength={8}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 style={{
 width: '100%',
 padding: '10px 12px',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--text-primary)',
 fontSize: 14,
 outline: 'none',
 fontFamily: 'inherit',
 }}
 />
 </div>

 {mode === 'signin' && (
 <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
 <a href="#" style={{ fontSize: 12, color: 'var(--teal-400)' }}>Forgot password?</a>
 </div>
 )}

 <button
 type="submit"
 disabled={loading}
 className="btn btn-primary"
 style={{
 padding: '12px 16px',
 fontSize: 14,
 marginTop: 8,
 opacity: loading ? 0.7 : 1,
 cursor: loading ? 'wait' : 'pointer',
 }}
 >
 {loading ? 'Signing in...' : mode === 'signin' ? 'Sign in →' : 'Create account →'}
 </button>
 </form>

 <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: 'var(--text-quaternary)', fontSize: 11 }}>
 <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
 <span>OR</span>
 <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
 </div>

 <button
 type="button"
 onClick={() => { setMode('signin'); window.location.href = '/'; localStorage.setItem('x-tenant-id', 'org_a'); }}
 style={{
 padding: '10px 14px',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--text-primary)',
 fontSize: 13,
 cursor: 'pointer',
 fontFamily: 'inherit',
 fontWeight: 510,
 }}
 >
 <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
 <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--teal-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700 }}>S</span>
 Continue with demo workspace
 </span>
 </button>

 <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 24 }}>
 {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
 <button
 type="button"
 onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
 style={{ background: 'none', border: 'none', color: 'var(--teal-400)', cursor: 'pointer', fontSize: 12, fontWeight: 510, padding: 0, fontFamily: 'inherit' }}
 >
 {mode === 'signin' ? 'Sign up' : 'Sign in'}
 </button>
 </p>
 </div>

 {/* Right — visual */}
 <div style={{
 background: 'linear-gradient(135deg, #0f1011, #08090a)',
 position: 'relative',
 overflow: 'hidden',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 padding: 64,
 }}>
 <div style={{
 position: 'absolute',
 inset: 0,
 background: 'radial-gradient(circle at 30% 40%, rgba(0, 184, 148, 0.12), transparent 50%), radial-gradient(circle at 70% 80%, rgba(245, 165, 36, 0.06), transparent 50%)',
 }} />
 <div style={{ position: 'relative', maxWidth: 360 }}>
 <div style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-lg)',
 padding: 16,
 boxShadow: 'var(--shadow-lg)',
 marginBottom: 16,
 }}>
 <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
 <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-50)', color: 'var(--teal-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>M</div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 12, fontWeight: 510, marginBottom: 2 }}>Mike Rodriguez</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>just raised an issue</div>
 </div>
 <span className="badge badge-warning" style={{ fontSize: 9 }}>high</span>
 </div>
 <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
 Concrete spalling on column 3-B. Photos uploaded, structural engineer notified.
 </div>
 </div>

 <div style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-lg)',
 padding: 16,
 boxShadow: 'var(--shadow-lg)',
 marginBottom: 16,
 transform: 'translateX(24px)',
 }}>
 <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
 <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(245,165,36,0.12)', color: 'var(--amber-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>⚡</div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 12, fontWeight: 510, marginBottom: 2 }}>Workflow triggered</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Auto-assign to structural team</div>
 </div>
 </div>
 <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
 High-severity issue detected. Workflow routed to Lisa Park + structural engineer.
 </div>
 </div>

 <div style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-lg)',
 padding: 16,
 boxShadow: 'var(--shadow-lg)',
 transform: 'translateX(-24px)',
 }}>
 <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
 <div style={{ width: 32, height: 32, borderRadius: 50 + '%', background: 'var(--green-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>✓</div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 12, fontWeight: 510, marginBottom: 2 }}>Daily report delivered</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>12 stakeholders notified</div>
 </div>
 </div>
 </div>

 <p style={{
 marginTop: 32,
 fontSize: 14,
 color: 'var(--text-secondary)',
 lineHeight: 1.6,
 textAlign: 'center',
 fontStyle: 'italic',
 }}>
 "Sthyra CRM cut our punch-list coordination time from 3 hours to 12 minutes per day."
 </p>
 <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-quaternary)', textAlign: 'center', letterSpacing: 0.5 }}>
 — Sarah Chen, Field Engineer
 </p>
 </div>
 </div>
 </div>
 );
}
