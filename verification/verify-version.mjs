/**
 * Version lockstep — the discipline ARC §12.9 enforces on itself, applied to
 * AEGIS. A version bump that lands in one artifact and not the others ships a
 * stale service-worker cache, which is exactly how "the update didn't appear"
 * bugs happen in a PWA.
 */
import { readFileSync } from 'node:fs';

const html = readFileSync(import.meta.dirname + '/../index.html', 'utf8');
const sw = readFileSync(import.meta.dirname + '/../sw.js', 'utf8');

const appVersion = html.match(/const APP_VERSION='([^']+)'/)?.[1];
// v1.6.1 wrapped the tagline in .sub-tag so phones can drop it and keep the version.
const headerSub = html.match(/<span class="sub">(?:<span class="sub-tag">)?ISC2-Aligned · (?:<\/span>)?v([\d.]+)<\/span>/)?.[1];
const changelogTop = html.match(/const CHANGELOG=\[\s*\{v:'([^']+)'/)?.[1];
const swCache = sw.match(/const CACHE = 'aegis-v([\d.]+)'/)?.[1];

const claims = { APP_VERSION: appVersion, 'header badge': headerSub, 'CHANGELOG head': changelogTop, 'sw.js CACHE': swCache };
const distinct = [...new Set(Object.values(claims))];

console.log('\nAEGIS version lockstep');
console.log('─'.repeat(52));
for (const [k, v] of Object.entries(claims)) console.log(`  ${k.padEnd(16)} ${v ?? 'NOT FOUND'}`);

const missing = Object.entries(claims).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.log(`\n  FAIL — could not read: ${missing.join(', ')}\n`); process.exit(1); }
if (distinct.length !== 1) { console.log(`\n  FAIL — ${distinct.length} different versions claimed: ${distinct.join(' / ')}\n`); process.exit(1); }
console.log(`\n  PASS — all four artifacts claim v${distinct[0]}\n`);
