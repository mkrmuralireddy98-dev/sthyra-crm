'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/role';

const ADMIN_NAV = [
 { href: '/admin', label: 'admin', section: '00' },
 { href: '/orgs', label: 'orgs', section: '01' },
 { href: '/orgs/org_a/workflows', label: 'workflows', section: '02' },
 { href: '/orgs/org_a/integrations', label: 'integrations', section: '03' },
 { href: '/orgs/org_a/reports', label: 'reports', section: '04' },
];

const USER_NAV = [
 { href: '/', label: 'dashboard', section: '00' },
 { href: '/orgs/org_a/projects', label: 'projects', section: '01' },
 { href: '/orgs/org_a/captures', label: 'captures', section: '02' },
 { href: '/orgs/org_a/issues', label: 'issues', section: '03' },
 { href: '/orgs/org_a/workflows', label: 'workflows', section: '04' },
 { href: '/orgs/org_a/integrations', label: 'integrations', section: '05' },
 { href: '/orgs/org_a/reports', label: 'reports', section: '06' },
];

export function TopNav() {
 const pathname = usePathname();
 const { auth } = useAuth();
 const items = auth.role === 'admin' ? ADMIN_NAV : USER_NAV;

 const isActive = (href: string) => {
 if (href === '/') return pathname === '/';
 if (href === '/admin') return pathname.startsWith('/admin');
 if (href === '/orgs') return pathname === '/orgs';
 return pathname.startsWith(href);
 };

 return (
 <header className="app-nav">
 <Link href={auth.role === 'admin' ? '/admin' : '/'} className="app-nav-brand">
 <span className="sthyra-logo">sthyra</span>
 <span className="app-nav-brand-tag">
 {auth.role === 'admin' ? 'platform · admin' : `${auth.orgName ?? auth.orgId} · user`}
 </span>
 </Link>

 <nav className="app-nav-links" aria-label="Primary">
 {items.map((item) => {
 const active = isActive(item.href);
 const href = auth.role === 'user' && auth.orgId && item.href.includes('org_a')
 ? item.href.replace('org_a', auth.orgId)
 : item.href;
 return (
 <Link
 key={item.href}
 href={href}
 className={`app-nav-link ${active ? 'active' : ''}`}
 data-section={item.section}
 >
 {item.label}
 </Link>
 );
 })}
 </nav>

 <div className="app-nav-actions">
 <span className="app-nav-brand-tag" style={{ marginRight: 8 }}>
 {auth.role === 'admin' ? (
 <>
 <span style={{ color: 'var(--accent)' }}>●</span> {auth.userName}
 </>
 ) : (
 <>
 <span style={{ color: 'var(--accent)' }}>●</span> {auth.userName}
 </>
 )}
 </span>
 <Link href="/site" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
 site
 </Link>
 <Link href="/signin" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>
 sign out
 </Link>
 </div>
 </header>
 );
}

export function LiveMarquee() {
 const items = [
 { label: 'live', value: '8 issues detected', accent: true },
 { label: 'projects', value: '12 active' },
 { label: 'captures', value: '24 uploaded this week' },
 { label: 'storage', value: '1.2 GB / 50 GB' },
 { label: 'api', value: '99.97% uptime' },
 { label: 'build', value: '13 / 13 services healthy' },
 { label: 'team', value: '5 online' },
 { label: 'next sync', value: '14:32 UTC' },
 ];

 return (
 <div className="marquee">
 <div className="marquee-track">
 {[...items, ...items].map((item, i) => (
 <div key={i} className="marquee-item">
 {item.accent && <span className="marquee-dot" />}
 <span>{item.label}</span>
 <span style={{ color: 'var(--accent)' }}>{item.value}</span>
 </div>
 ))}
 </div>
 </div>
 );
}
