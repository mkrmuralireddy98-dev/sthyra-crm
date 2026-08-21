'use client';

import { useAuth } from '@/lib/role';

export function RoleSwitcher() {
 const { auth, setAuth } = useAuth();

 const switchToAdmin = () => setAuth({
 role: 'admin',
 userId: 'usr_admin',
 userName: 'Platform Admin',
 orgId: null,
 orgName: null,
 });

 const switchToUser = () => setAuth({
 role: 'user',
 userId: 'usr_sarah',
 userName: 'Sarah Chen',
 orgId: 'org_a',
 orgName: 'Acme Construction',
 });

 return (
 <div style={{
 position: 'fixed',
 bottom: 80,
 left: 16,
 zIndex: 90,
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 color: 'var(--fg-quaternary)',
 display: 'flex',
 flexDirection: 'column',
 gap: 4,
 }}>
 <div style={{ letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>
 // view as
 </div>
 <button
 onClick={switchToAdmin}
 style={{
 padding: '4px 8px',
 background: auth.role === 'admin' ? 'var(--accent)' : 'transparent',
 color: auth.role === 'admin' ? '#000' : 'var(--fg-muted)',
 border: '1px solid ' + (auth.role === 'admin' ? 'var(--accent)' : 'var(--line)'),
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 letterSpacing: '0.05em',
 cursor: 'pointer',
 textAlign: 'left',
 fontWeight: auth.role === 'admin' ? 700 : 400,
 textTransform: 'uppercase',
 }}
 >
 admin
 </button>
 <button
 onClick={switchToUser}
 style={{
 padding: '4px 8px',
 background: auth.role === 'user' ? 'var(--accent)' : 'transparent',
 color: auth.role === 'user' ? '#000' : 'var(--fg-muted)',
 border: '1px solid ' + (auth.role === 'user' ? 'var(--accent)' : 'var(--line)'),
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 letterSpacing: '0.05em',
 cursor: 'pointer',
 textAlign: 'left',
 fontWeight: auth.role === 'user' ? 700 : 400,
 textTransform: 'uppercase',
 }}
 >
 user · org_a
 </button>
 </div>
 );
}
