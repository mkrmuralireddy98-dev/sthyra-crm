export default function Loading() {
 return (
 <div style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 minHeight: '60vh',
 flexDirection: 'column',
 gap: 'var(--space-3)',
 }}>
 <div style={{
 width: 32,
 height: 32,
 border: '3px solid var(--border-default)',
 borderTopColor: 'var(--teal-500)',
 borderRadius: '50%',
 animation: 'spin 800ms linear infinite',
 }}/>
 <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</p>
 <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
 </div>
 );
}
