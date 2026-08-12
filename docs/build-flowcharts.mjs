#!/usr/bin/env node
/**
 * Build script: assemble a flowcharts PDF from markdown + Mermaid SVGs.
 *
 * Usage: node build-flowcharts.mjs <charts-dir> <output-pdf>
 * Example: node docs/build-flowcharts.mjs docs/dev-flowcharts STHYRA-DEV-FLOWCHARTS.pdf
 *
 * 1. Reads <charts-dir>/_intro.md.
 * 2. Resolves `\flowchart{NAME}` and `\devflow{NAME}` directives to inline SVG
 *    from <charts-dir>/<NAME>.svg.
 * 3. Renders styled HTML (Sthyra CRM dark theme).
 * 4. Renders PDF via headless Chrome.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const chartsDir = resolve(process.argv[2] ?? 'docs/flowcharts');
const pdfPath = resolve(process.argv[3] ?? 'STHYRA-VISUAL-FLOWCHARTS.pdf');
const htmlPath = resolve(chartsDir, '_assembled.html');

const introPath = resolve(chartsDir, '_intro.md');
if (!existsSync(introPath)) {
  console.error(`❌ missing intro: ${introPath}`);
  process.exit(1);
}
const intro = readFileSync(introPath, 'utf8');

// Resolve \flowchart{NAME} / \devflow{NAME} → inline SVG.
const DIRECTIVE = /\\(?:flowchart|devflow)\{([a-z0-9-]+)\}/g;
const html = intro.replace(DIRECTIVE, (_, name) => {
  const svgPath = resolve(chartsDir, `${name}.svg`);
  if (!existsSync(svgPath)) {
    console.error(`❌ missing SVG: ${svgPath}`);
    process.exit(1);
  }
  return `\n\n<div class="chart">\n${readFileSync(svgPath, 'utf8')}\n</div>\n\n`;
});

// Minimal markdown → HTML.
function mdToHtml(md) {
  const out = [];
  let inUl = false;
  let inPre = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) {
      if (inPre) { out.push('</code></pre>'); inPre = false; }
      else { out.push('<pre><code>'); inPre = true; }
      continue;
    }
    if (inPre) { out.push(line.replace(/</g, '&lt;')); continue; }
    if (line.startsWith('# ')) { out.push(`<h1>${line.slice(2)}</h1>`); continue; }
    if (line.startsWith('## ')) { out.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (line.startsWith('### ')) { out.push(`<h3>${line.slice(4)}</h3>`); continue; }
    if (line.startsWith('- ')) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${line.slice(2)}</li>`);
      continue;
    }
    if (line.trim() === '') { if (inUl) { out.push('</ul>'); inUl = false; } out.push(''); continue; }
    // inline: bold + code
    let l = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    l = l.replace(/`([^`]+)`/g, '<code>$1</code>');
    if (l.startsWith('> ')) { out.push(`<blockquote>${l.slice(2)}</blockquote>`); continue; }
    out.push(`<p>${l}</p>`);
  }
  if (inUl) out.push('</ul>');
  if (inPre) out.push('</code></pre>');
  return out.join('\n');
}

const styledHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${pdfPath.split('/').pop().replace('.pdf', '')}</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: #0A0D13; color: #F2F4F7;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.55; }
  body { padding: 36px 56px; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 34px; margin: 0 0 12px; color: #F2F4F7; letter-spacing: -0.01em;
    border-bottom: 2px solid #00B894; padding-bottom: 12px; }
  h2 { font-size: 25px; margin: 40px 0 12px; color: #F2F4F7;
    border-bottom: 1px solid #262C36; padding-bottom: 8px; page-break-before: always; }
  h2:first-of-type { page-break-before: avoid; }
  h3 { font-size: 18px; margin: 24px 0 8px; color: #F2F4F7; }
  p { margin: 8px 0 16px; color: #C2C8D2; }
  ul, ol { margin: 8px 0 16px 24px; color: #C2C8D2; }
  li { margin: 4px 0; }
  strong { color: #F2F4F7; font-weight: 600; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 13px;
    background: #161A22; border: 1px solid #262C36; border-radius: 4px; padding: 2px 6px; color: #00B894; }
  pre { background: #161A22; border: 1px solid #262C36; border-radius: 6px; padding: 12px 14px;
    overflow-x: auto; font-size: 12px; }
  pre code { background: none; border: none; padding: 0; color: #F2F4F7; }
  blockquote { border-left: 3px solid #F5A524; background: #161A22; margin: 12px 0; padding: 10px 16px;
    color: #C2C8D2; border-radius: 0 6px 6px 0; }
  table { border-collapse: collapse; margin: 16px 0; width: 100%; }
  th, td { border: 1px solid #262C36; padding: 8px 12px; text-align: left; }
  th { background: #161A22; color: #F2F4F7; }
  td { background: #0A0D13; color: #C2C8D2; }
  .chart { background: #161A22; border: 1px solid #262C36; border-radius: 8px;
    padding: 18px; margin: 20px 0; overflow: auto; page-break-inside: avoid; }
  .chart svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
</style>
</head>
<body>
${mdToHtml(html)}
</body>
</html>`;

writeFileSync(htmlPath, styledHtml);
console.log(`✓ HTML assembled: ${htmlPath} (${statSync(htmlPath).size} bytes)`);

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
console.log('Rendering PDF...');
execFileSync(chrome, ['--headless', '--disable-gpu', '--no-sandbox',
  `--print-to-pdf=${pdfPath}`, '--no-pdf-header-footer', htmlPath], { stdio: 'inherit' });
console.log(`✓ PDF written: ${pdfPath} (${statSync(pdfPath).size} bytes)`);
