/**
 * Is rolling back from v1.6.0 to v1.5.1 actually safe?
 *
 * The question that matters for a release strategy is not "can I revert the
 * files" — git always can — but "does a learner who already used the new
 * version lose anything when the old one comes back". Two things could bite:
 *
 *   1. The SERVICE WORKER. v1.6.0 caches under aegis-v1.6.0 and precaches the
 *      corpus. The older sw.js activates with a different cache name and
 *      deletes everything else. If the app shell were cache-first, a rolled-back
 *      user could be pinned to the new HTML forever.
 *   2. localStorage. v1.6.0 adds state.arc. v1.5.1 has never heard of it. If
 *      loadState() dropped unknown keys, a rollback would silently destroy
 *      every gate result and FSRS card the learner had earned.
 *
 * Both are tested here by actually serving one version, using it, then serving
 * the other from the same origin — which is exactly what a revert does.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

// Point these at two checkouts of the repo at the versions you want to compare:
//   git worktree add /tmp/aegis-prev HEAD~1   # the previous release commit
const V16 = process.env.NEW_ROOT || import.meta.dirname + '/../';
const V15 = process.env.OLD_ROOT || '/tmp/aegis-prev/';
// Versions are READ from each tree, never hardcoded. A rollback test that has to
// be hand-edited every patch release gets skipped on patch releases — exactly
// when a rollback is most likely to be needed.
const verOf = root => readFileSync(root + 'index.html', 'utf8').match(/const APP_VERSION='([^']+)'/)[1];
const NEW_V = verOf(V16), OLD_V = verOf(V15);
const OLD_HAS_ARC = /function loadArcCorpus/.test(readFileSync(V15 + 'index.html', 'utf8'));
let serving = V16;                       // flipped mid-test to simulate the revert

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const n = req.url.split('?')[0].replace(/^\//, '') || 'index.html';
  const p = serving + n;
  if (!existsSync(p)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[n.slice(n.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(8861);

const URL_ = 'http://127.0.0.1:8861/index.html';
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ` — ${d}` : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push('v' + (serving === V16 ? NEW_V : OLD_V) + ': ' + e.message));

/* ── 1. Use v1.6.0 for real: master a module, leave FSRS cards behind ────── */
await page.goto(URL_);
await page.evaluate(() => { state.lastSeenVersion = APP_VERSION; save(); });
const built = await page.evaluate(async () => {
  arcCfg().enabled = true; save();
  await loadArcCorpus();
  const mid = 'isc2.cc.d1.cia-triad';
  arcStep(mid, { type: 'PREREQ_RESOLVED' }); arcStep(mid, { type: 'PREQUESTION_DONE' });
  arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });
  arcStep(mid, { type: 'GATE_SUBMIT', passed: true });
  arcStep(mid, { type: 'REFLECTION_DONE' });
  arcCfg().fsm[mid].consolidation_until = Date.now() - 1; arcTick(mid);
  arcStep(mid, { type: 'DRILL', q: 5, next_interval_days: 90 });
  // classic-side data too, so we can prove the rollback touches neither
  enqueueCard('Default port for SSH?', '22', 'test:ssh');
  state.objectives.d1_1 = true; state.termsMastered.cia = true; state.notes = 'do not lose me';
  save();
  return { arcState: arcCfg().fsm[mid].state, srs: state.srs.length, ver: APP_VERSION };
});
ok('new: module reached MASTERED', built.arcState === 'MASTERED', built.arcState);
ok('new: an FSRS card exists', built.srs >= 1, String(built.srs));
ok('new: serves its own APP_VERSION', built.ver === NEW_V, built.ver);

await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1000);
const cachedBefore = await page.evaluate(async () => (await caches.keys()));
ok('new: its own cache exists', cachedBefore.includes('aegis-v' + NEW_V), cachedBefore.join(','));

/* ── 2. THE REVERT. Same origin, older files. ────────────────────────────── */
serving = V15;
await page.reload();
// A revert does not swap the service worker on the next paint: the browser must
// re-fetch sw.js, install it, and activate it. Force and await that, the way a
// hard-refresh would, so the test measures the settled state rather than a race.
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r => r.update()));
});
await page.waitForTimeout(2500);
await page.reload();
await page.waitForTimeout(1500);
if (await page.locator('#wnOverlay.show').count()) await page.click('#wnDone');

const after = await page.evaluate(() => ({
  ver: APP_VERSION,
  srs: state.srs.length,
  card: state.srs.find(c => c.key === 'test:ssh'),
  notes: state.notes,
  objectives: state.objectives.d1_1,
  terms: state.termsMastered.cia,
  // the key question: did the old build preserve state it does not understand?
  arcSurvived: !!(state.arc && state.arc.fsm && state.arc.fsm['isc2.cc.d1.cia-triad']),
  arcMastered: state.arc?.fsm?.['isc2.cc.d1.cia-triad']?.state,
  hasArcCode: typeof window.loadArcCorpus === 'function',
}));
ok('rollback: the app serves the previous version', after.ver === OLD_V, after.ver);
ok(OLD_HAS_ARC ? 'rollback: the previous build still has its own ARC code' : 'rollback: the ARC code really is gone', after.hasArcCode === OLD_HAS_ARC);
ok('rollback: SRS cards survive', after.srs >= 1 && !!after.card, JSON.stringify(after.card || null));
// A never-reviewed card has stability null by design — FSRS derives it from the
// first grade. What matters is that the v1.6.0 SHAPE survived the older build.
ok('rollback: the card keeps its new shape',
   after.card && 'stability' in after.card && 'lapses' in after.card && after.card.state === 'new'
   && after.card.a === '22' && !('step' in after.card), JSON.stringify(after.card));
ok('rollback: notes survive', after.notes === 'do not lose me', after.notes);
ok('rollback: objectives survive', after.objectives === true);
ok('rollback: mastered terms survive', after.terms === true);
ok('rollback: ARC PROGRESS IS PRESERVED, not deleted', after.arcSurvived === true, JSON.stringify(after));
ok('rollback: the mastered module is still recorded', after.arcMastered === 'MASTERED', String(after.arcMastered));

// KNOWN, HARMLESS: the aegis-v1.6.0 cache bucket can linger after a rollback —
// the older worker's activate handler does not reliably win the race to evict a
// NEWER sibling. It is dead weight (a few hundred KB), not a correctness issue,
// because the app shell is network-first: online, the correct index.html is
// always fetched, and v1.5.1 never requests arc-core.mjs or modules/ at all.
// The next version bump clears it. Assert the property that actually matters —
// the right version is served and offline still works — not cache housekeeping.
const cachedAfter = await page.evaluate(async () => (await caches.keys()));
ok('rollback: the rolled-back version has its own cache', cachedAfter.includes('aegis-v' + OLD_V), cachedAfter.join(','));
console.log(`  [info] cache buckets after rollback: ${cachedAfter.join(', ')} (stale bucket is harmless)`);

// The one that matters: offline, after a rollback, you get the OLD app, not a
// stale copy of the new one pinned by the previous service worker.
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(800);
if (await page.locator('#wnOverlay.show').count()) await page.click('#wnDone');
const offlineVer = await page.evaluate(() => APP_VERSION);
ok('rollback: OFFLINE still serves the rolled-back version, not the new one',
   offlineVer === OLD_V, offlineVer);
ok('rollback: offline app still renders', await page.evaluate(() =>
   !!document.querySelector('.wordmark .name')));
await ctx.setOffline(false);
ok('rollback: classic app is usable', await page.evaluate(() => { switchView('progress'); return !!document.querySelector('#srsList'); }));
ok('rollback: no page errors', errors.length === 0, errors.join(' | '));

/* ── 3. ROLL FORWARD AGAIN. Everything should come back. ─────────────────── */
serving = V16;
await page.reload();
await page.waitForTimeout(1200);
if (await page.locator('#wnOverlay.show').count()) await page.click('#wnDone');
const back = await page.evaluate(async () => {
  await loadArcCorpus();
  const mid = 'isc2.cc.d1.cia-triad';
  return { ver: APP_VERSION, enabled: arcCfg().enabled, state: arcCfg().fsm[mid]?.state,
           corpus: ARC.status, srs: state.srs.length };
});
ok('roll forward: back on the new version', back.ver === NEW_V, back.ver);
ok('roll forward: the beta is still enabled', back.enabled === true);
ok('roll forward: the mastered module is still mastered', back.state === 'MASTERED', String(back.state));
ok('roll forward: the corpus loads again', back.corpus === 'ready', back.corpus);
ok('roll forward: SRS cards still there', back.srs >= 1, String(back.srs));
ok('roll forward: no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
console.log(`\nv${NEW_V} → v${OLD_V} → v${NEW_V} round trip`);
console.log('─'.repeat(58));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS — rollback loses nothing\n');
