/**
 * Layout — pure HTML rendering functions.
 */

import { CSS } from './css.js';

export interface NavLink {
  readonly href: string;
  readonly label: string;
}

export function renderLayout(opts: {
  readonly title: string;
  readonly tenantId: string;
  readonly body: string;
  readonly navLinks?: readonly NavLink[];
}): string {
  const nav = (opts.navLinks ?? [])
    .map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`)
    .join('\n  ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.title)} — Sthyra CRM</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="header">
    <h1>Sthyra CRM</h1>
    <div class="nav">
      ${nav || `<span class="muted">Tenant: ${escapeHtml(opts.tenantId)}</span>`}
    </div>
  </div>
  <div class="container">
    ${opts.body}
  </div>
</body>
</html>`;
}

export function renderErrorPage(code: number, title: string, message: string, traceId: string): string {
  const body = `<div class="error"><strong>${code} ${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p><p class="muted">Trace: ${escapeHtml(traceId)}</p></div>`;
  return renderLayout({ title: `${code} ${title}`, tenantId: 'unknown', body });
}

export function render404Page(tenantId: string, resource: string): string {
  const body = `<div class="error"><strong>404 Not Found</strong><p>${escapeHtml(resource)} does not exist in this tenant.</p></div>`;
  return renderLayout({ title: '404 Not Found', tenantId, body });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
 switch (c) {
 case '&': return '&amp;';
 case '<': return '&lt;';
 case '>': return '&gt;';
 case '"': return '&quot;';
 case "'": return '&#39;';
 default: return c;
 }
 });
}

export function renderBadge(status: string): string {
 const cls = status === 'completed' ? '' : status === 'at_risk' || status === 'delayed' ? 'warning' : status === 'cancelled' ? 'error' : '';
 return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}
