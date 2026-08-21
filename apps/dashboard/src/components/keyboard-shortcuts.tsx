'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Vim/Linear-style keyboard shortcuts:
 * g+i → Issues
 * g+p → Projects
 * g+c → Captures
 * g+w → Workflows
 * g+r → Reports
 * g+a → Admin Health
 * g+h → Home
 * ? → Show help (already via Cmd+K)
 */
export function KeyboardShortcuts() {
 const router = useRouter();

 useEffect(() => {
 let gPressed = false;
 let gTimer: NodeJS.Timeout;

 const handler = (e: KeyboardEvent) => {
 // Ignore if user is typing in an input/textarea
 const target = e.target as HTMLElement;
 const isInput = target?.tagName === 'INPUT' ||
 target?.tagName === 'TEXTAREA' ||
 target?.isContentEditable;
 if (isInput) return;
 // Ignore if modifier keys are pressed (Cmd+K etc.)
 if (e.metaKey || e.ctrlKey || e.altKey) return;

 if (e.key === 'g') {
 gPressed = true;
 clearTimeout(gTimer);
 gTimer = setTimeout(() => { gPressed = false; }, 1000);
 return;
 }

 if (gPressed) {
 gPressed = false;
 clearTimeout(gTimer);
 switch (e.key) {
 case 'i': router.push('/orgs/org_a/issues'); break;
 case 'p': router.push('/orgs/org_a/projects'); break;
 case 'c': router.push('/orgs/org_a/captures'); break;
 case 'w': router.push('/orgs/org_a/workflows'); break;
 case 'r': router.push('/orgs/org_a/reports'); break;
 case 'a': window.open('http://localhost:9100/v1/admin/health', '_blank'); break;
 case 'h': router.push('/'); break;
 }
 }
 };

 window.addEventListener('keydown', handler);
 return () => {
 window.removeEventListener('keydown', handler);
 clearTimeout(gTimer);
 };
 }, [router]);

 return null;
}
