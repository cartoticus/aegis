/**
 * Step A (v1.7.0) — meters, welcome-back card, explainer, overdue gate,
 * consolidation exits. Functional suite; the layout sweep for the same surfaces
 * lives in verify-mobile-ui.mjs §5.
 *
 * House rules this file follows:
 *   - Every assertion must FAIL when the thing it names is removed — each
 *     feature here has a fault in fault-inject.mjs (S*).
 *   - Prove the precondition first (a "card dismissed" check passes on a card
 *     that was never shown).
 *   - Boundaries from both sides: 3 overdue blocks AND 2 does not; 49h blocks
 *     AND 47h does not.
 *   - Drive the learner-facing controls through the real DOM (clicks), and set
 *     up state through the same engine the app uses.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.env.APP_ROOT || import.meta.dirname + '/../';
const REPO = join(import.meta.dirname, '..');
const PORT = Number(process.env.PORT_BASE || 8821);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

// The last release before Step A — the "toggle OFF is identical" reference.
const V161_COMMIT = '5a2e98d';
let V161 = null;
try { V161 = execFileSync('git', ['-C', REPO, 'show', `${V161_COMMIT}:index.html`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}

const server = createServer((req, res) => {
  const n = req.url.split('?')[0].replace(/^\//, '') || 'index.html';
  if (n === 'v161.html' && V161) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(V161); }
  let b; try { b = readFileSync(ROOT + n); } catch { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[n.slice(n.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(b);
}).listen(PORT);
const BASE = `http://127.0.0.1:${PORT}/`;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ` — ${d}` : '')); } };
/* Click a learner-facing control only if it exists: a missing control must show
   up as a named failed assertion, not as a click timeout that aborts the suite. */
const tap = async (page, sel, name) => {
  const n = await page.locator(sel).count() && await page.locator(sel).first().isVisible();
  ok(`${name} — control ${sel} is there to press`, !!n);
  if (n) await page.click(sel);
  return !!n;
};

const M = {
  cia: 'isc2.cc.d1.cia-triad', auth: 'isc2.cc.d1.authn-nonrep-privacy', ctrl: 'isc2.cc.d1.control-types',
  eth: 'isc2.cc.d1.code-of-ethics', risk: 'isc2.cc.d1.risk-lifecycle', gov: 'isc2.cc.d1.governance',
};

const browser = await chromium.launch();
const errors = [];

/* seed: undefined → a returning learner (What's New already seen);
   null → a brand-new install (no saved state at all). */
async function open({ seed, width = 390, file = 'index.html' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  if (seed !== null) await ctx.addInitScript(s => {
    try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('aegis.state.v1', JSON.stringify(s)); sessionStorage.setItem('__seeded', '1'); } } catch {}
  }, seed || { lastSeenVersion: '__returning__' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + file);
  return { ctx, page };
}
const returning = async (opts = {}) => {
  const r = await open(opts);
  await r.page.evaluate(() => { state.lastSeenVersion = APP_VERSION; closeWhatsNew(); save(); });
  return r;
};
const arcOn = page => page.evaluate(async () => { arcCfg().enabled = true; save(); await loadArcCorpus(); render(); });

/* Put the FSM / cards / reading ticks into a known shape. FSM objects come from
   the engine's own initialState(); cards from the app's own fsrsNew(). */
const setup = (page, cfg) => page.evaluate(cfg => {
  const a = arcCfg(); a.fsm = {}; a.cards = {}; a.log = cfg.log || [];
  const now = Date.now();
  for (const [id, st] of Object.entries(cfg.fsm || {}))
    a.fsm[id] = { ...ARC.engine.initialState('LOCKED'), state: st, ...((cfg.extra || {})[id] || {}) };
  for (const [id, hrs] of Object.entries(cfg.overdueH || {})) {
    const c = fsrsNew(new Date()); c.due = new Date(now - hrs * 3600e3).toISOString(); a.cards[id] = c;
  }
  if (cfg.objectives) state.objectives = cfg.objectives;
  if ('lastWelcomeSeen' in cfg) state.lastWelcomeSeen = cfg.lastWelcomeSeen;
  save(); render();
}, cfg);
const meters = page => page.evaluate(() => {
  const c = document.getElementById('arcMeters');
  return c ? { ...c.dataset, txtR: c.querySelector('#arcmReading').textContent, txtA: c.querySelector('#arcmArc').textContent,
    txtO: c.querySelector('#arcmOverall').textContent } : null;
});

/* ══ S1. Toggle OFF: dashboard identical to v1.6.1 ══════════════════════════ */
{
  ok('S1: v1.6.1 reference is available from git history (else S1 proves nothing)', !!V161);
  const dashOf = async file => {
    const { ctx, page } = await open({ file });
    const html = await page.evaluate(() => { state.lastSeenVersion = APP_VERSION; closeWhatsNew(); switchView('dash'); render();
      return { dash: document.getElementById('view-dash').outerHTML,
        meters: !!document.getElementById('arcMeters'), welcome: !!document.getElementById('welcomeCard'),
        wn: document.getElementById('wnOverlay').classList.contains('show') }; });
    await ctx.close(); return html;
  };
  if (V161) {
    const old = await dashOf('v161.html'), neu = await dashOf('index.html');
    ok('S1: ARC off — no meter card', !neu.meters);
    ok('S1: ARC off — no welcome card on entering the dashboard', !neu.welcome);
    ok('S1: ARC off — Command dashboard markup identical to v1.6.1', old.dash === neu.dash,
      `v1.6.1 ${old.dash.length} chars vs ${neu.dash.length}`);
  }
  // What's New unchanged for a returning learner: it opens, and the explainer does not.
  const { ctx, page } = await open();
  const wn = await page.evaluate(() => ({ wn: document.getElementById('wnOverlay').classList.contains('show'),
    ex: document.getElementById('explainerOverlay').classList.contains('show') }));
  ok('S1: returning learner on a new version still gets What\'s New', wn.wn);
  ok('S1: returning learner does not get the first-open explainer', !wn.ex);
  await ctx.close();
}

/* ══ S2. Meters: guard + re-render on load ══════════════════════════════════ */
{
  const { ctx, page } = await returning();
  const midLoad = await page.evaluate(() => { arcCfg().enabled = true; ARC.status = 'loading'; render();
    const r = !!document.getElementById('arcMeters'); ARC.status = 'idle'; return r; });
  ok('S2: ARC on but corpus still loading — no meter card (no flash)', !midLoad);
  const failed = await page.evaluate(() => { ARC.status = 'unavailable'; render();
    const r = !!document.getElementById('arcMeters'); ARC.status = 'idle'; return r; });
  ok('S2: ARC on but corpus failed — no meter card', !failed);
  await arcOn(page);
  ok('S2: ARC on + corpus ready — meter card renders', !!(await meters(page)));
  const where = await page.evaluate(() => !!document.querySelector('#view-dash .dash-grid #arcMeters'));
  ok('S2: meter card sits inside the dashboard .dash-grid', where);
  await page.evaluate(() => { arcCfg().enabled = false; save(); render(); });
  ok('S2: turning ARC off removes the meter card', !(await meters(page)));
  await ctx.close();

  // Persisted ON across a reload: the card appears once the corpus finishes.
  const r2 = await open({ seed: { lastSeenVersion: '__returning__', arc: { enabled: true, fsm: {}, cards: {}, log: [] } } });
  await r2.page.waitForFunction(() => ARC.status === 'ready' || ARC.status === 'degraded');
  await r2.page.waitForTimeout(50);
  ok('S2: after a reload with ARC on, meters appear when the corpus finishes loading', !!(await meters(r2.page)));
  await r2.ctx.close();
}

/* ══ S3. Meter arithmetic ═══════════════════════════════════════════════════ */
{
  const { ctx, page } = await returning();
  await arcOn(page);
  // Every past-gate state, nothing mastered: Overall must be exactly 0.
  await setup(page, { fsm: { [M.cia]: 'PHASE_4_SPACED_QUEUE', [M.auth]: 'NEEDS_RECALIBRATION', [M.ctrl]: 'PHASE_3_SYNTHESIS',
    [M.eth]: 'CONSOLIDATION_PENDING', [M.risk]: 'PHASE_2_GATE' }, objectives: { d1_0: true, d1_1: true, d1_2: true, d1_3: true, d1_4: true, d1_5: true } });
  let m = await meters(page);
  ok('S3: four past-gate modules, none mastered — Overall 0%', m.overall === '0' && m.txtO === '0%', JSON.stringify(m));
  ok('S3: … ARC % counts the four gate-cleared (incl. NEEDS_RECALIBRATION, CONSOLIDATION_PENDING)', m.cleared === '4' && m.arc === '67', JSON.stringify(m));
  ok('S3: … PHASE_2_GATE does not count as gate-cleared', m.cleared === '4');
  ok('S3: … Reading 100% is independent of retention', m.reading === '100' && m.txtR === '100%');

  await setup(page, { fsm: { [M.cia]: 'MASTERED', [M.auth]: 'NEEDS_RECALIBRATION', [M.ctrl]: 'PHASE_3_SYNTHESIS', [M.eth]: 'PHASE_1_CHUNK' },
    objectives: { d1_0: true, d1_1: true, d1_2: true, d1_3: true } });
  m = await meters(page);
  ok('S3: one MASTERED — Overall 17% (1/6, no partial credit)', m.overall === '17' && m.mastered === '1', JSON.stringify(m));
  ok('S3: … ARC % = 3/6 gate-cleared (mastered included)', m.cleared === '3' && m.arc === '50', JSON.stringify(m));
  ok('S3: … Reading 67% (4 of 6 read)', m.reading === '67', JSON.stringify(m));
  ok('S3: … legacy overallPct() untouched by the new meters', await page.evaluate(() => typeof overallPct() === 'number' && document.getElementById('overallPill').textContent === overallPct() + '% complete'));

  // Tap reveals the split; it is not in the headline.
  const before = await page.evaluate(() => ({ hidden: document.getElementById('arcmDetail').hidden,
    head: document.getElementById('arcmArc').textContent }));
  ok('S3: split detail hidden before the tap (precondition)', before.hidden === true);
  ok('S3: ARC headline carries one number only', /^\d+%$/.test(before.head), before.head);
  await page.evaluate(() => switchView('dash'));
  await page.click('#arcmSplit');
  const after = await page.evaluate(() => { const d = document.getElementById('arcmDetail'); return { hidden: d.hidden, txt: d.textContent }; });
  ok('S3: tapping the ARC bar reveals the split', after.hidden === false && after.txt === '1/6 mastered, 2/6 gate-cleared but not yet retained', JSON.stringify(after));
  const seg = await page.evaluate(() => [...document.querySelectorAll('#arcMeters .arcm-two i')].map(i => i.style.width));
  ok('S3: two-tone bar — mastered segment 1/6, gate-cleared-only segment 2/6', seg.length === 2 && Math.abs(parseFloat(seg[0]) - 100 / 6) < 0.01 && Math.abs(parseFloat(seg[1]) - 200 / 6) < 0.01, seg.join(','));
  await ctx.close();
}

/* ══ S4. Welcome-back card ══════════════════════════════════════════════════ */
const welcome = page => page.evaluate(() => { const c = document.getElementById('welcomeCard'); return c ? c.dataset.kind : null; });
{
  const { ctx, page } = await returning();
  await arcOn(page);
  await setup(page, { fsm: {}, lastWelcomeSeen: null });
  ok('S4: no card before entering the dashboard (precondition)', (await welcome(page)) === null);
  await page.click('.tab[data-view="dash"]');
  ok('S4: entering the dashboard shows the welcome card', (await welcome(page)) !== null);
  ok('S4: … and records today as seen', await page.evaluate(() => state.lastWelcomeSeen === today()));
  await tap(page, '#wcDismiss', 'S4 dismiss');
  ok('S4: Dismiss removes it', (await welcome(page)) === null);
  await page.click('.tab[data-view="progress"]'); await page.click('.tab[data-view="dash"]');
  ok('S4: same calendar day — not shown again', (await welcome(page)) === null);
  await page.evaluate(() => { state.lastWelcomeSeen = new Date(Date.now() - 864e5).toISOString().slice(0, 10); save(); });
  await page.click('.tab[data-view="progress"]'); await page.click('.tab[data-view="dash"]');
  ok('S4: next calendar day — shown again', (await welcome(page)) !== null);

  const kindFor = async cfg => {
    await page.evaluate(() => { document.getElementById('welcomeCard')?.remove(); switchView('progress'); });
    await setup(page, { ...cfg, lastWelcomeSeen: null });
    await page.click('.tab[data-view="dash"]');
    return welcome(page);
  };
  // Rung 1 beats everything below it.
  ok('S4 ladder 1: an overdue review wins', await kindFor({ fsm: { [M.cia]: 'PHASE_4_SPACED_QUEUE', [M.auth]: 'PHASE_1_CHUNK' },
    overdueH: { [M.cia]: 2 } }) === 'review');
  await tap(page, '#wcGo', 'S4 ladder 1');
  const opened = await page.evaluate(() => ({ show: document.getElementById('arcOverlay').classList.contains('show'),
    mid: ARC_UI.moduleId, phase: document.querySelector('#arcContent .arc-phase')?.textContent || '' }));
  ok('S4 ladder 1: "Review now" opens the overdue module at its Phase 4 retrieval', opened.show && opened.mid === M.cia && /Phase 4/.test(opened.phase), JSON.stringify(opened));
  await page.evaluate(() => closeArc());
  // Rung 2: consolidation resolved by the real clock tick through the engine.
  const k2 = await kindFor({ fsm: { [M.cia]: 'CONSOLIDATION_PENDING', [M.auth]: 'PHASE_1_CHUNK' },
    extra: { [M.cia]: { consolidation_until: Date.now() - 60e3 } } });
  ok('S4 ladder 2: a module that finished consolidating beats a mid-loop resume', k2 === 'consolidated', k2);
  ok('S4 ladder 2: … the tick went through the engine and was logged', await page.evaluate(m => arcCfg().fsm[m].state === 'PHASE_4_SPACED_QUEUE'
    && arcCfg().log.some(e => e.module_id === m && e.site === 'consolidation'), M.cia));
  const k2b = await kindFor({ fsm: { [M.cia]: 'CONSOLIDATION_PENDING', [M.auth]: 'PHASE_1_CHUNK' },
    extra: { [M.cia]: { consolidation_until: Date.now() + 3600e3 } } });
  ok('S4 ladder 2: still consolidating does not count as finished', k2b === 'resume', k2b);
  ok('S4 ladder 3: mid-loop module → resume', await kindFor({ fsm: { [M.cia]: 'PHASE_2_GATE' } }) === 'resume');
  ok('S4 ladder 4: nothing in flight → next unstarted objective', await kindFor({ fsm: {} }) === 'next');
  const allDone = Object.fromEntries(Object.values(M).map(id => [id, 'MASTERED']));
  ok('S4 ladder 4: everything mastered and nothing due → caught up', await kindFor({ fsm: allDone }) === 'done');
  await ctx.close();
}
{
  // First-ever open: the explainer instead, never both on the same visit.
  const { ctx, page } = await open({ seed: null });
  const first = await page.evaluate(() => ({ ex: document.getElementById('explainerOverlay').classList.contains('show'),
    wn: document.getElementById('wnOverlay').classList.contains('show') }));
  ok('S4/S5: first-ever open shows the explainer', first.ex);
  ok('S4/S5: … and not What\'s New on top of it', !first.wn);
  await tap(page, '#explainerDone', 'S5 first open');
  ok('S5: closing the explainer then shows What\'s New as before', await page.evaluate(() => document.getElementById('wnOverlay').classList.contains('show')));
  if (await page.locator('#wnOverlay.show').count()) await page.click('#wnDone');
  await arcOn(page);
  await page.click('.tab[data-view="dash"]');
  ok('S4: first-ever visit — no welcome card even with ARC turned on', (await welcome(page)) === null);
  ok('S4: … meters still render (only the card is suppressed)', !!(await meters(page)));
  await ctx.close();
}
{
  // Permanent re-open link on the Progress tab, ARC on or off.
  const { ctx, page } = await returning();
  await page.click('.tab[data-view="progress"]');
  const shut = await page.evaluate(() => document.getElementById('explainerOverlay').classList.contains('show'));
  ok('S5: explainer closed before the link is used (precondition)', !shut);
  ok('S5: re-open link sits in the ARC settings card', await page.evaluate(() => !!document.querySelector('#arcSettings #explainerLink')));
  await tap(page, '#explainerLink', 'S5 re-open');
  const ex = await page.evaluate(() => ({ show: document.getElementById('explainerOverlay').classList.contains('show'),
    txt: document.getElementById('explainerContent').textContent }));
  ok('S5: Progress-tab link opens the explainer', ex.show);
  ok('S5: explainer covers reading vs gate vs mastery, the 24h wait, and overdue',
    /bookmark/i.test(ex.txt) && /gate/i.test(ex.txt) && /mastered/i.test(ex.txt) && /24-hour/.test(ex.txt) && /overdue/i.test(ex.txt));
  if (await page.locator('#explainerOverlay.show').count()) await page.click('#explainerClose');
  ok('S5: re-opening later does not chain What\'s New', await page.evaluate(() => !document.getElementById('wnOverlay').classList.contains('show')));
  await ctx.close();
}

/* ══ S6. Overdue-review gate ════════════════════════════════════════════════ */
{
  const { ctx, page } = await returning();
  await arcOn(page);
  // auth is LOCKED with its prerequisite (cia) met in every case below.
  const lockedView = async overdueH => {
    await setup(page, { fsm: { [M.cia]: 'PHASE_4_SPACED_QUEUE', [M.ctrl]: 'PHASE_4_SPACED_QUEUE', [M.eth]: 'PHASE_4_SPACED_QUEUE' }, overdueH });
    await page.evaluate(m => openArcModule(m), M.auth);
    return page.evaluate(() => {
      const go = document.getElementById('arcGo');
      return { disabled: go.disabled, opacity: parseFloat(getComputedStyle(go).opacity),
        reason: document.getElementById('arcBlocked')?.textContent || null, out: !!document.getElementById('arcReviewFirst') };
    });
  };
  const ok0 = await lockedView({});
  ok('S6: no reviews overdue — Begin is live (precondition)', !ok0.disabled && !ok0.reason);

  const b3 = await lockedView({ [M.cia]: 1, [M.ctrl]: 2, [M.eth]: 3 });
  ok('S6: 3 overdue (<48h each) — Begin blocked', b3.disabled, JSON.stringify(b3));
  ok('S6: … visibly disabled, not a live-looking dead button', b3.opacity < 0.9, String(b3.opacity));
  ok('S6: … says why', /3\+ reviews are overdue/.test(b3.reason || ''), b3.reason);
  ok('S6: … offers the way out', b3.out);
  await tap(page, '#arcReviewFirst', 'S6 way out');
  const went = await page.evaluate(() => ({ mid: ARC_UI.moduleId, phase: document.querySelector('#arcContent .arc-phase')?.textContent || '' }));
  ok('S6: … the way out opens the MOST overdue module at its review', went.mid === M.eth && /Phase 4/.test(went.phase), JSON.stringify(went));

  const b2 = await lockedView({ [M.cia]: 1, [M.ctrl]: 47 });
  ok('S6: 2 overdue (<48h each) — not blocked', !b2.disabled && !b2.reason, JSON.stringify(b2));
  if (!b2.disabled) await page.click('#arcGo');
  ok('S6: … and Begin really starts the module', await page.evaluate(m => arcCfg().fsm[m].state === 'PHASE_0_PREQUESTION', M.auth));

  const b49 = await lockedView({ [M.cia]: 49 });
  ok('S6: 1 overdue by 49h — blocked', b49.disabled && /48 hours/.test(b49.reason || ''), JSON.stringify(b49));
  const b47 = await lockedView({ [M.cia]: 47 });
  ok('S6: 1 overdue by 47h — not blocked', !b47.disabled && !b47.reason, JSON.stringify(b47));
  // A card whose module failed to download could never be reviewed, so it must
  // not be able to lock the learner out.
  const ghost = await lockedView({ 'isc2.cc.d1.not-loaded': 100 });
  ok('S6: an overdue card for a module that did not load never blocks', !ghost.disabled && !ghost.reason, JSON.stringify(ghost));

  // While blocked, nothing else is.
  await lockedView({ [M.cia]: 1, [M.ctrl]: 2, [M.eth]: 3 });
  ok('S6: blocked state holds for the checks below (precondition)', await page.evaluate(() => arcOverdueBlocksNewMaterial().blocked));
  await page.evaluate(() => closeArc());
  await page.evaluate(() => { switchView('domains'); selectDomain(0); });
  await page.click('.learn-btn[data-lesson="d1_1"]');
  ok('S6: blocked — reading still opens', await page.evaluate(() => document.getElementById('lessonOverlay').classList.contains('show')));
  await page.evaluate(() => closeLesson());
  await page.click('.tab[data-view="glossary"]');
  ok('S6: blocked — glossary still opens', await page.evaluate(() => document.getElementById('view-glossary').classList.contains('active')));
  await page.evaluate(() => openTrainer('ethicsjudge'));
  ok('S6: blocked — Range trainers still open', await page.evaluate(() => document.getElementById('stage-ethicsjudge').classList.contains('active')));
  // An in-flight module is not "new material": its review/resume stays open.
  await page.evaluate(m => openArcModule(m), M.cia);
  ok('S6: blocked — an overdue review itself is never blocked', await page.evaluate(() => /Phase 4/.test(document.querySelector('#arcContent .arc-phase')?.textContent || '')));
  await page.evaluate(() => closeArc());
  await ctx.close();
}

/* ══ S7. Consolidation-wait screen exits ════════════════════════════════════ */
{
  const { ctx, page } = await returning();
  await arcOn(page);
  const waitScreen = async (fsm, waiting) => {
    await setup(page, { fsm, extra: { [waiting]: { consolidation_until: Date.now() + 5 * 3600e3 } } });
    await page.evaluate(m => openArcModule(m), waiting);
    return page.evaluate(() => ({
      phase: document.querySelector('#arcContent .arc-phase')?.textContent || '',
      text: document.getElementById('arcContent').textContent,
      module: document.querySelector('[data-exit="module"]')?.textContent || null,
      glossary: !!document.querySelector('[data-exit="glossary"]'), tribunal: !!document.querySelector('[data-exit="tribunal"]'),
    }));
  };
  // Another objective unlocked: cia is in review (not due), auth consolidating, ctrl LOCKED with prereq met.
  const s1 = await waitScreen({ [M.cia]: 'MASTERED', [M.auth]: 'CONSOLIDATION_PENDING' }, M.auth);
  ok('S7: on the consolidation screen (precondition)', /Consolidating/.test(s1.phase), s1.phase);
  ok('S7: countdown and "nothing shortens it" kept', /\dh \d+m/.test(s1.text) && /Nothing you do here can shorten it/.test(s1.text));
  ok('S7: another unlocked objective → "While you wait" link', /^While you wait: .+ is ready →$/.test(s1.module || ''), s1.module);
  ok('S7: … names a module that really is unlocked', /Control Types/.test(s1.module || ''), s1.module);
  await tap(page, '[data-exit="module"]', 'S7 while-you-wait');
  ok('S7: … and it opens that module', await page.evaluate(m => ARC_UI.moduleId === m && !!document.getElementById('arcGo'), M.ctrl));
  // Nothing else unlocked: the root is the one consolidating.
  const s2 = await waitScreen({ [M.cia]: 'CONSOLIDATION_PENDING' }, M.cia);
  ok('S7: none unlocked — no module link', s2.module === null, s2.module);
  ok('S7: none unlocked — glossary exit still there', s2.glossary);
  ok('S7: none unlocked — Ethics Tribunal exit still there', s2.tribunal);
  await tap(page, '[data-exit="glossary"]', 'S7 glossary exit');
  ok('S7: glossary exit closes the overlay and opens the glossary', await page.evaluate(() =>
    !document.getElementById('arcOverlay').classList.contains('show') && document.getElementById('view-glossary').classList.contains('active')));
  await waitScreen({ [M.cia]: 'CONSOLIDATION_PENDING' }, M.cia);
  await tap(page, '[data-exit="tribunal"]', 'S7 tribunal exit');
  ok('S7: tribunal exit opens the Ethics Tribunal', await page.evaluate(() =>
    !document.getElementById('arcOverlay').classList.contains('show') && document.getElementById('stage-ethicsjudge').classList.contains('active')));
  await ctx.close();
}

/* ══ S8. Hints: every Domain-1 gate still has its hints (audit replaced, never deleted) ══ */
{
  const { ctx, page } = await returning();
  await arcOn(page);
  const h = await page.evaluate(ids => ids.map(id => (arcModule(id)?.gate.hints || []).filter(x => typeof x === 'string' && x.trim().length > 40).length), Object.values(M));
  ok('S8: all six gates ship two non-empty hints', h.every(n => n === 2), h.join(','));
  await ctx.close();
}

await browser.close();
server.close();
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log('\nStep A — meters · welcome · explainer · overdue gate · consolidation exits');
console.log('─'.repeat(58));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS\n');
