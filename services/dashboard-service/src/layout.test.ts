import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { renderLayout, renderErrorPage, render404Page, escapeHtml, renderBadge } from './layout.js';

describe('layout', () => {
  it('renderLayout <html>', () => {
    const html = renderLayout({ title: 'Test', tenantId: 'org_a', body: '<p>hi</p>' });
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.match(html, /<title>Test — Sthyra CRM<\/title>/);
    assert.ok(html.includes('<p>hi</p>'));
  });

  it('renderLayout includes nav links', () => {
    const html = renderLayout({
      title: 't', tenantId: 'org_a', body: '',
      navLinks: [{ href: '/', label: 'Home' }],
    });
    assert.ok(html.includes('href="/"'));
  });

  it('renderErrorPage returns HTML with code', () => {
    const html = renderErrorPage(401, 'Unauthorized', 'missing tenant', 'trace-1');
    assert.ok(html.includes('401'));
    assert.ok(html.includes('Unauthorized'));
    assert.ok(html.includes('trace-1'));
  });

  it('render404Page mentions tenant', () => {
    const html = render404Page('org_a', 'Project');
    assert.ok(html.includes('Project'));
    assert.ok(html.includes('404'));
  });

  it('escapeHtml escapes < > & "', () => {
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
    assert.equal(escapeHtml('"hi"'), '&quot;hi&quot;');
  });

  it('renderBadge returns span with status', () => {
    const b = renderBadge('active');
    assert.match(b, /<span class="badge[^"]*">active<\/span>/);
  });

  it('renderBadge warns for at_risk', () => {
    const b = renderBadge('at_risk');
    assert.match(b, /class="badge warning"/);
  });
});
