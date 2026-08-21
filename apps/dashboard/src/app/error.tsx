'use client';

import { useEffect } from 'react';

export default function GlobalError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 console.error('Dashboard error:', error);
 }, [error]);

 return (
 <div style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 minHeight: '100vh',
 padding: 'var(--space-7)',
 }}>
 <div className="card fade-in" style={{ maxWidth: 480, textAlign: 'center' }}>
 <div style={{
 width: 48, height: 48, borderRadius: '50%',
 background: 'rgba(239, 68, 68, 0.12)',
 color: 'var(--red-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 24, marginBottom: 'var(--space-3)',
 }}>⚠</div>
 <h1 style={{ fontSize: 20, fontWeight: 590, marginBottom: 'var(--space-2)' }}>Something went wrong</h1>
 <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 'var(--space-4)' }}>
 {error.message || 'An unexpected error occurred while loading this page.'}
 </p>
 {error.digest && (
 <code style={{
 display: 'inline-block',
 padding: '4px 8px',
 background: 'var(--bg-panel)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-sm)',
 fontSize: 11,
 color: 'var(--text-quaternary)',
 fontFamily: 'var(--font-mono)',
 marginBottom: 'var(--space-4)',
 }}>
 {error.digest}
 </code>
 )}
 <div>
 <button onClick={reset} className="btn btn-primary">Try again</button>
 </div>
 </div>
 </div>
 );
}
