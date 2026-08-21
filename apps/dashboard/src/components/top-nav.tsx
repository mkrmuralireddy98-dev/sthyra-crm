'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
 { href: '/', label: 'dashboard', section: '00' },
 { href: '/orgs', label: 'orgs', section: '01' },
 { href: '/orgs/org_a/projects', label: 'projects', section: '02' },
 { href: '/orgs/org_a/captures', label: 'captures', section: '03' },
 { href: '/orgs/org_a/issues', label: 'issues', section: '04' },
 { href: '/orgs/org_a/workflows', label: 'workflows', section: '05' },
 { href: '/orgs/org_a/integrations', label: 'integrations', section: '06' },
 { href: '/orgs/org_a/reports', label: 'reports', section: '07' },
];

export function TopNav({ currentOrgId, currentPath: explicitPath }: { currentOrgId?: string; currentPath?: string }) {
 const pathname = explicitPath ?? usePathname();

 const isActive = (href: string) => {
 if (href === '/') return pathname === '/';
 return pathname.startsWith(href);
 };

 return (
 <header className="app-nav">
 <Link href="/" className="app-nav-brand">
 <span className="sthyra-logo">sthyra</span>
 <span className="app-nav-brand-tag">v0.13 — visual intelligence</span>
 </Link>

 <nav className="app-nav-links" aria-label="Primary">
 {NAV_ITEMS.map((item) => {
 const active = isActive(item.href);
 const href = item.href.includes('[orgId]') && currentOrgId
 ? item.href.replace('[orgId]', currentOrgId)
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
 <Link href="/site" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
 site
 </Link>
 <Link href="/signin" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>
 sign in
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
