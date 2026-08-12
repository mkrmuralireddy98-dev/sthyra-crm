#!/usr/bin/env node
/**
 * Build script: assemble the visual-flowcharts PDF.
 *
 * 1. Read docs/flowcharts/_intro.md.
 * 2. For each `\flowchart{NN-name}` directive, inline the corresponding SVG
 *    as a base64 data URL so the image renders even when the PDF is moved.
 * 3. Wrap in a styled HTML doc.
 * 4. Render to PDF via Chrome headless.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');
const chartsDir = resolve(root, 'docs/flowcharts');

const introPath = resolve(chartsDir, '_intro.md');
const htmlPath = resolve(chartsDir, '_assembled.html');
const pdfPath = resolve(root, 'STHYRA-VISUAL-FLOWCHARTS.pdf');

const intro = readFileSync(introPath, 'utf8');

// Resolve each \flowchart{NAME} directive → inline SVG.
const FLOWCHART = /\\flowchart\{([a-z0-9-]+)\}/g;
const html = intro.replace(FLOWCHART, (_, name) => {
  const svgPath = resolve(chartsDir, `${name}.svg`);
  if (!existsSync(svgPath)) {
    console.error(`❌ missing SVG: ${svgPath}`);
    process.exit(1);
  }
  const svg = readFileSync(svgPath, 'utf8');
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `\n\n<div class="chart">\n${svg}\n</div>\n\n`;
});

// Wrap in a styled HTML page.
const styledHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sthyra CRM — Visual Flowcharts</title>
<style>
  :root {
    color-scheme: dark;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #0A0D13;
    color: #F2F4F7;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.55;
  }
  body {
    padding: 36px 56px;
    max-width: 1100px;
    margin: 0 auto;
  }
  h1 {
    font-size: 36px;
    margin: 0 0 12px;
    color: #F2F4F7;
    letter-spacing: -0.01em;
    border-bottom: 2px solid #00B894;
    padding-bottom: 12px;
  }
  h2 {
    font-size: 26px;
    margin: 40px 0 12px;
    color: #F2F4F7;
    border-bottom: 1px solid #262C36;
    padding-bottom: 8px;
  }
  h3 {
    font-size: 18px;
    margin: 24px 0 8px;
    color: #F2F4F7;
  }
  p {
    margin: 8px 0 16px;
    color: #C2C8D2;
  }
  ul, ol {
    margin: 8px 0 16px 24px;
    color: #C2C8D2;
  }
  li {
    margin: 4px 0;
  }
  strong {
    color: #F2F4F7;
    font-weight: 600;
  }
  code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
    background: #161A22;
    border: 1px solid #262C36;
    border-radius: 4px;
    padding: 2px 6px;
    color: #00B894;
  }
  pre {
    background: #161A22;
    border: 1px solid #262C36;
    border-radius: 6px;
    padding: 12px 14px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.45;
  }
  pre code {
    background: none;
    border: none;
    padding: 0;
    color: #F2F4F7;
  }
  blockquote {
    border-left: 3px solid #F5A524;
    background: #161A22;
    margin: 12px 0;
    padding: 10px 16px;
    color: #C2C8D2;
    border-radius: 0 6px 6px 0;
  }
  table {
    border-collapse: collapse;
    margin: 16px 0;
    width: 100%;
  }
  th, td {
    border: 1px solid #262C36;
    padding: 8px 12px;
    text-align: left;
  }
  th {
    background: #161A22;
    color: #F2F4F7;
  }
  td {
    background: #0A0D13;
    color: #C2C8D2;
  }
  hr {
    border: none;
    border-top: 1px solid #262C36;
    margin: 32px 0;
  }
  .chart {
    background: #161A22;
    border: 1px solid #262C36;
    border-radius: 8px;
    padding: 18px;
    margin: 20px 0;
    overflow: auto;
  }
  .chart svg {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
  }
  .chart svg .nodeLabel,
  .chart svg .edgeLabel {
    color: #F2F4F7 !important;
  }
  /* Page break hints for Chrome */
  h2 {
    page-break-before: always;
  }
  h2:first-of-type {
    page-break-before: avoid;
  }
  .chart {
    page-break-inside: avoid;
  }
</style>
</head>
<body>
${(() => {
  const out = [];
  let inUl = false;
  let inCode = false;
  let inPre = false;
  for (const raw of html.split('\n')) {
    const line = raw;
    if (line.startsWith('```')) {
      if (inPre) { out.push('</code></pre>'); inPre = false; inCode = false; }
      else { out.push('<pre><code>'); inPre = true; inCode = true; }
      continue;
    }
    if (inCode) { out.push(line); continue; }
    if (line.startsWith('# ')) { out.push(`<h1>${line.slice(2).trim()}</h1>`); continue; }
    if (line.startsWith('## ')) { out.push(`<h2>${line.slice(3).trim()}</h2>`); continue; }
    if (line.startsWith('### ')) { out.push(`<h3>${line.slice(4).trim()}</h3>`); continue; }
    if (line.startsWith('- ')) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${line.slice(2).trim()}</li>`);
      continue;
    }
    if (line.trim() === '') {
      if (inUl) { out.push('</ul>'); inUl = false; }
      out.push('');
      continue;
    }
    out.push(`<p>${line}</p>`);
  }
  if (inUl) out.push('</ul>');
  if (inPre) out.push('</code></pre>');
  return out.join('\n');
})()}
</body>
</html>`;

writeFileSync(htmlPath, styledHtml);
console.log(`✓ HTML assembled: ${htmlPath} (${statSync(htmlPath).size} bytes)`);

// Render to PDF using Chrome headless.
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
console.log('Rendering PDF...');
execFileSync(chrome, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  `--print-to-pdf=${pdfPath}`,
  '--no-pdf-header-footer',
  htmlPath,
], { stdio: 'inherit' });

console.log(`✓ PDF written: ${pdfPath} (${statSync(pdfPath).size} bytes)`);
