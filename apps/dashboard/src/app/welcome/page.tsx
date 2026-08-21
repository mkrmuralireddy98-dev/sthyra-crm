'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
 const router = useRouter();
 const [step, setStep] = useState(1);
 const [formData, setFormData] = useState({
 orgName: '',
 region: 'us-east',
 plan: 'pro',
 projectName: '',
 projectLocation: '',
 });

 const steps = [
 { n: 1, title: 'Welcome' },
 { n: 2, title: 'Organization' },
 { n: 3, title: 'First project' },
 { n: 4, title: 'Ready' },
 ];

 const next = () => setStep(s => Math.min(4, s + 1));
 const back = () => setStep(s => Math.max(1, s - 1));

 const finish = () => {
 // Mark as onboarded
 localStorage.setItem('sthyra-onboarded', 'true');
 localStorage.setItem('sthyra-org', formData.orgName);
 router.push('/');
 };

 return (
 <div style={{
 minHeight: '100vh',
 background: 'var(--bg-page)',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 padding: '64px 24px',
 }}>
 <div style={{ width: '100%', maxWidth: 640 }}>
 {/* Logo */}
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48, justifyContent: 'center' }}>
 <span className="sidebar-brand-mark" style={{ width: 32, height: 32, fontSize: 14 }}>S</span>
 <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>Sthyra CRM</span>
 </div>

 {/* Progress */}
 <div style={{ marginBottom: 48 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
 {steps.map(s => (
 <div key={s.n} style={{
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 gap: 8,
 flex: 1,
 }}>
 <div style={{
 width: 28,
 height: 28,
 borderRadius: '50%',
 background: step >= s.n ? 'var(--teal-500)' : 'var(--bg-elevated)',
 color: step >= s.n ? 'white' : 'var(--text-quaternary)',
 border: '1px solid ' + (step >= s.n ? 'var(--teal-500)' : 'var(--border-default)'),
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: 12,
 fontWeight: 510,
 transition: 'all 200ms var(--ease-out)',
 }}>
 {step > s.n ? '✓' : s.n}
 </div>
 <div style={{
 fontSize: 11,
 color: step >= s.n ? 'var(--text-primary)' : 'var(--text-quaternary)',
 fontWeight: step === s.n ? 510 : 400,
 }}>
 {s.title}
 </div>
 </div>
 ))}
 </div>
 {/* Progress bar */}
 <div style={{ height: 2, background: 'var(--bg-elevated)', borderRadius: 1, overflow: 'hidden' }}>
 <div style={{
 height: '100%',
 background: 'var(--teal-500)',
 width: `${(step / 4) * 100}%`,
 transition: 'width 300ms var(--ease-out)',
 }} />
 </div>
 </div>

 {/* Step content */}
 <div className="card fade-in" style={{ padding: 40, marginTop: 32 }}>
 {step === 1 && (
 <div style={{ textAlign: 'center' }}>
 <div style={{
 width: 64, height: 64,
 background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))',
 borderRadius: 'var(--radius-xl)',
 display: 'inline-flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: 28,
 marginBottom: 20,
 boxShadow: '0 8px 32px var(--teal-glow)',
 }}>
 👋
 </div>
 <h2 style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.5px', marginBottom: 8 }}>
 Welcome to Sthyra CRM
 </h2>
 <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
 Visual intelligence for the built world.<br/>
 Let's get your workspace set up in 3 quick steps.
 </p>
 <button onClick={next} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14 }}>
 Let's go →
 </button>
 </div>
 )}

 {step === 2 && (
 <div>
 <h2 style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.3px', marginBottom: 8 }}>
 Tell us about your organization
 </h2>
 <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
 This becomes your tenant — the workspace for your team.
 </p>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
 <div>
 <label htmlFor="orgName" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Organization name
 </label>
 <input
 id="orgName"
 type="text"
 required
 placeholder="Acme Construction"
 value={formData.orgName}
 onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
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
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
 <div>
 <label htmlFor="region" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Region
 </label>
 <select
 id="region"
 value={formData.region}
 onChange={(e) => setFormData({ ...formData, region: e.target.value })}
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
 <option value="us-east">US East (Virginia)</option>
 <option value="us-west">US West (Oregon)</option>
 <option value="eu-west">EU West (Ireland)</option>
 <option value="ap-southeast">AP Southeast (Singapore)</option>
 </select>
 </div>
 <div>
 <label htmlFor="plan" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Plan
 </label>
 <select
 id="plan"
 value={formData.plan}
 onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
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
 <option value="starter">Starter · Free 14 days</option>
 <option value="pro">Pro · $49/user/mo</option>
 <option value="enterprise">Enterprise · Custom</option>
 </select>
 </div>
 </div>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
 <button onClick={back} className="btn btn-ghost">← Back</button>
 <button onClick={next} disabled={!formData.orgName} className="btn btn-primary" style={{ opacity: formData.orgName ? 1 : 0.5 }}>
 Continue →
 </button>
 </div>
 </div>
 )}

 {step === 3 && (
 <div>
 <h2 style={{ fontSize: 22, fontWeight: 510, letterSpacing: '-0.3px', marginBottom: 8 }}>
 Create your first project
 </h2>
 <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
 You can add captures, BIM models, and team members after setup.
 </p>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
 <div>
 <label htmlFor="projectName" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Project name
 </label>
 <input
 id="projectName"
 type="text"
 placeholder="Tower B — North Wing"
 value={formData.projectName}
 onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
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
 <label htmlFor="projectLocation" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Location
 </label>
 <input
 id="projectLocation"
 type="text"
 placeholder="San Francisco, CA"
 value={formData.projectLocation}
 onChange={(e) => setFormData({ ...formData, projectLocation: e.target.value })}
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
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
 <button onClick={back} className="btn btn-ghost">← Back</button>
 <button onClick={next} className="btn btn-primary">
 Create project →
 </button>
 </div>
 </div>
 )}

 {step === 4 && (
 <div style={{ textAlign: 'center' }}>
 <div style={{
 width: 64, height: 64,
 background: 'rgba(16, 185, 129, 0.12)',
 borderRadius: '50%',
 display: 'inline-flex',
 alignItems: 'center',
 justifyContent: 'center',
 marginBottom: 20,
 border: '1px solid rgba(16, 185, 129, 0.3)',
 }}>
 <span style={{ fontSize: 28, color: 'var(--green-500)' }}>✓</span>
 </div>
 <h2 style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.5px', marginBottom: 8 }}>
 You're all set!
 </h2>
 <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
 Your workspace <strong style={{ color: 'var(--text-primary)' }}>{formData.orgName || 'Acme Construction'}</strong> is ready.
 Let's start by exploring your dashboard.
 </p>

 <div style={{
 background: 'var(--bg-panel)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 padding: 16,
 marginBottom: 24,
 textAlign: 'left',
 }}>
 <div style={{ fontSize: 11, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 8 }}>
 Tip — Keyboard shortcuts
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: 'var(--text-tertiary)' }}>Open command palette</span>
 <span><kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 6px', background: 'var(--bg-elevated)', borderRadius: 3, fontSize: 11 }}>⌘ K</kbd></span>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: 'var(--text-tertiary)' }}>Jump to issues</span>
 <span><kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 6px', background: 'var(--bg-elevated)', borderRadius: 3, fontSize: 11 }}>g i</kbd></span>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: 'var(--text-tertiary)' }}>Jump to projects</span>
 <span><kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 6px', background: 'var(--bg-elevated)', borderRadius: 3, fontSize: 11 }}>g p</kbd></span>
 </div>
 </div>
 </div>

 <button onClick={finish} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14 }}>
 Open dashboard →
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
