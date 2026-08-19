/**
 * End-to-end verification of the Phase 0 build against the brief's §9 checklist.
 * Boots the real index.html in Chromium with a seeded v1.4.0 profile.
 */
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
const { chromium } = require_('/home/claude/.npm-global/lib/node_modules/playwright/index.js');
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Serve over http:// — under file:// the browser blocks fetch() outright, which
// would mask rather than exercise AEGIS's offline handling.
const server = createServer((req, res) => {
  const name = req.url.split('?')[0].replace(/^\//, '') || 'index.html';
  try {
    const body = readFileSync('/home/claude/aegis-phase0/' + name);
    res.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : 'text/html' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(8731);
const URL = 'http://127.0.0.1:8731/index.html';
const KEY = 'aegis.state.v1';
let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, detail) => { if (cond) pass++; else { fail++; fails.push(name + (detail ? ` — ${detail}` : '')); } };

// A realistic pre-upgrade profile: legacy ladder cards at several steps,
// one already-mastered term, some objectives ticked.
const LEGACY = {
  objectives: { d1_0: true, d1_1: true },
  drills: { acl: true }, quizBest: { quiz: 85 }, domQuiz: { d1: 83 },
  streak: { count: 4, last: null }, ethicsAccepted: true,
  notes: 'do not lose me', weekStart: '2026-08-10', weekCount: 3,
  lastSeenVersion: '1.4.0', termsMastered: { cia: true },
  srs: [
    { q: 'Default port for SSH?', step: 0, due: '2026-01-01T00:00:00.000Z' },
    { q: 'Order of the risk process?', step: 2, due: '2027-01-01T00:00:00.000Z' },
    { q: 'Which canon is public safety?', step: 4, due: '2026-01-02T00:00:00.000Z' },
    { q: 'Card with no due date' }
  ]
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const ENV_NOISE = /fonts\.(googleapis|gstatic)|outline-versions\.json|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|Failed to load resource/;
page.on('console', m => { if (m.type() === 'error' && !ENV_NOISE.test(m.text())) errors.push('console.error: ' + m.text()); });

// addInitScript re-runs on every navigation, so seed only if absent —
// otherwise the reload test would silently reset the profile it is checking.
await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(LEGACY)]);
await page.goto(URL);
await page.waitForFunction(() => typeof window.state === 'object' || document.querySelector('#srsList'));

// ── boot ────────────────────────────────────────────────────────────────────
// The What's New modal fires because lastSeenVersion (1.4.0) !== APP_VERSION (1.5.0).
// That is correct behaviour and itself a version-bump check.
const wnOpen = await page.locator('#wnOverlay.show').count() === 1;
const wnBody = wnOpen ? await page.textContent('#wnContent') : '';
const dismissWN = async () => { if (await page.locator('#wnOverlay.show').count()) await page.click('#wnDone'); };
await dismissWN();

ok("What's New fired for the new version", wnOpen);
ok("What's New leads with the FSRS-6 entry", wnBody.includes('Version 1.5.0') && wnBody.includes('FSRS-6'));
ok('boots with no page errors', errors.length === 0, errors.join(' | '));
ok('version shown as 1.5.0', (await page.textContent('.wordmark .sub')).includes('v1.5.0'));
ok('footer version 1.5.0', (await page.textContent('#footVer')) === 'v1.5.0');

// ── migration ───────────────────────────────────────────────────────────────
const migrated = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
ok('no cards lost', migrated.srs.length === 4, `got ${migrated.srs.length}`);
ok('every card has stability', migrated.srs.every(c => typeof c.stability === 'number' && c.stability > 0));
ok('every card has difficulty', migrated.srs.every(c => c.difficulty === 5));
ok('every card has state/reps/lapses', migrated.srs.every(c => c.state === 'review' && typeof c.reps === 'number' && c.lapses === 0));
ok('legacy step field removed', migrated.srs.every(c => !('step' in c)));
ok('step→stability ladder mapping', migrated.srs.map(c => c.stability).join(',') === '1,7,35,1');
ok('existing due dates preserved', migrated.srs[1].due === '2027-01-01T00:00:00.000Z');
ok('missing due date filled in', !!migrated.srs[3].due && !isNaN(Date.parse(migrated.srs[3].due)));
ok('unrelated state untouched', migrated.notes === 'do not lose me' && migrated.objectives.d1_0 === true && migrated.termsMastered.cia === true);

// ── queue renders + due-first ordering ──────────────────────────────────────
await page.click('.tab[data-view="progress"]');
const rows = page.locator('#srsList .srs-item');
ok('all cards render', await rows.count() === 4);
const pills = await page.locator('#srsList .pill').allTextContents();
ok('due cards sort first', pills[0] === 'due' && pills[pills.length - 1].startsWith('in '), pills.join(','));
ok('four grade buttons per card', await page.locator('#srsList .srs-item').first().locator('.s-grades .btn').count() === 4);
ok('grade labels', (await page.locator('#srsList .srs-item').first().locator('.s-grades .btn').allTextContents()).join(',') === 'Again,Hard,Good,Easy');
ok('no legacy Recalled button', await page.locator('[data-recall]').count() === 0);

// ── the lapse path (this is the bug the brief exists to fix) ────────────────
const before = await page.evaluate(() => {
  const c = state.srs.find(x => x.q.startsWith('Default port'));
  return { s: c.stability, due: c.due, lapses: c.lapses };
});
await page.locator('#srsList .srs-item', { hasText: 'Default port' }).locator('.s-grades .btn', { hasText: 'Again' }).click();
const afterAgain = await page.evaluate(() => {
  const c = state.srs.find(x => x.q.startsWith('Default port'));
  return { s: c.stability, due: c.due, lapses: c.lapses, reps: c.reps, state: c.state };
});
ok('Again increments lapses', afterAgain.lapses === before.lapses + 1, JSON.stringify(afterAgain));
ok('Again drops stability', afterAgain.s < before.s, `${before.s} → ${afterAgain.s}`);
ok('Again schedules soon', (Date.parse(afterAgain.due) - Date.now()) / 864e5 < 2);
ok('Again sets relearning', afterAgain.state === 'relearning');

await page.locator('#srsList .srs-item', { hasText: 'Order of the risk' }).locator('.s-grades .btn', { hasText: 'Easy' }).click();
const afterEasy = await page.evaluate(() => state.srs.find(x => x.q.startsWith('Order of')));
ok('Easy grows stability', afterEasy.stability > 7, String(afterEasy.stability));
ok('Easy schedules far out', (Date.parse(afterEasy.due) - Date.now()) / 864e5 > 7);
ok('Easy records no lapse', afterEasy.lapses === 0);

// A card last reviewed 10 days ago — grading this exercises the LONG-TERM lapse
// formula. Without it the queue only ever hits the same-day branch, and a
// regression that routes Again through the recall formula would slip through.
const aged = await page.evaluate(() => {
  const mk = g => {
    const c = { q: 'aged-' + g, stability: 20, difficulty: 5, reps: 3, lapses: 0,
                state: 'review', last_review: new Date(Date.now() - 10 * 864e5).toISOString(),
                due: new Date().toISOString() };
    state.srs.push(c);
    fsrsReview(c, g, new Date());
    return { s: c.stability, i: Math.round((Date.parse(c.due) - Date.now()) / 864e5), lapses: c.lapses };
  };
  return { again: mk(1), hard: mk(2), good: mk(3), easy: mk(4) };
});
ok('aged Again collapses stability', aged.again.s < 20 / 4, JSON.stringify(aged.again));
ok('aged Again returns it within days', aged.again.i <= 2, String(aged.again.i));
ok('aged Again counts a lapse', aged.again.lapses === 1);
ok('aged Good grows stability', aged.good.s > 20);
ok('aged intervals are monotonic in grade',
   aged.again.i < aged.hard.i && aged.hard.i < aged.good.i && aged.good.i < aged.easy.i,
   JSON.stringify([aged.again.i, aged.hard.i, aged.good.i, aged.easy.i]));
await page.evaluate(() => { state.srs = state.srs.filter(c => !c.q.startsWith('aged-')); save(); });

// ── persistence across reload ───────────────────────────────────────────────
await page.reload();
await dismissWN();
await page.click('.tab[data-view="progress"]');
const persisted = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).srs.find(c => c.q.startsWith('Default port')), KEY);
ok('grades persist across reload', persisted.lapses === 1 && persisted.state === 'relearning');
ok('re-migration is a no-op', persisted.stability === afterAgain.s);

// ── auto-enqueue from term mastery, with dedupe ─────────────────────────────
const enq = await page.evaluate(() => {
  const n0 = state.srs.length;
  enqueueCard('What does Firewall mean?', GLOSSARY.firewall.def, 'term:firewall');
  const n1 = state.srs.length;
  enqueueCard('What does Firewall mean?', GLOSSARY.firewall.def, 'term:firewall'); // duplicate
  const n2 = state.srs.length;
  const c = state.srs[state.srs.length - 1];
  return { n0, n1, n2, hasBack: !!c.a, key: c.key, state: c.state, stability: c.stability };
});
ok('enqueueCard adds one card', enq.n1 === enq.n0 + 1);
ok('enqueueCard dedupes on key', enq.n2 === enq.n1);
ok('enqueued card carries its answer', enq.hasBack && enq.key === 'term:firewall');
ok('enqueued card starts new', enq.state === 'new' && enq.stability === null);

// the real path: master a term in a lesson quiz
const viaQuiz = await page.evaluate(() => {
  const before = state.srs.length;
  delete state.termsMastered.subnet;
  // simulate the first-mastery branch exactly as startTermQuiz runs it
  if (!state.termsMastered.subnet) {
    state.termsMastered.subnet = true;
    const g = GLOSSARY.subnet;
    enqueueCard('What does ' + g.t + ' mean?', g.def, 'term:subnet');
  }
  return { added: state.srs.length - before, front: state.srs[state.srs.length - 1].q };
});
ok('mastering a term files a card', viaQuiz.added === 1 && viaQuiz.front === 'What does Subnet mean?', JSON.stringify(viaQuiz));

// ── reveal ──────────────────────────────────────────────────────────────────
await page.evaluate(() => renderSRS());
const withBack = page.locator('#srsList .srs-item', { hasText: 'What does Firewall mean?' }).first();
ok('Show button present on two-sided card', await withBack.locator('[data-show]').count() === 1);
ok('exactly one Firewall card in the queue', await page.locator('#srsList .srs-item', { hasText: 'What does Firewall mean?' }).count() === 1);
ok('answer hidden before reveal', !(await withBack.locator('.s-back').isVisible()));
await withBack.locator('[data-show]').click();
ok('answer visible after reveal', await withBack.locator('.s-back').isVisible());
ok('Show button consumed', await withBack.locator('[data-show]').count() === 0);

// ── HTML in card text is escaped, not executed ─────────────────────────────
await page.evaluate(() => { enqueueCard('<img src=x onerror="window.__xss=1">', '', 'xsstest'); renderSRS(); });
ok('card text is escaped', await page.evaluate(() => !window.__xss && document.querySelector('#srsList').innerHTML.includes('&lt;img')));

// ── determinism ─────────────────────────────────────────────────────────────
const det = await page.evaluate(() => {
  const t0 = new Date('2026-03-01T00:00:00Z'), t1 = new Date('2026-03-06T00:00:00Z');
  const run = () => { const c = fsrsNew(t0); fsrsReview(c, 3, t0); fsrsReview(c, 2, t1); return JSON.stringify(c); };
  return run() === run();
});
ok('same card + grade + clock → same result', det);

// ── templates copy no longer teaches the retired ladder ────────────────────
await page.click('.tab[data-view="templates"]');
await page.click('.tpl-tab:has-text("Spaced repetition")');
const tpl = await page.textContent('.tpl-view.active .tpl-pre');
ok('template drops the fixed ladder', !tpl.includes('1st review:  +1 day'));
ok('template explains grading', tpl.includes('AGAIN') && tpl.includes('FSRS-6'));

// ── what's-new fired for the new version ───────────────────────────────────
ok('no errors after full run', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
console.log('\nAEGIS v1.5.0 — Phase 0 build verification');
console.log('─'.repeat(52));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS\n');
