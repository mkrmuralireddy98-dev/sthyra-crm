'use client';

import { useAuth } from '@/lib/role';
import { usePathname, useRouter } from 'next/navigation';

export function RoleSwitcher() {
 const { auth, setAuth } = useAuth();
 const router = useRouter();
 const pathname = usePathname();

 const switchToAdmin = () => {
 setAuth({
 role: 'admin',
 userId: 'usr_admin',
 userName: 'Platform Admin',
 orgId: null,
 orgName: null,
 });
 // Navigate to /admin unless already there
 if (pathname !== '/admin') router.push('/admin');
 };

 const switchToUser = (orgId = 'org_a') => {
 const names: Record<string, string> = {
 org_a: 'Acme Construction',
 org_b: 'BuildRight Inc',
 org_c: 'MegaStructures LLC',
 };
 setAuth({
 role: 'user',
 userId: 'usr_sarah',
 userName: 'Sarah Chen',
 orgId,
 orgName: names[orgId] ?? orgId,
 });
 // Navigate to dashboard unless already there
 if (pathname === '/admin') router.push('/');
 else if (!pathname.startsWith('/orgs/')) router.push('/');
 };

 return (
 <div style={{
 position: 'fixed',
 bottom: 24,
 left: 24,
 zIndex: 1000,
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 color: 'var(--fg-quaternary)',
 display: 'flex',
 flexDirection: 'column',
 gap: 4,
 padding: 12,
 background: 'rgba(10, 10, 10, 0.92)',
 backdropFilter: 'blur(20px)',
 border: '1px solid var(--line-strong)',
 }}>
 <div style={{ letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
 // view as
 </div>
 <button
 onClick={switchToAdmin}
 style={{
 padding: '6px 10px',
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
 transition: 'all 0.15s ease',
 }}
 onMouseEnter={(e) => {
 if (auth.role !== 'admin') e.currentTarget.style.borderColor = 'var(--accent)';
 }}
 onMouseLeave={(e) => {
 if (auth.role !== 'admin') e.currentTarget.style.borderColor = 'var(--line)';
 }}
 >
 admin
 </button>
 <button
 onClick={() => switchToUser('org_a')}
 style={{
 padding: '6px 10px',
 background: auth.role === 'user' && auth.orgId === 'org_a' ? 'var(--accent)' : 'transparent',
 color: auth.role === 'user' && auth.orgId === 'org_a' ? '#000' : 'var(--fg-muted)',
 border: '1px solid ' + (auth.role === 'user' && auth.orgId === 'org_a' ? 'var(--accent)' : 'var(--line)'),
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 letterSpacing: '0.05em',
 cursor: 'pointer',
 textAlign: 'left',
 fontWeight: auth.role === 'user' && auth.orgId === 'org_a' ? 700 : 400,
 textTransform: 'uppercase',
 transition: 'all 0.15s ease',
 }}
 onMouseEnter={(e) => {
 if (!(auth.role === 'user' && auth.orgId === 'org_a')) e.currentTarget.style.borderColor = 'var(--accent)';
 }}
 onMouseLeave={(e) => {
 if (!(auth.role === 'user' && auth.orgId === 'org_a')) e.currentTarget.style.borderColor = 'var(--line)';
 }}
 >
 user · org_a
 </button>
 <button
 onClick={() => switchToUser('org_b')}
 style={{
 padding: '6px 10px',
 background: auth.role === 'user' && auth.orgId === 'org_b' ? 'var(--accent)' : 'transparent',
 color: auth.role === 'user' && auth.orgId === 'org_b' ? '#000' : 'var(--fg-muted)',
 border: '1px solid ' + (auth.role === 'user' && auth.orgId === 'org_b' ? 'var(--accent)' : 'var(--line)'),
 fontFamily: 'var(--font-mono)',
 fontSize: 10,
 letterSpacing: '0.05em',
 cursor: 'pointer',
 textAlign: 'left',
 fontWeight: auth.role === 'user' && auth.orgId === 'org_b' ? 700 : 400,
 textTransform: 'uppercase',
 transition: 'all 0.15s ease',
 }}
 onMouseEnter={(e) => {
 if (!(auth.role === 'user' && auth.orgId === 'org_b')) e.currentTarget.style.borderColor = 'var(--accent)';
 }}
 onMouseLeave={(e) => {
 if (!(auth.role === 'user' && auth.orgId === 'org_b')) e.currentTarget.style.borderColor = 'var(--line)';
 }}
 >
 user · org_b
 </button>
 </div>
 );
}
