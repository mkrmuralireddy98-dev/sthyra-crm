'use client';

import { useEffect, useState, useCallback } from 'react';

export interface Toast {
 id: string;
 title: string;
 description?: string;
 variant?: 'success' | 'info' | 'warning' | 'error';
 duration?: number;
}

let toastCounter = 0;
const listeners: Set<(toasts: Toast[]) => void> = new Set();
let toastQueue: Toast[] = [];

function notify() {
 for (const l of listeners) l([...toastQueue]);
}

export function toast(opts: Omit<Toast, 'id'>) {
 const id = String(++toastCounter);
 const t: Toast = { id, duration: 4000, variant: 'info', ...opts };
 toastQueue = [...toastQueue, t];
 notify();
 setTimeout(() => {
 toastQueue = toastQueue.filter((x) => x.id !== id);
 notify();
 }, t.duration);
}

export function ToastViewport() {
 const [toasts, setToasts] = useState<Toast[]>([]);

 useEffect(() => {
 const l = (t: Toast[]) => setToasts(t);
 listeners.add(l);
 return () => { listeners.delete(l); };
 }, []);

 const dismiss = useCallback((id: string) => {
 toastQueue = toastQueue.filter((x) => x.id !== id);
 notify();
 }, []);

 if (toasts.length === 0) return null;

 return (
 <div
 aria-live="polite"
 aria-atomic="true"
 style={{
 position: 'fixed',
 bottom: 24,
 right: 24,
 zIndex: 200,
 display: 'flex',
 flexDirection: 'column',
 gap: 'var(--space-2)',
 pointerEvents: 'none',
 }}
 >
 {toasts.map((t) => (
 <div
 key={t.id}
 role="status"
 onClick={() => dismiss(t.id)}
 style={{
 pointerEvents: 'auto',
 minWidth: 280,
 maxWidth: 380,
 padding: '12px 14px',
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border-default)',
 borderLeft: `3px solid ${
 t.variant === 'success' ? 'var(--green-500)' :
 t.variant === 'warning' ? 'var(--amber-500)' :
 t.variant === 'error' ? 'var(--red-500)' :
 'var(--teal-500)'
 }`,
 borderRadius: 'var(--radius-md)',
 boxShadow: 'var(--shadow-md)',
 cursor: 'pointer',
 animation: 'toast-in 240ms var(--ease-out)',
 fontSize: 13,
 }}
 >
 <div style={{
 fontWeight: 510,
 color: 'var(--text-primary)',
 marginBottom: t.description ? 2 : 0,
 }}>{t.title}</div>
 {t.description && (
 <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t.description}</div>
 )}
 </div>
 ))}
 </div>
 );
}
