/**
 * Isolation test for the ONE genuinely new failure surface in Phase 1:
 * fetched modules/*.json + arc-core.mjs + service-worker cache.
 *
 * Tested BEFORE any UI is built on top, because this seam is the most likely to
 * bite and the least visible when it does — a corpus that silently fails to load
 * looks identical to a learner who simply has not started yet.
 *
 * The server is deliberately controllable so each failure mode is real, not
 * mocked: a 404 manifest, a 404 module, truncated JSON, a module that breaks the
 * prerequisite DAG, and a genuinely offline second visit.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const ROOT = process.env.APP_ROOT || import.meta.dirname + '/../';
const PORT = 8791;

/* Fault switches flipped per-test. */
const fault = { manifest404: false, module404: null, corrupt: null, engine404: false };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const name = req.url.split('?')[0].replace(/^\//, '') || 'index.html';
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain' }); res.end(body); };

  if (fault.manifest404 && name === 'modules/index.json') return send(404, 'not found');
  if (fault.engine404 && name === 'arc-core.mjs') return send(404, 'not found');
  if (fault.module404 && name === 'modules/' + fault.module404) return send(404, 'not found');
  if (fault.corrupt && name === 'modules/' + fault.corrupt) {
    const good = readFileSync(ROOT + name, 'utf8');
    return send(200, good.slice(0, Math.floor(good.length / 2)), 'application/json'); // truncated
  }
  let body;
  try { body = readFileSync(ROOT + name); } catch { return send(404, 'not found'); }
  const ext = name.slice(name.lastIndexOf('.'));
  send(200, body, TYPES[ext] || 'application/octet-stream');
}).listen(PORT);

const URL = `http://127.0.0.1:${PORT}/index.html`;
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ` — ${d}` : '')); } };

const browser = await chromium.launch();
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const section = n => { if (ONLY && !ONLY.has(String(n))) return false; console.log(`  [${n}] running…`); return true; };

async function withPage(fn, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const reqs = [];
  page.on('request', r => reqs.push(r.url().replace(`http://127.0.0.1:${PORT}/`, '')));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(15000);
  try { return await fn(page, reqs, errors); } catch (e) { fail++; fails.push('EXCEPTION: ' + e.message.split('\n')[0]); return null; } finally { await ctx.close(); }
}
const loadCorpus = page => page.evaluate(async () => {
  await loadArcCorpus();
  return { status: ARC.status, reason: ARC.reason, n: ARC.modules.length,
           ids: ARC.modules.map(m => m.id), dropped: ARC.dropped };
});
const reset = { manifest404: false, module404: null, corrupt: null, engine404: false };

/* ── 1. Happy path ───────────────────────────────────────────────────────── */
if (section(1)) {
Object.assign(fault, reset);
await withPage(async (page, reqs, errors) => {
  await page.goto(URL);
  const r = await loadCorpus(page);
  ok('happy: status ready', r.status === 'ready', JSON.stringify(r));
  ok('happy: all six modules', r.n === 6, String(r.n));
  ok('happy: CIA root present', r.ids.includes('isc2.cc.d1.cia-triad'));
  ok('happy: nothing dropped', r.dropped.length === 0, JSON.stringify(r.dropped));
  ok('happy: no page errors', errors.length === 0, errors.join('|'));
  const eng = await page.evaluate(() => ({
    spec: ARC.engine.SPEC_VERSION,
    states: ARC.engine.STATES.length,
    corpusErrs: ARC.engine.validateCorpus(ARC.modules).length,
  }));
  ok('happy: real engine loaded', eng.spec === '4.3.0' && eng.states === 9, JSON.stringify(eng));
  ok('happy: corpus validates in the browser', eng.corpusErrs === 0, String(eng.corpusErrs));
});

}

/* ── 2. Toggle off makes NO new requests ─────────────────────────────────── */
if (section(2)) {
await withPage(async (page, reqs) => {
  await page.goto(URL);
  await page.waitForTimeout(300);
  const arcReqs = reqs.filter(u => u.startsWith('modules/') || u === 'arc-core.mjs');
  ok('classic boot fetches no ARC assets', arcReqs.length === 0, arcReqs.join(', '));
});

}

/* ── 3. Manifest 404 → unavailable, app still alive ──────────────────────── */
if (section(3)) {
Object.assign(fault, reset, { manifest404: true });
await withPage(async (page, reqs, errors) => {
  await page.goto(URL);
  const r = await loadCorpus(page);
  ok('manifest 404: unavailable', r.status === 'unavailable', JSON.stringify(r));
  ok('manifest 404: reason is human-readable', /module list could not be fetched/i.test(r.reason || ''), r.reason);
  ok('manifest 404: no unhandled error', errors.length === 0, errors.join('|'));
  const alive = await page.evaluate(() => { switchView('domains'); return !!document.querySelector('.dom-panel.active'); });
  ok('manifest 404: classic app still works', alive === true);
});

}

/* ── 4. Engine 404 → unavailable, distinct reason ────────────────────────── */
if (section(4)) {
Object.assign(fault, reset, { engine404: true });
await withPage(async (page, reqs, errors) => {
  await page.goto(URL);
  const r = await loadCorpus(page);
  ok('engine 404: unavailable', r.status === 'unavailable', JSON.stringify(r));
  ok('engine 404: names the engine, not the modules', /engine could not be loaded/i.test(r.reason || ''), r.reason);
  ok('engine 404: no unhandled error', errors.length === 0, errors.join('|'));
});

}

/* ── 5. One leaf module 404 → degraded, the rest survive ─────────────────── */
if (section(5)) {
Object.assign(fault, reset, { module404: 'd1-05-governance.arc-module.json' });
await withPage(async (page) => {
  await page.goto(URL);
  const r = await loadCorpus(page);
  ok('leaf 404: degraded not dead', r.status === 'degraded', JSON.stringify(r));
  ok('leaf 404: five modules survive', r.n === 5, String(r.n));
  ok('leaf 404: the missing one is named', r.dropped.some(d => /governance/.test(d.id)), JSON.stringify(r.dropped));
  ok('leaf 404: reason states the count', /5 of 6/.test(r.reason || ''), r.reason);
});

}

/* ── 6. Truncated JSON is not silently half-loaded ───────────────────────── */
if (section(6)) {
Object.assign(fault, reset, { corrupt: 'd1-02-control-types.arc-module.json' });
await withPage(async (page, reqs, errors) => {
  await page.goto(URL);
  const r = await loadCorpus(page);
  ok('corrupt: degraded', r.status === 'degraded', JSON.stringify(r));
  ok('corrupt: bad module excluded', !r.ids.includes('isc2.cc.d1.control-types'), r.ids.join(','));
  ok('corrupt: five survive', r.n === 5, String(r.n));
  ok('corrupt: no unhandled error', errors.length === 0, errors.join('|'));
});

}

/* ── 7. Losing the DAG ROOT must cascade — this is the one that matters ──── */
if (section(7)) {
Object.assign(fault, reset, { module404: 'd1-00-cia-triad.arc-module.json' });
await withPage(async (page) => {
  await page.goto(URL);
  const r = await loadCorpus(page);
  ok('root lost: nothing is left standing', r.n === 0, `${r.n} survived: ${r.ids.join(',')}`);
  ok('root lost: reported unavailable', r.status === 'unavailable', JSON.stringify(r));
  ok('root lost: every dependant is named', r.dropped.length >= 6, String(r.dropped.length));
  ok('root lost: cascade reason given', r.dropped.some(d => /prerequisite/.test(d.why)), JSON.stringify(r.dropped.slice(0, 3)));
});

}

/* ── 8. OFFLINE after a first online visit — the PWA promise ─────────────── */
if (section(8)) {
Object.assign(fault, reset);
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Let the install-time corpus precache settle.
  await page.waitForTimeout(1200);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  ok('offline: service worker took control', controlled === true);

  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const c = await caches.open(keys.find(k => k.startsWith('aegis-')));
    const all = await c.keys();
    return all.map(r => new URL(r.url).pathname).filter(p => p.includes('module') || p.includes('arc-core'));
  });
  ok('offline: modules precached at install', cached.filter(p => p.includes('.arc-module.json')).length === 6, cached.join(', '));
  ok('offline: engine precached at install', cached.some(p => p.endsWith('arc-core.mjs')), cached.join(', '));

  await ctx.setOffline(true);
  await page.reload();
  const r = await loadCorpus(page);
  ok('offline: corpus loads with the network down', r.status === 'ready' && r.n === 6, JSON.stringify(r));
  const title = await page.textContent('.wordmark .name');
  ok('offline: app shell still renders', /AEGIS/.test(title.replace(/\s/g, '')), title);
  await ctx.close();
}

}

/* ── 9. Offline on a FIRST visit — honest message, no hang ───────────────── */
if (section(9)) {
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(URL);                 // shell only; do not warm the corpus
  await ctx.setOffline(true);
  const r = await Promise.race([
    loadCorpus(page),
    page.waitForTimeout(8000).then(() => ({ status: 'HUNG' })),
  ]);
  ok('cold offline: does not hang', r.status !== 'HUNG');
  ok('cold offline: degrades rather than throwing', ['ready', 'degraded', 'unavailable'].includes(r.status), JSON.stringify(r));
  await ctx.close();
}

}

/* ── 10. A missing OPTIONAL asset must not cost offline capability ───────── */
if (section(10)) {
  // The web manifest is deliberately NOT in the fatal shell: losing it should
  // cost installability, not the service worker. Delete it and check the SW
  // still takes control and the corpus still precaches.
  const { renameSync, existsSync } = await import('node:fs');
  const MF = ROOT + 'manifest.webmanifest';
  const moved = existsSync(MF);
  if (moved) renameSync(MF, MF + '.away');
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(URL);
    const controlled = await page.evaluate(() =>
      Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise(r => setTimeout(() => r(false), 10000)),
      ]));
    ok('missing manifest: SW still installs', controlled === true);
    await page.waitForTimeout(1000);
    const mods = await page.evaluate(async () => {
      const k = (await caches.keys()).find(x => x.startsWith('aegis-'));
      if (!k) return -1;
      const all = await (await caches.open(k)).keys();
      return all.filter(r => r.url.includes('.arc-module.json')).length;
    });
    ok('missing manifest: corpus still precached', mods === 6, String(mods));
    await ctx.close();
  } finally {
    if (moved) renameSync(MF + '.away', MF);
  }
}

await browser.close();
server.close();
console.log('\nARC fetched-module seam — isolation test');
console.log('─'.repeat(58));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS\n');
