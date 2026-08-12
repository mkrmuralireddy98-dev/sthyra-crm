#!/usr/bin/env node
/**
 * Build script: split the Sthyra CRM Engineering Playbook into
 * - Sthyra CRM FRONTEND Engineering Playbook (PDF)
 * - Sthyra CRM BACKEND Engineering Playbook (PDF)
 *
 * Each PDF has:
 *   - Dark cover page with title, eyebrow, metadata
 *   - TOC
 *   - Print-style typography (serif body, sans headings, monospace code)
 *   - Page numbers, teal+amber accents, callouts, tables, code highlighting
 *
 * Source: docs/STHYRA-ENGINEERING-PLAYBOOK.md
 * Render: Chrome headless --print-to-pdf
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const sourcePath = resolve(root, 'docs/STHYRA-ENGINEERING-PLAYBOOK.md');
const cssPath = resolve(root, 'docs/dark-theme.css');

if (!existsSync(sourcePath)) {
  console.error(`❌ source missing: ${sourcePath}`);
  process.exit(1);
}

// Minimal Markdown → HTML with syntax highlight (handles bash + ts + sql lightly)
function mdToHtml(md) {
  const out = [];
  let inUl = false;
  let inOl = false;
  let inPre = null; // 'bash' | 'ts' | 'sql' | 'yaml' | 'hcl' | null
  let preBuf = [];

  const flushLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };
  const flushPre = () => {
    if (inPre !== null) {
      const code = highlight(preBuf.join('\n'), inPre);
      out.push(`<pre><code class="lang-${inPre}">${code}</code></pre>`);
      preBuf = []; inPre = null;
    }
  };

  for (const raw of md.split('\n')) {
    const line = raw;

    // fenced code blocks
    const fenceMatch = line.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      if (inPre !== null) {
        flushPre();
      } else {
        flushLists();
        inPre = fenceMatch[1] ?? 'text';
      }
      continue;
    }
    if (inPre !== null) {
      preBuf.push(line);
      continue;
    }

    if (line.startsWith('# ')) { flushLists(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('## ')) { flushLists(); out.push(`<h2 id="${slug(line.slice(3))}">${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('### ')) { flushLists(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('#### ')) { flushLists(); out.push(`<h4>${inline(line.slice(5))}</h4>`); continue; }

    // blockquote (definition of done, callouts)
    if (line.startsWith('> ')) {
      flushLists();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    // hr
    if (line.trim() === '---') {
      flushLists();
      out.push('<hr class="rule" />');
      continue;
    }

    // tables (markdown)
    if (line.startsWith('|') && line.trim().endsWith('|')) {
      flushLists();
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (line.includes('---')) continue; // separator row
      const tag = inPre === null ? 'th' : 'td';
      // detect we're inside a table by tracking state via out buffer
      out.push(`<tr><${tag}>${cells.map((c) => inline(c)).join(`</${tag}><${tag}>`)}</${tag}></tr>`);
      // naive: wrap consecutive <tr> in <table>
      // we'll handle wrapping post-loop
      continue;
    }

    // bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    // numbered list
    if (/^\d+\.\s/.test(line)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    // blank line ends lists
    if (line.trim() === '') {
      flushLists();
      out.push('');
      continue;
    }

    // paragraph
    flushLists();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushLists();
  flushPre();

  // wrap consecutive <tr> in <table><thead>...</thead><tbody>
  let joined = out.join('\n');
  joined = joined.replace(/(?:<tr>(?:<th>.*?<\/th>)+<\/tr>\n?)(?:<tr>.*?<\/tr>\n?)+/gs, (m) => {
    const trs = m.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
    if (!trs.length) return m;
    const head = trs[0];
    const body = trs.slice(1).join('\n');
    return `<table>\n<thead>${head}</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
  });
  return joined;
}

// Inline: bold, italic, code, links, tags
function inline(s) {
  let out = s;
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // simple link [text](url) → if it's an internal #anchor, keep as anchor for TOC
  out = out.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, '<a href="#$2">$1</a>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Hand-rolled syntax highlighter (very minimal)
function highlight(src, lang) {
  let s = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
    s = s.replace(/(^|\n)(#.*)/g, '$1<span class="tok-com">$2</span>');
    s = s.replace(/\b(cd|export|if|then|else|fi|for|in|do|done|while|case|esac|function|return|exit)\b/g, '<span class="tok-key">$1</span>');
    s = s.replace(/'([^']*)'/g, '<span class="tok-str">\'$1\'</span>');
    s = s.replace(/&quot;([^&]*)&quot;/g, '<span class="tok-str">"$1"</span>');
    s = s.replace(/(\$\w+|@\w+)/g, '<span class="tok-typ">$1</span>');
    s = s.replace(/(^|\n)(\/[^\s]+)/g, '$1<span class="tok-fn">$2</span>');
  } else if (lang === 'ts' || lang === 'tsx' || lang === 'js' || lang === 'javascript' || lang === 'typescript') {
    s = s.replace(/(\/\/[^\n]*)/g, '<span class="tok-com">$1</span>');
    s = s.replace(/\b(import|from|export|const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|extends|implements|interface|type|as|async|await|of|in|null|true|false|undefined|void)\b/g, '<span class="tok-key">$1</span>');
    s = s.replace(/(\'([^\']*)\'|\&quot;([^&]*)\&quot;|\`([^\`]*)\`)/g, '<span class="tok-str">$1</span>');
    s = s.replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
    s = s.replace(/\b([A-Z][a-zA-Z0-9]+)\b/g, '<span class="tok-typ">$1</span>');
  } else if (lang === 'sql') {
    s = s.replace(/(--[^\n]*)/g, '<span class="tok-com">$1</span>');
    s = s.replace(/\b(CREATE|TABLE|IF|NOT|EXISTS|PRIMARY|KEY|REFERENCES|UNIQUE|INDEX|DEFAULT|NOW|INT|TEXT|TIMESTAMPTZ|JSONB|BOOLEAN|LIKE|LOWER|VARCHAR|SERIAL|BIGINT|RETURNING|TRUE|FALSE)\b/gi, '<span class="tok-key">$1</span>');
    s = s.replace(/(\'([^\']*)\')/g, '<span class="tok-str">$1</span>');
  } else if (lang === 'yaml' || lang === 'yml') {
    s = s.replace(/(#[^\n]*)/g, '<span class="tok-com">$1</span>');
    s = s.replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(\s*:)/gm, '$1<span class="tok-key">$2</span>$3');
  } else if (lang === 'hcl' || lang === 'terraform') {
    s = s.replace(/(\/\/[^\n]*)/g, '<span class="tok-com">$1</span>');
    s = s.replace(/\b(module|resource|variable|output|provider|terraform|locals|data)\b/g, '<span class="tok-key">$1</span>');
    s = s.replace(/(\"([^\"]*)\")/g, '<span class="tok-str">$1</span>');
  }
  return s;
}

// Build the HTML wrapper with cover + TOC
function buildHtml(title, subtitle, audience, intro, bodyHtml) {
  const css = readFileSync(cssPath, 'utf8');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div class="cover">
  <div class="cover-eyebrow">Sthyra CRM · Engineering</div>
  <div>
    <div class="cover-title">${title}</div>
    <p class="cover-subtitle">${subtitle}</p>
  </div>
  <div class="cover-meta">
    <div>${audience}</div>
    <div class="cover-meta-right">
      <strong>Sthyra CRM</strong><br/>
      ${intro}
    </div>
  </div>
</div>

${bodyHtml}

</body>
</html>`;
}

// Filter the master playbook by phase markers
function filterPhases(md, phaseRegex) {
  // Split on `## Phase ` and rebuild
  const parts = md.split(/^## /m);
  const head = parts[0]; // everything before the first `## Phase`
  const phases = parts.slice(1).map((p) => `## ${p}`);
  const kept = phases.filter((p) => phaseRegex.test(p.split('\n')[0]));
  // also keep continuous sections (architecture decisions, risk register, daily workflow)
  const sectionsToKeepAlways = [
    /^## Architecture decisions/,
    /^## Risk register/,
    /^## Where to get help/,
    /^## Phase 1 MVP exit criteria/,
    /^## Total time budget/,
    /^## Continuous/,
    /^## Day 1/,
    /^## Phase 0/,
  ];
  const extras = phases.filter((p) => sectionsToKeepAlways.some((r) => r.test(p.split('\n')[0])));
  const all = Array.from(new Set([...kept, ...extras]));
  return [head, ...all].join('\n');
}

const source = readFileSync(sourcePath, 'utf8');
const bodyOnly = source.replace(/^# [^\n]*\n\n> [^\n]*\n\n/, ''); // strip title + tagline

// ============ FRONTEND ============
// Frontend-focused phases: 0 (onboarding), 4 (viewer), 5 (mobile shell), 6 (BIM viewer)
// Plus shared sections (architecture decisions, risk, daily workflow).
const FRONTEND_PHASES = /^(## Phase (0|4|5|6) — )/;
const frontendBody = filterPhases(bodyOnly, FRONTEND_PHASES);
const frontendHtml = mdToHtml(frontendBody);
const frontendWrapped = buildHtml(
  'Frontend Engineering Playbook',
  'A guide for the engineer building the web dashboard, the 360° viewer, the BIM viewer, and the mobile capture shell.',
  '<strong>For:</strong> Frontend engineer<br/>Working with: Senior Backend Engineer',
  'v1.0 · 6-month roadmap<br>Build from working code',
  frontendHtml,
);
const frontendHtmlPath = resolve(root, 'docs/_frontend.html');
writeFileSync(frontendHtmlPath, frontendWrapped);
console.log(`✓ Frontend HTML: ${frontendHtmlPath} (${statSync(frontendHtmlPath).size} bytes)`);

// ============ BACKEND ============
// Backend-focused phases: 0 (onboarding), 1 (Postgres), 2 (OIDC), 3 (capture), 7 (Copilot),
// 8 (Integrations), 9 (Deploy to AWS)
// Plus shared sections.
const BACKEND_PHASES = /^(## Phase (0|1|2|3|7|8|9) — )/;
const backendBody = filterPhases(bodyOnly, BACKEND_PHASES);
const backendHtml = mdToHtml(backendBody);
const backendWrapped = buildHtml(
  'Backend Engineering Playbook',
  'A guide for the engineer owning services, data plane, integrations, and infrastructure — from current state to Phase 1 MVP.',
  '<strong>For:</strong> Backend engineer<br/>Working with: Senior Frontend Engineer',
  'v1.0 · 6-month roadmap<br>Build from working code',
  backendHtml,
);
const backendHtmlPath = resolve(root, 'docs/_backend.html');
writeFileSync(backendHtmlPath, backendWrapped);
console.log(`✓ Backend HTML:  ${backendHtmlPath} (${statSync(backendHtmlPath).size} bytes)`);

// ============ Render PDFs ============
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const targets = [
  { html: frontendHtmlPath, pdf: resolve(root, 'STHYRA-FRONTEND-PLAYBOOK.pdf') },
  { html: backendHtmlPath, pdf: resolve(root, 'STHYRA-BACKEND-PLAYBOOK.pdf') },
];
for (const t of targets) {
  console.log(`Rendering ${t.pdf.split('/').pop()}...`);
  execFileSync(chrome, ['--headless', '--disable-gpu', '--no-sandbox',
    `--print-to-pdf=${t.pdf}`, '--no-pdf-header-footer', t.html], { stdio: 'inherit' });
  console.log(`  ✓ ${t.pdf} (${statSync(t.pdf).size} bytes)`);
}