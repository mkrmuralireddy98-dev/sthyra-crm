'use client';

import { useEffect, useState } from 'react';

interface PulseEvent {
 id: string;
 type: 'issue.created' | 'capture.ready' | 'workflow.run';
 message: string;
 timestamp: number;
}

export function LivePulse({ orgId, initialCount = 0 }: { orgId: string; initialCount?: number }) {
 const [count, setCount] = useState(initialCount);
 const [events, setEvents] = useState<PulseEvent[]>([]);
 const [pulse, setPulse] = useState(false);

 useEffect(() => {
 // Simulate live updates by polling field-service every 5s
 const poll = async () => {
 try {
 const res = await fetch(`http://127.0.0.1:9091/v1/projects/prj_demo/issues`, {
 headers: { 'x-tenant-id': orgId },
 cache: 'no-store',
 });
 if (!res.ok) return;
 const data = await res.json();
 const newCount = (data.data || []).length;
 if (newCount > count) {
 setCount(newCount);
 setPulse(true);
 setTimeout(() => setPulse(false), 800);
 const delta = newCount - count;
 setEvents((es) => [
 ...es.slice(-4),
 {
 id: String(Date.now()),
 type: 'issue.created',
 message: `${delta} new issue${delta > 1 ? 's' : ''} detected`,
 timestamp: Date.now(),
 },
 ]);
 }
 } catch {}
 };
 const interval = setInterval(poll, 5000);
 return () => clearInterval(interval);
 }, [orgId, count]);

 return (
 <div
 style={{
 display: 'flex',
 alignItems: 'center',
 gap: 'var(--space-3)',
 padding: '8px 12px',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-md)',
 fontSize: 12,
 color: 'var(--text-tertiary)',
 }}
 >
 <span
 style={{
 width: 8,
 height: 8,
 borderRadius: '50%',
 background: 'var(--teal-500)',
 boxShadow: pulse ? '0 0 0 6px var(--teal-glow)' : 'none',
 transition: 'box-shadow 200ms',
 }}
 />
 <span>Live · {count} issue{count !== 1 ? 's' : ''}</span>
 {events.length > 0 && (
 <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>
 · last: {events.length > 0 ? events[events.length - 1]?.message : ''}
 </span>
 )}
 </div>
 );
}
