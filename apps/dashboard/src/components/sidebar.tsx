import Link from 'next/link';

export function Sidebar({ currentOrgId, currentPath }: { currentOrgId?: string; currentPath?: string }) {
 return (
 <aside className="sidebar" aria-label="Primary navigation">
 <Link href="/" className="sidebar-brand">
 <span className="sidebar-brand-mark">S</span>
 <span className="sidebar-brand-name">Sthyra CRM</span>
 </Link>

 <div className="sidebar-section">Overview</div>
 <nav className="sidebar-nav" aria-label="Overview">
 <Link href="/" className={`sidebar-link ${currentPath === '/' ? 'active' : ''}`}>
 <span className="sidebar-link-icon" aria-hidden="true">◆</span>
 Dashboard
 </Link>
 <Link href="/orgs" className={`sidebar-link ${currentPath?.startsWith('/orgs') && !currentPath?.includes('/workflows') && !currentPath?.includes('/integrations') && !currentPath?.includes('/reports') && !currentPath?.includes('/projects') ? 'active' : ''}`}>
 <span className="sidebar-link-icon" aria-hidden="true">⌂</span>
 Organizations
 </Link>
 </nav>

 {currentOrgId && (
 <>
 <div className="sidebar-section">Workspace</div>
 <nav className="sidebar-nav" aria-label="Workspace">
 <Link href={`/orgs/${currentOrgId}/projects`} className={`sidebar-link ${currentPath?.includes('/projects') ? 'active' : ''}`}>
 <span className="sidebar-link-icon" aria-hidden="true">▣</span>
 Projects
 </Link>
 <Link href={`/orgs/${currentOrgId}/captures`} className={`sidebar-link ${currentPath?.includes('/captures') ? 'active' : ''}`}>
 <span className="sidebar-link-icon" aria-hidden="true">◉</span>
 Captures
 </Link>
 <Link href={`/orgs/${currentOrgId}/workflows`} className={`sidebar-link ${currentPath?.includes('/workflows') ? 'active' : ''}`}>
 <span className="sidebar-link-icon" aria-hidden="true">↯</span>
 Workflows
 </Link>
 <Link href={`/orgs/${currentOrgId}/integrations`} className={`sidebar-link ${currentPath?.includes('/integrations') ? 'active' : ''}`}>
 <span className="sidebar-link-icon" aria-hidden="true">⊕</span>
 Integrations
 </Link>
 <Link href={`/orgs/${currentOrgId}/reports`} className={`sidebar-link ${currentPath?.includes('/reports') ? 'active' : ''}`}>
 <span className="sidebar-link-icon" aria-hidden="true">▤</span>
 Reports
 </Link>
 </nav>
 </>
 )}

 <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }}>
 <div className="sidebar-section">System</div>
 <nav className="sidebar-nav">
 <a className="sidebar-link" href="http://localhost:9100/v1/admin/health" target="_blank" rel="noopener noreferrer">
 <span className="sidebar-link-icon" aria-hidden="true">◐</span>
 Service Health
 </a>
 <Link href="/docs" className="sidebar-link">
 <span className="sidebar-link-icon" aria-hidden="true">?</span>
 Documentation
 </Link>
 </nav>
 </div>
 </aside>
 );
}
