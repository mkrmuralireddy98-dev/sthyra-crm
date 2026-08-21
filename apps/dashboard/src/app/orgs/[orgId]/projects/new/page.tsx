'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { toast } from '@/components/toast';

export default function NewProjectPage({ params }: { params: { orgId: string } }) {
 const router = useRouter();
 const tenantId = params.orgId;
 const [name, setName] = useState('');
 const [location, setLocation] = useState('');
 const [type, setType] = useState('commercial');
 const [submitting, setSubmitting] = useState(false);

 const submit = (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);
 // Simulate project creation
 setTimeout(() => {
 setSubmitting(false);
 toast({
 title: 'Project created',
 description: `${name} has been added to your workspace`,
 variant: 'success',
 });
 router.push(`/orgs/${tenantId}/projects`);
 }, 600);
 };

 return (
 <div className="app-shell">
 <TopNav />
 <main className="app-main">
 <header className="page-header fade-in">
 <div className="page-header-content">
 <h1 className="page-title">New project</h1>
 <p className="page-subtitle">Add a new construction project to your workspace</p>
 </div>
 </header>

 <div style={{ maxWidth: 720, margin: '0 auto' }}>
 <form onSubmit={submit} className="card fade-in" style={{ padding: 28 }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
 <div>
 <label htmlFor="name" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Project name <span style={{ color: 'var(--red-500)' }}>*</span>
 </label>
 <input
 id="name"
 type="text"
 required
 autoFocus
 placeholder="Tower B — North Wing"
 value={name}
 onChange={(e) => setName(e.target.value)}
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
 <label htmlFor="location" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Location
 </label>
 <input
 id="location"
 type="text"
 placeholder="San Francisco, CA"
 value={location}
 onChange={(e) => setLocation(e.target.value)}
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
 <label htmlFor="type" style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Type
 </label>
 <select
 id="type"
 value={type}
 onChange={(e) => setType(e.target.value)}
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
 <option value="commercial">Commercial</option>
 <option value="residential">Residential</option>
 <option value="industrial">Industrial</option>
 <option value="infrastructure">Infrastructure</option>
 <option value="renovation">Renovation</option>
 </select>
 </div>
 </div>

 <div>
 <label style={{ display: 'block', fontSize: 12, fontWeight: 510, color: 'var(--text-secondary)', marginBottom: 6 }}>
 Initial BIM model
 </label>
 <div className="upload-zone" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
 <div className="upload-icon" aria-hidden="true">🏗</div>
 <div className="upload-title" style={{ fontSize: 13 }}>Drop your BIM file here</div>
 <div className="upload-subtitle">IFC, GLB, GLTF, RVT up to 500MB</div>
 <input
 type="file"
 accept=".ifc,.glb,.gltf,.rvt"
 style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
 aria-label="Upload BIM file"
 />
 </div>
 <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 8, textAlign: 'center' }}>
 You can add or replace the model later
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
 <button
 type="submit"
 disabled={submitting || !name}
 className="btn btn-primary"
 style={{ padding: '10px 20px', opacity: (submitting || !name) ? 0.6 : 1 }}
 >
 {submitting ? 'Creating...' : 'Create project →'}
 </button>
 </div>
 </form>
 </div>
 </main>
 </div>
 );
}
