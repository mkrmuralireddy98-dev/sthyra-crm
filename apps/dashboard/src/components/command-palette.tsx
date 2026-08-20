'use client';

import { useEffect, useState } from 'react';

interface CmdItem {
 id: string;
 title: string;
 section: string;
 action: () => void;
}

const COMMANDS: CmdItem[] = [
 { id: 'home', title: 'Go to Dashboard', section: 'Navigation', action: () => window.location.assign('/') },
 { id: 'issues', title: 'Field Issues', section: 'Navigation', action: () => window.location.assign('/orgs/org_a/issues') },
 { id: 'captures', title: 'Captures', section: 'Navigation', action: () => window.location.assign('/orgs/org_a/captures') },
 { id: 'projects', title: 'Projects', section: 'Navigation', action: () => window.location.assign('/orgs/org_a/projects') },
 { id: 'workflows', title: 'Workflows', section: 'Navigation', action: () => window.location.assign('/orgs/org_a/workflows') },
 { id: 'integrations', title: 'Integrations', section: 'Navigation', action: () => window.location.assign('/orgs/org_a/integrations') },
 { id: 'reports', title: 'Reports', section: 'Navigation', action: () => window.location.assign('/orgs/org_a/reports') },
 { id: 'admin', title: 'Open Admin Health', section: 'System', action: () => window.open('http://localhost:9100/v1/admin/health', '_blank') },
];

export function CommandPalette() {
 const [open, setOpen] = useState(false);
 const [query, setQuery] = useState('');
 const [activeIdx, setActiveIdx] = useState(0);

 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 setOpen((o) => !o);
 }
 if (e.key === 'Escape' && open) {
 setOpen(false);
 }
 };
 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [open]);

 const filtered = query
 ? COMMANDS.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
 : COMMANDS;

 const handleSelect = (item: CmdItem) => {
 setOpen(false);
 item.action();
 };

 return (
 <>
 <button
 onClick={() => setOpen(true)}
 aria-label="Open command palette"
 style={{
 position: 'fixed',
 top: 16,
 right: 16,
 zIndex: 50,
 display: 'inline-flex',
 alignItems: 'center',
 gap: 8,
 padding: '6px 10px',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 color: 'var(--text-tertiary)',
 fontSize: 12,
 fontFamily: 'var(--font-mono)',
 cursor: 'pointer',
 boxShadow: 'var(--shadow-sm)',
 }}
 >
 <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>⌘K</span>
 <span>Search…</span>
 </button>

 {open && (
 <div
 role="dialog"
 aria-modal="true"
 onClick={() => setOpen(false)}
 style={{
 position: 'fixed',
 inset: 0,
 zIndex: 100,
 background: 'rgba(0,0,0,0.6)',
 backdropFilter: 'blur(8px)',
 display: 'flex',
 alignItems: 'flex-start',
 justifyContent: 'center',
 paddingTop: 100,
 animation: 'cmd-fade-in 200ms var(--ease-out)',
 }}
 >
 <div
 onClick={(e) => e.stopPropagation()}
 style={{
 width: '100%',
 maxWidth: 560,
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-xl)',
 boxShadow: 'var(--shadow-lg)',
 overflow: 'hidden',
 animation: 'cmd-scale-in 200ms var(--ease-out)',
 }}
 >
 <input
 autoFocus
 type="text"
 placeholder="Type a command or search…"
 value={query}
 onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
 onKeyDown={(e) => {
 if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
 if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
 if (e.key === 'Enter' && filtered[activeIdx]) { handleSelect(filtered[activeIdx]); }
 }}
 style={{
 width: '100%',
 padding: '16px 20px',
 background: 'transparent',
 border: 'none',
 borderBottom: '1px solid var(--border-default)',
 color: 'var(--text-primary)',
 fontSize: 15,
 outline: 'none',
 }}
 />

 <div style={{ maxHeight: 360, overflowY: 'auto' }}>
 {filtered.length === 0 && (
 <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
 No results for "{query}"
 </div>
 )}
 {filtered.map((item, idx) => (
 <button
 key={item.id}
 onClick={() => handleSelect(item)}
 onMouseEnter={() => setActiveIdx(idx)}
 style={{
 display: 'flex',
 width: '100%',
 alignItems: 'center',
 justifyContent: 'space-between',
 padding: '10px 20px',
 background: idx === activeIdx ? 'var(--bg-elevated-2)' : 'transparent',
 border: 'none',
 borderLeft: idx === activeIdx ? '2px solid var(--teal-500)' : '2px solid transparent',
 color: 'var(--text-primary)',
 fontSize: 13,
 cursor: 'pointer',
 textAlign: 'left',
 }}
 >
 <div>
 <div style={{ fontWeight: 510 }}>{item.title}</div>
 <div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{item.section}</div>
 </div>
 </button>
 ))}
 </div>

 <div style={{
 padding: '8px 20px',
 borderTop: '1px solid var(--border-default)',
 background: 'var(--bg-panel)',
 fontSize: 11,
 color: 'var(--text-quaternary)',
 display: 'flex',
 gap: 16,
 }}>
 <span><kbd style={{ fontFamily: 'var(--font-mono)' }}>↑↓</kbd> Navigate</span>
 <span><kbd style={{ fontFamily: 'var(--font-mono)' }}>↵</kbd> Select</span>
 <span><kbd style={{ fontFamily: 'var(--font-mono)' }}>Esc</kbd> Close</span>
 </div>
 </div>
 </div>
 )}
 </>
 );
}
