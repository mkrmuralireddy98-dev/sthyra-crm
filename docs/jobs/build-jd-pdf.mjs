#!/usr/bin/env node
/**
 * Build script: assemble the Sthyra CRM JD PDF.
 *
 *   - Page 1: Billboard cover (full-bleed dark, title, values, stats)
 *   - Page 2: Role + responsibilities (h1 + lede + bullets)
 *   - Page 3: Must-have + nice-to-have cards + success + process + apply
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');
const sourcePath = resolve(root, 'docs/jobs/STHYRA-JD-DETAIL.md');
const cssPath = resolve(root, 'docs/jobs/jd-theme.css');
const htmlPath = resolve(root, 'docs/jobs/_jd-assembled.html');
const pdfPath = resolve(root, 'STHYRA-BACKEND-ENGINEER-JD.pdf');

const css = readFileSync(cssPath, 'utf8');
const source = readFileSync(sourcePath, 'utf8');

// ──────────────────────────────────────────────────────────────
//  Mark-down → HTML micro-engine (small, predictable)
// ──────────────────────────────────────────────────────────────
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
}

function mdToHtml(md) {
  const out = [];
  let inUl = false;
  const flushUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) { flushUl(); out.push(`<h2>${inline(line.slice(3).trim())}</h2>`); continue; }
    if (line.startsWith('# ')) { flushUl(); out.push(`<h1>${inline(line.slice(2).trim())}</h1>`); continue; }
    if (line.startsWith('### ')) { flushUl(); out.push(`<h3>${inline(line.slice(4).trim())}</h3>`); continue; }
    if (line.startsWith('---')) { flushUl(); out.push('<hr class="rule" />'); continue; }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (line.trim() === '') { flushUl(); out.push(''); continue; }
    flushUl();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushUl();
  return out.join('\n');
}

// ──────────────────────────────────────────────────────────────
//  Source split
// ──────────────────────────────────────────────────────────────
const sections = {};
{
  const parts = source.split(/^## /m);
  for (const p of parts.slice(1)) {
    const firstLine = p.split('\n')[0].trim();
    sections[firstLine] = '## ' + p;
  }
}

const h1 = (source.match(/^# (.+)/m) || ['', 'Senior Backend Engineer'])[1];
const roleHeading = `<h1>${h1}</h1>`;
const opening = source.split(/^## /m)[0].replace(/^# .+\n/, '').trim();
const openingHtml = `<p class="lede">${inline(opening)}</p>`;

// Cards (must-have / nice-to-have)
const cardSection = (title, klass, label) => {
  const raw = sections[title] || '';
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- '));
  const items = lines.map((l) => l.slice(2).trim());
  const cards = items.map((item) =>
    `<div class="card ${klass}"><div class="card-label ${klass}">${label}</div><p>${inline(item)}</p></div>`
  ).join('');
  return `<h2><span class="marker">${String(items.length).padStart(2, '0')} · ${label.toUpperCase()}</span><span class="title">${title}</span></h2>\n<div class="grid">${cards}</div>`;
};

const reqBlock  = cardSection('Required qualifications', 'req', 'Must-Have');
const prefBlock = cardSection('Preferred skills',       'pref', 'Nice-to-Have');

// Generic section renderer
const renderSection = (title) => {
  const raw = sections[title] || '';
  return mdToHtml(raw.split('\n').slice(1).join('\n'));
};

const whatBlock = renderSection("What you'll do");
const successBlock = renderSection('What success looks like in 90 days');

// ──────────────────────────────────────────────────────────────
//  PAGE 1 — BILLBOARD COVER
// ──────────────────────────────────────────────────────────────
const cover = `
<div class="billboard">
  <div class="bb-top">
    <div class="bb-mark"><span class="bb-mark-dot"></span> STHYRA CRM</div>
    <div>Engineering · Remote (US/EU)</div>
  </div>
  <div class="bb-body">
    <div class="bb-eyebrow">We are hiring · #02</div>
    <h1 class="bb-title">Senior Backend <em>Engineer</em></h1>
    <p class="bb-tagline">
      Own the data plane of a <strong>multi-tenant visual-intelligence
      platform</strong> for the construction industry. Ship the API surface,
      the Postgres schema, and the integrations — while the AI handles the
      spatial stuff.
    </p>
  </div>
  <div class="values">
    <div class="value">
      <span class="value-num">— 01</span>
      <div class="value-title">Build, don't manage</div>
      <div class="value-body">You will be the only backend engineer. Decisions are yours. No 8-deep review chain.</div>
    </div>
    <div class="value">
      <span class="value-num">— 02</span>
      <div class="value-title">Real ownership</div>
      <div class="value-body">0.5%–1.0% equity. Hire #2. The architecture is pinned — only ship is left.</div>
    </div>
    <div class="value">
      <span class="value-num">— 03</span>
      <div class="value-title">No theater</div>
      <div class="value-body">No panel of 6 people. No whiteboard algorithms. Paid take-home. 2-week close.</div>
    </div>
  </div>
  <div class="bb-stats">
    <div class="bb-stat">
      <div class="bb-stat-label">Compensation</div>
      <div class="bb-stat-value">$160k–$200k <em>base</em></div>
    </div>
    <div class="bb-stat">
      <div class="bb-stat-label">Equity</div>
      <div class="bb-stat-value">0.5%–1.0% <em>vesting</em></div>
    </div>
    <div class="bb-stat">
      <div class="bb-stat-label">Type</div>
      <div class="bb-stat-value">Full-time, <em>remote</em></div>
    </div>
  </div>
  <div class="bb-footer">
    <div>Full job description on the pages that follow.</div>
    <div class="bb-cta">Read more</div>
  </div>
</div>`.trim();

// ──────────────────────────────────────────────────────────────
//  PAGE 2 — ROLE + RESPONSIBILITIES
// ──────────────────────────────────────────────────────────────
const page2 = `
<div class="page">
  <div class="page-num">
    <span>Page 2 of 4</span>
    <span class="rule"></span>
    <span class="num">02</span>
  </div>
  ${roleHeading}
  ${openingHtml}
  ${whatBlock}
</div>`.trim();

// ──────────────────────────────────────────────────────────────
//  PAGE 3 — QUALIFICATIONS + SUCCESS + PROCESS + APPLY
// ──────────────────────────────────────────────────────────────
const processTimeline = `
<h2><span class="marker">06 · PROCESS</span><span class="title">Hiring process</span></h2>
<div class="timeline">
  <div class="timeline-step"><span class="num">STEP 01</span><span class="name">Phone screen</span><span class="dur">30 MIN</span></div>
  <div class="timeline-step"><span class="num">STEP 02</span><span class="name">Take-home</span><span class="dur">3 HR · PAID</span></div>
  <div class="timeline-step"><span class="num">STEP 03</span><span class="name">System design</span><span class="dur">90 MIN</span></div>
  <div class="timeline-step"><span class="num">STEP 04</span><span class="name">Pair programming</span><span class="dur">90 MIN</span></div>
  <div class="timeline-step"><span class="num">STEP 05</span><span class="name">Founder chat</span><span class="dur">45 MIN</span></div>
  <div class="timeline-step"><span class="num">STEP 06</span><span class="name">Offer</span><span class="dur">48 HR</span></div>
</div>`.trim();

const page3 = `
<div class="page">
  <div class="page-num">
    <span>Page 3 of 4</span>
    <span class="rule"></span>
    <span class="num">03</span>
  </div>
  ${reqBlock}
  ${prefBlock}
</div>`.trim();

const page4 = `
<div class="page">
  <div class="page-num">
    <span>Page 4 of 4</span>
    <span class="rule"></span>
    <span class="num">04</span>
  </div>
  <div class="eyebrow small">What success looks like</div>
  <h2 style="border-top: none; margin-top: 4pt; padding-top: 0;"><span class="marker">05 · 90-DAY TARGETS</span><span class="title">Success in 90 days</span></h2>
  ${successBlock}
  <hr class="rule" />
  ${processTimeline}
  <div class="contact">
    <div class="contact-left">
      <div class="contact-eyebrow">Apply</div>
      <div class="contact-email">engineering@sthyra-crm.dev</div>
    </div>
    <div class="contact-right">
      <strong>Include in your reply:</strong>
      A 200-word cover note answering: "What's the most subtle tenant-isolation bug you've debugged, and what did you learn?"
      Your GitHub or GitLab.
      A project you shipped where you were the only backend engineer.
    </div>
  </div>
  <hr class="rule" />
  <p class="tight"><strong>No recruiters. No agencies. No LinkedIn Easy Apply.</strong></p>
  <p class="fineprint">
    Sthyra CRM is an equal-opportunity employer. We hire on the basis of merit and potential. We do not discriminate on race, color, religion, gender, gender identity, sexual orientation, national origin, age, disability, veteran status, or any other characteristic protected by law. All qualified applicants will receive consideration for employment.
  </p>
</div>`.trim();

// ──────────────────────────────────────────────────────────────
//  Assemble + render
// ──────────────────────────────────────────────────────────────
const fullHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sthyra CRM — Senior Backend Engineer</title>
<style>${css}</style>
</head>
<body>
${cover}
${page2}
${page3}
${page4}
</body>
</html>`;

writeFileSync(htmlPath, fullHtml);
console.log(`✓ HTML: ${htmlPath} (${statSync(htmlPath).size} bytes)`);

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
console.log('Rendering PDF...');
execFileSync(chrome, ['--headless', '--disable-gpu', '--no-sandbox',
  `--print-to-pdf=${pdfPath}`, '--no-pdf-header-footer', htmlPath], { stdio: 'inherit' });
console.log(`✓ PDF: ${pdfPath} (${statSync(pdfPath).size} bytes)`);
