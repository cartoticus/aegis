/**
 * Regenerate CHANGELOG.md from the in-app CHANGELOG in index.html, so the repo
 * file is a mirror of the What's New screen and can never drift from it.
 *   npm run changelog
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = join(import.meta.dirname, '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const src = html.match(/const CHANGELOG=(\[[\s\S]*?\n\]);/)?.[1];
if (!src) { console.error('CHANGELOG array not found in index.html'); process.exit(1); }
const CHANGELOG = new Function(`return ${src}`)();
const ENT = { '&mdash;': '—', '&ndash;': '–', '&uarr;': '↑', '&darr;': '↓', '&ldquo;': '“', '&rdquo;': '”', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
const md = s => s
  .replace(/\\u2019/g, '’')
  .replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<i>(.*?)<\/i>/g, '*$1*')
  .replace(/<span class="mono">(.*?)<\/span>/g, '`$1`').replace(/<[^>]+>/g, '')
  .replace(/&[a-z]+;/g, e => ENT[e] ?? e);
const out = ['# Changelog', '',
  'Generated from the in-app **What’s New** list in `index.html` (`npm run changelog`). Edit it there, not here.', ''];
for (const c of CHANGELOG) {
  out.push(`## v${c.v} — ${c.date}`, '');
  for (const it of c.items) out.push(`- ${md(it)}`);
  out.push('');
}
writeFileSync(join(ROOT, 'CHANGELOG.md'), out.join('\n'));
console.log(`CHANGELOG.md written — ${CHANGELOG.length} releases, latest v${CHANGELOG[0].v}`);
