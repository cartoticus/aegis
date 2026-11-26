/**
 * Phase 2 (v1.8.0) — five pilot modules across Domains 2-5, each gated by a
 * Range trainer. Functional suite; the width sweep for the same gates lives in
 * verify-mobile-ui.mjs §6.
 *
 * House rules (same as verify-step-a.mjs):
 *   - Every assertion must FAIL when the thing it names is removed — each has a
 *     fault in fault-inject.mjs (P*).
 *   - Prove the precondition first.
 *   - Two submissions, not one: a wrong answer must fail AND a right one pass,
 *     both entered through the real DOM and scored from what is on screen.
 *   - Read results in the same task as the action when the browser can race you.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.env.APP_ROOT || import.meta.dirname + '/../';
const REPO = join(import.meta.dirname, '..');
const PORT = Number(process.env.PORT_BASE || 8831);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

// The last release before Phase 2 — the "ARC off is identical" reference.
const V171_COMMIT = '00f6414';
let V171 = null;
try { V171 = execFileSync('git', ['-C', REPO, 'show', `${V171_COMMIT}:index.html`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}

const server = createServer((req, res) => {
  const n = req.url.split('?')[0].replace(/^\//, '') || 'index.html';
  if (n === 'v171.html' && V171) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(V171); }
  let b; try { b = readFileSync(ROOT + n); } catch { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[n.slice(n.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(b);
}).listen(PORT);
const BASE = `http://127.0.0.1:${PORT}/`;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ` — ${d}` : '')); } };
const tap = async (page, sel, name) => {
  const loc = page.locator(sel);
  const n = await loc.count() && await loc.first().isVisible() && await loc.first().isEnabled();
  ok(`${name} — control ${sel} is there to press`, !!n);
  if (n) await loc.first().click();
  return !!n;
};

const P2 = {
  ir: 'isc2.cc.d2.incident-response', lp: 'isc2.cc.d3.least-privilege', sub: 'isc2.cc.d4.subnetting',
  sa: 'isc2.cc.d5.security-awareness', log: 'isc2.cc.d5.logging-monitoring',
};
const D1 = ['isc2.cc.d1.cia-triad', 'isc2.cc.d1.authn-nonrep-privacy', 'isc2.cc.d1.control-types',
  'isc2.cc.d1.code-of-ethics', 'isc2.cc.d1.risk-lifecycle', 'isc2.cc.d1.governance'];
const KEYS = { d2_3: P2.ir, d3_1: P2.lp, d4_1: P2.sub, d5_1: P2.sa, d5_2: P2.log };

const browser = await chromium.launch();
const errors = [];

async function open({ width = 390, height = 844, file = 'index.html' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(() => {
    try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('aegis.state.v1', JSON.stringify({ lastSeenVersion: '__returning__' })); sessionStorage.setItem('__seeded', '1'); } } catch {}
  });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + file);
  await page.evaluate(() => { state.lastSeenVersion = APP_VERSION; closeWhatsNew(); state.lastWelcomeSeen = today(); save(); });
  return { ctx, page };
}
const arcOn = page => page.evaluate(async () => { arcCfg().enabled = true; save(); await loadArcCorpus(); syncArcButtons(); render(); });
/* FSM states from the engine's own initialState(); the CIA root is mastered so
   every Phase 2 module's only prerequisite is met. */
const setup = (page, cfg = {}) => page.evaluate(cfg => {
  const a = arcCfg(); a.fsm = {}; a.cards = {}; a.log = [];
  const fsm = { 'isc2.cc.d1.cia-triad': 'MASTERED', ...(cfg.fsm || {}) };
  for (const [id, st] of Object.entries(fsm)) if (st) a.fsm[id] = { ...ARC.engine.initialState('LOCKED'), state: st, ...((cfg.extra || {})[id] || {}) };
  const now = Date.now();
  for (const [id, hrs] of Object.entries(cfg.overdueH || {})) { const c = fsrsNew(new Date()); c.due = new Date(now - hrs * 3600e3).toISOString(); a.cards[id] = c; }
  if (cfg.objectives) state.objectives = cfg.objectives;
  if ('lastWelcomeSeen' in cfg) state.lastWelcomeSeen = cfg.lastWelcomeSeen;
  if (cfg.drills) state.drills = cfg.drills;
  save(); render();
}, cfg);
const st = (page, id) => page.evaluate(id => arcCfg().fsm[id]?.state, id);
const resultText = page => page.evaluate(() => document.querySelector('#arcContent .scn-feedback')?.innerText || '');
const spec = (page, id, which = 'gate') => page.evaluate(([id, w]) => {
  const m = arcModule(id); return w === 'gate' ? m.gate : m.drills.find(d => d.interval_tier === w);
}, [id, which]);

/* ---- drive any widget through the real DOM ---- */
async function fill(page, sp, answer) {
  const vp = sp.validation_payload, met = vp.accuracy_metric;
  if (met === 'bucket_assignment') {
    // answer: {itemText: bucket}; items not in answer are left unclassified
    const rows = page.locator('#arcWidget .arc-item');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const txt = (await rows.nth(i).locator('.ai-txt').innerText()).trim();
      if (answer[txt] && await rows.nth(i).locator('select').count()) await rows.nth(i).locator('select').selectOption(answer[txt]);
    }
  } else if (met === 'kendall_tau') {
    // click-sort with the ↑ buttons until the on-screen order equals `answer`
    for (let t = 0; t < answer.length; t++) {
      for (let guard = 0; guard < 10; guard++) {
        const order = await page.$$eval('#arcWidget .arc-order li > span:first-child', xs => xs.map(x => x.textContent));
        const at = order.indexOf(answer[t]);
        if (at <= t) break;
        const b = page.locator(`#arcWidget [data-mv="${at}:-1"]`);
        if (!(await b.count())) { ok('fill: reorder control present', false, `no ↑ at ${at}`); return; }
        await b.click();
      }
    }
  } else if (met === 'set_f1') {
    for (const v of answer) { const c = page.locator(`#arcWidget [data-pick="${v.replace(/"/g, '\\"')}"]`); if (await c.count()) await c.check(); else ok('fill: option present', false, v); }
  } else if (met === 'correct_slot_ratio') {
    for (let i = 0; i < answer.length; i++) { const f = page.locator(`#arcWidget .arc-in[data-slot="${i}"]`); if (await f.count()) await f.fill(answer[i]); else ok('fill: slot present', false, String(i)); }
  } else if (met === 'keyword_density') {
    await page.fill('#arcWidget .arc-free', answer);
  }
}
const perfect = sp => {
  const vp = sp.validation_payload;
  switch (vp.accuracy_metric) {
    case 'bucket_assignment': return Object.fromEntries(Object.entries(vp.buckets).flatMap(([b, xs]) => xs.map(x => [x, b])));
    case 'kendall_tau': return vp.correct.slice();
    case 'set_f1': return vp.correct_set.slice();
    case 'correct_slot_ratio': return vp.accept.map(a => a[0]);
    default: return vp.required_keywords.join(' ');
  }
};
const wrong = sp => {
  const vp = sp.validation_payload;
  switch (vp.accuracy_metric) {
    case 'bucket_assignment': { const names = Object.keys(vp.buckets);   // every item in the next bucket over
      return Object.fromEntries(Object.entries(vp.buckets).flatMap(([b, xs]) => xs.map(x => [x, names[(names.indexOf(b) + 1) % names.length]]))); }
    case 'kendall_tau': return vp.correct.slice().reverse();
    case 'set_f1': return vp.distractors.slice();
    case 'correct_slot_ratio': return vp.accept.map(() => '0.0.0.0');
    default: return 'nothing relevant at all written in this answer box';
  }
};
async function submitGate(page, answer, { conf = 3, hint = false } = {}) {
  const sp = await page.evaluate(() => ARC_UI.module.gate);
  await fill(page, sp, answer);
  if (hint) await tap(page, '#arcHint', 'reveal a hint');
  if (!(await tap(page, `#arcConf [data-conf="${conf}"]`, 'record confidence'))) return { enabled: false, text: await resultText(page), screen: await page.locator('#arcContent').innerText() };
  const enabled = await page.locator('#arcSubmit').isEnabled();
  if (enabled) await page.click('#arcSubmit');
  return { enabled, text: await resultText(page), screen: await page.locator('#arcContent').innerText() };
}
const cont = async page => { if (!await tap(page, '#arcNext', 'Continue after a result')) console.log('    [debug] no Continue:', (await page.locator('#arcContent').innerText()).slice(0, 400)); };

/* ══ P0. Corpus: all eleven modules load, every Phase 2 key is mapped ════════ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  const c = await page.evaluate(() => ({ status: ARC.status, ids: ARC.modules.map(m => m.id), dropped: ARC.dropped,
    map: ARC_OBJECTIVE_MAP, all: arcAllModuleIds(), d1: arcDomain1ModuleIds(),
    corpus: ARC.engine.validateCorpus ? ARC.engine.validateCorpus(ARC.modules) : null }));
  ok('P0: corpus ready, nothing dropped', c.status === 'ready' && !c.dropped.length, JSON.stringify(c.dropped));
  for (const [k, id] of Object.entries(KEYS)) {
    ok(`P0: ${k} maps to ${id}`, c.map[k] === id, c.map[k]);
    ok(`P0: ${id} loaded`, c.ids.includes(id));
  }
  ok('P0: arcAllModuleIds sees all 11', c.all.length === 11, String(c.all.length));
  ok('P0: arcDomain1ModuleIds is exactly the six D1 modules', JSON.stringify(c.d1) === JSON.stringify(D1), JSON.stringify(c.d1));
  const btns = await page.$$eval('#domPanels .arc-btn', bs => bs.map(b => b.dataset.arc));
  for (const id of Object.values(P2)) ok(`P0: ARC button rendered for ${id}`, btns.includes(id));
  ok('P0: corpus DAG valid (validateCorpus)', Array.isArray(c.corpus) && c.corpus.length === 0, JSON.stringify(c.corpus));
  await ctx.close();
}

/* ══ P0b. A Phase 2 module whose prerequisite cannot resolve must not load ══ */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  // serve d3-01 with a prerequisite that has no module (the V11 trap the brief names)
  await page.route('**/modules/d3-01-least-privilege.arc-module.json', async route => {
    const m = JSON.parse(readFileSync(ROOT + 'modules/d3-01-least-privilege.arc-module.json', 'utf8'));
    m.prerequisites = ['isc2.cc.d3.subjects-objects'];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) });
  });
  await page.goto(BASE + 'index.html');
  await page.evaluate(() => { state.lastSeenVersion = APP_VERSION; closeWhatsNew(); });
  await arcOn(page);
  const r = await page.evaluate(id => ({ loaded: !!arcModule(id), dropped: ARC.dropped.map(d => d.id + ': ' + d.why), status: ARC.status,
    corpus: ARC.engine.validateCorpus(ARC.modules), btn: document.querySelector(`#domPanels [data-arc="${id}"]`)?.textContent }), P2.lp);
  ok('P0b: a module with an unresolvable prerequisite is not loaded', r.loaded === false, JSON.stringify(r));
  ok('P0b: … it is reported as dropped, naming the prerequisite', r.dropped.some(d => /least-privilege.*subjects-objects/.test(d)), JSON.stringify(r.dropped));
  ok('P0b: … the corpus that did load still validates (V11)', r.corpus.length === 0, JSON.stringify(r.corpus));
  ok('P0b: … its ARC button says unavailable instead of opening a dead end', r.btn === 'unavailable', String(r.btn));
  ok('P0b: … and the other ten still load (degraded, not unavailable)', r.status === 'degraded');
  await ctx.close();
}

/* ══ P1. Each module, full loop through the real DOM, wrong then right ══════ */
for (const [key, id] of Object.entries(KEYS)) {
  const { ctx, page } = await open();
  await arcOn(page);
  await setup(page);
  const short = id.split('.').pop();
  // enter through the module's own ARC button on the Domains tab
  await page.evaluate(k => { switchView('domains'); selectDomain(+k[1] - 1); }, key);
  await tap(page, `#domPanels [data-arc="${id}"]`, `${short}: ARC button`);
  ok(`${short}: LOCKED with prerequisite met → Begin`, await st(page, id) === undefined || await st(page, id) === 'LOCKED');
  await tap(page, '#arcGo', `${short}: Begin`);
  ok(`${short}: Phase 0 prequestion shown`, /phase 0/i.test(await page.locator('#arcContent').innerText()), await st(page, id));
  await tap(page, '#arcPQ .choice', `${short}: answer prequestion`);
  ok(`${short}: Phase 1 reading`, await st(page, id) === 'PHASE_1_CHUNK');
  await tap(page, '#arcRead', `${short}: I've read it`);
  ok(`${short}: at the gate`, await st(page, id) === 'PHASE_2_GATE');
  const gate = await spec(page, id);
  // WRONG
  const w = await submitGate(page, wrong(gate));
  ok(`${short}: wrong submission is accepted for scoring`, w.enabled, w.text);
  ok(`${short}: wrong submission → "Not yet"`, /not yet/i.test(w.text), w.text);
  ok(`${short}: wrong submission leaves the module at the gate`, await st(page, id) === 'PHASE_2_GATE', await st(page, id));
  const wl = await page.evaluate(id => arcCfg().log.filter(e => e.module_id === id && e.site === 'gate').at(-1), id);
  ok(`${short}: wrong submission scored from the screen as failing`, wl && wl.passed === false, JSON.stringify(wl));
  await cont(page);
  // RIGHT
  const r = await submitGate(page, perfect(gate));
  // a cleared gate goes straight on to Phase 3 (no result screen in between)
  ok(`${short}: right submission → the Phase 3 screen`, /phase 3/i.test(r.screen) && !/not yet/i.test(r.screen), r.screen.slice(0, 200));
  ok(`${short}: right submission advances to synthesis`, await st(page, id) === 'PHASE_3_SYNTHESIS', await st(page, id));
  await tap(page, '#arcRefl', `${short}: reflection done`);
  ok(`${short}: consolidation pending`, await st(page, id) === 'CONSOLIDATION_PENDING');
  // the next day
  await page.evaluate(id => { closeArc(); arcCfg().fsm[id].consolidation_until = Date.now() - 1; save(); openArcModule(id); }, id);
  ok(`${short}: consolidation resolved by the clock into Phase 4`, await st(page, id) === 'PHASE_4_SPACED_QUEUE', await st(page, id));
  const drill = await page.evaluate(id => arcDrillFor(id), id);
  await fill(page, drill, perfect(drill));
  await tap(page, '#arcDrill', `${short}: submit drill`);
  ok(`${short}: drill recalled through the DOM`, /recalled/i.test(await resultText(page)), await resultText(page));
  ok(`${short}: drill scheduled a card`, await page.evaluate(id => !!arcCfg().cards[id], id));
  await ctx.close();
}

/* ══ P2. IR gate: click-sort right passes, reversed scores 0 ════════════════ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  await setup(page, { fsm: { [P2.ir]: 'PHASE_2_GATE' } });
  await page.evaluate(id => openArcModule(id), P2.ir);
  const g = await spec(page, P2.ir);
  ok('P2: IR gate is kendall_tau with five steps', g.validation_payload.accuracy_metric === 'kendall_tau' && g.validation_payload.correct.length === 5);
  const initial = await page.$$eval('#arcWidget .arc-order li > span:first-child', xs => xs.map(x => x.textContent));
  ok('P2: the widget does not start in the answer order (precondition)', initial.join('|') !== g.validation_payload.correct.join('|'));
  await submitGate(page, g.validation_payload.correct.slice().reverse());
  const rev = await page.evaluate(id => arcCfg().log.filter(e => e.module_id === id && e.site === 'gate').at(-1), P2.ir);
  ok('P2: reversed order scores 0', rev && rev.raw_accuracy === 0 && rev.correct_count === 0, JSON.stringify(rev));
  ok('P2: reversed order fails', rev && rev.passed === false && await st(page, P2.ir) === 'PHASE_2_GATE');
  await cont(page);
  await submitGate(page, g.validation_payload.correct);
  const right = await page.evaluate(id => arcCfg().log.filter(e => e.module_id === id && e.site === 'gate').at(-1), P2.ir);
  ok('P2: click-sorted into the right order scores 1.0 and passes', right && right.raw_accuracy === 1 && right.passed === true, JSON.stringify(right));
  ok('P2: … and advances', await st(page, P2.ir) === 'PHASE_3_SYNTHESIS');
  // one adjacent swap is still a miss on a perfect-order gate
  await setup(page, { fsm: { [P2.ir]: 'PHASE_2_GATE' } });
  await page.evaluate(id => openArcModule(id), P2.ir);
  const sw = g.validation_payload.correct.slice(); [sw[2], sw[3]] = [sw[3], sw[2]];
  const t = await submitGate(page, sw);
  ok('P2: eradicate/restore swapped fails (perfect order required)', /not yet/i.test(t.text) && /9 of 10/.test(t.text), t.text);
  await ctx.close();
}

/* ══ P3. Subnet (SKILL): fluency guard — perfect passes; over-time, hinted, one wrong slot fail ═ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  const g = await (async () => { await setup(page); return spec(page, P2.sub); })();
  ok('P3: subnet module is SKILL with a perfect-set gate (V13)', await page.evaluate(id => arcModule(id).profile, P2.sub) === 'SKILL'
    && g.pass_threshold.min_correct === g.pass_threshold.item_count && g.pass_threshold.item_count >= 4, JSON.stringify(g.pass_threshold));
  ok('P3: expected_duration_s is phone-realistic (>= 180 s)', g.expected_duration_s >= 180, String(g.expected_duration_s));
  const ans = perfect(g);
  const fresh = async () => { await setup(page, { fsm: { [P2.sub]: 'PHASE_2_GATE' } }); await page.evaluate(id => { closeArc(); openArcModule(id); }, P2.sub); };
  // the rule is stated on screen before the attempt
  await fresh();
  ok('P3: the skill-gate rule is shown on the gate', await page.locator('#arcSkillRule').isVisible() &&
    /no hint/.test(await page.locator('#arcSkillRule').innerText()), await page.locator('#arcContent').innerText());
  ok('P3: slots carry their labels', (await page.$$eval('#arcWidget .arc-slot span', xs => xs.map(x => x.textContent))).join('|') === g.validation_payload.slot_labels.join('|'));
  // 1. perfect, unhinted, in time → passes
  const p = await submitGate(page, ans, { conf: 4 });
  ok('P3: perfect, unhinted, in-time answer clears', /phase 3/i.test(p.screen) && await st(page, P2.sub) === 'PHASE_3_SYNTHESIS', p.text);
  // 2. same answers, over time → fails
  await fresh();
  await page.evaluate(E => { ARC_UI.startedAt = Date.now() - (E + 5) * 1000; }, g.expected_duration_s);
  const o = await submitGate(page, ans, { conf: 4 });
  ok('P3: the same answers over time fail', /not yet/i.test(o.text) && await st(page, P2.sub) === 'PHASE_2_GATE', o.text);
  ok('P3: … and the screen says why (fluency, time)', await page.locator('#arcNotFluent').count() === 1 && /minutes/.test(await page.locator('#arcNotFluent').innerText()));
  // 3. same answers, with a hint → fails
  await fresh();
  const h = await submitGate(page, ans, { conf: 4, hint: true });
  ok('P3: the same answers with a hint fail', /not yet/i.test(h.text) && await st(page, P2.sub) === 'PHASE_2_GATE', h.text);
  ok('P3: … and the screen says a hint was used', /used a hint/.test(await page.locator('#arcNotFluent').innerText().catch(() => '')));
  // 4. one wrong slot → fails (and it is NOT a fluency message)
  await fresh();
  const one = ans.slice(); one[1] = '172.16.45.192';
  const x = await submitGate(page, one, { conf: 4 });
  ok('P3: one wrong slot fails', /not yet/i.test(x.text) && /3 of 4/.test(x.text) && await st(page, P2.sub) === 'PHASE_2_GATE', x.text);
  ok('P3: … with no fluency note (it was not right)', await page.locator('#arcNotFluent').count() === 0);
  // 5. the SKILL module still has its prequestion (has_prequestion passed to the engine)
  await setup(page, { fsm: { [P2.sub]: 'LOCKED' } });
  await page.evaluate(id => { closeArc(); openArcModule(id); }, P2.sub);
  await tap(page, '#arcGo', 'subnet Begin');
  ok('P3: SKILL module enters Phase 0 prequestion', await st(page, P2.sub) === 'PHASE_0_PREQUESTION', await st(page, P2.sub));
  await ctx.close();
}

/* ══ P4. SOC gate: findings scored, commands never; free-play terminal intact ═ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  await setup(page, { fsm: { [P2.log]: 'PHASE_2_GATE' }, drills: {} });
  await page.evaluate(id => openArcModule(id), P2.log);
  const g = await spec(page, P2.log);
  ok('P4: the gate hosts an embedded terminal', await page.locator('#arcTerm #arcTermBody .term-input').count() === 1);
  ok('P4: the gate terminal has no mission checklist', await page.locator('#arcTerm .mtask, #arcContent .mtask').count() === 0);
  ok('P4: the slots sit below the terminal', await page.evaluate(() => {
    const t = document.getElementById('arcTerm').getBoundingClientRect(), s = document.querySelector('#arcWidget .arc-slot').getBoundingClientRect();
    return s.top >= t.bottom - 0.5; }));
  // type real commands in the gate terminal
  const term = page.locator('#arcTermBody .term-input:not([disabled])');
  await term.click();
  for (const cmd of ['cat /var/log/auth.log', 'grep "Failed password" /var/log/auth.log', 'sha256sum notes.txt']) {
    await page.locator('#arcTermBody .term-input:not([disabled])').fill(cmd);
    await page.locator('#arcTermBody .term-input:not([disabled])').press('Enter');
  }
  const out = await page.locator('#arcTermBody').innerText();
  ok('P4: the gate terminal runs commands (cat shows the log)', /Failed password for root from 203\.0\.113\.66/.test(out));
  ok('P4: the gate terminal does NOT print the free-play commentary that gives the findings', !/indicator of compromise|Five failed logins|MISSION COMPLETE/.test(out), out.slice(-300));
  ok('P4: commands in the gate terminal record no drills.terminal', await page.evaluate(() => !state.drills.terminal));
  // commands typed + wrong IP → fails
  const bad = perfect(g); bad[0] = '10.0.0.5';
  const w = await submitGate(page, bad);
  ok('P4: wrong IP fails, even after investigating in the terminal', /not yet/i.test(w.text) && await st(page, P2.log) === 'PHASE_2_GATE', w.text);
  await cont(page);
  // type NOTHING, answer correctly → passes (commands are not scored)
  ok('P4: after Continue the workspace is fresh (no commands carried over)', !/Failed password/.test(await page.locator('#arcTermBody').innerText()));
  const r = await submitGate(page, perfect(g));
  ok('P4: no commands typed + right findings → passes', /phase 3/i.test(r.screen) && await st(page, P2.log) === 'PHASE_3_SYNTHESIS', r.text);
  ok('P4: the gate recorded no drills.terminal at any point', await page.evaluate(() => !state.drills.terminal));
  await page.evaluate(() => closeArc());

  // free-play SOC Terminal, unchanged: mission completes and records cleared
  const week0 = await page.evaluate(() => state.weekCount);
  await page.evaluate(() => openTrainer('terminal'));
  const fp = cmd => page.locator('#termBody .term-input:not([disabled])').fill(cmd).then(() => page.locator('#termBody .term-input:not([disabled])').press('Enter'));
  ok('P4: free-play mission checklist present with 3 tasks', await page.locator('#termTasks .mtask').count() === 3);
  await fp('ls');
  await fp('grep "Failed password" /var/log/auth.log');
  ok('P4: free-play still teaches the finding after grep', /indicator of compromise/.test(await page.locator('#termBody').innerText()));
  await fp('sha256sum notes.txt');
  const fpOut = await page.locator('#termBody').innerText();
  ok('P4: free-play mission completes', /MISSION COMPLETE/.test(fpOut), fpOut.slice(-200));
  ok('P4: free-play mission records drills.terminal (cleared ✓)', await page.evaluate(() => state.drills.terminal === true));
  ok('P4: free-play checklist all ticked', await page.locator('#termTasks .mtask.done').count() === 3);
  ok('P4: free-play counted once in the week', await page.evaluate(() => state.weekCount) === week0 + 1);
  ok('P4: free-play keeps focus on the new prompt line', await page.evaluate(() => document.activeElement?.matches('#termBody .term-input:not([disabled])')));
  await ctx.close();
}

/* ══ P5. Least privilege: a dangerous grant fails, the exact set passes ══════ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  await setup(page, { fsm: { [P2.lp]: 'PHASE_2_GATE' } });
  await page.evaluate(id => openArcModule(id), P2.lp);
  const g = await spec(page, P2.lp);
  const one = [...g.validation_payload.correct_set, 'Delete audit logs'];
  const a = await submitGate(page, one);
  const la = await page.evaluate(id => arcCfg().log.filter(e => e.module_id === id && e.site === 'gate').at(-1), P2.lp);
  ok('P5: all needed + one dangerous permission → F1 below threshold', la && la.raw_accuracy < 1 && la.passed === false, JSON.stringify(la));
  ok('P5: … fails, and the screen names the extra grant', /not yet/i.test(a.text) && /plus 1 that should not be there/.test(a.text), a.text);
  await cont(page);
  const all = [...g.validation_payload.correct_set, ...g.validation_payload.distractors];
  const b = await submitGate(page, all);
  ok('P5: granting everything fails', /not yet/i.test(b.text), b.text);
  await cont(page);
  const c = await submitGate(page, g.validation_payload.correct_set);
  ok('P5: the exact needed set passes', /phase 3/i.test(c.screen) && await st(page, P2.lp) === 'PHASE_3_SYNTHESIS', c.text);
  await ctx.close();
}

/* ══ P6. Phishing: every message must be classified; half is refused, not scored ═ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  await setup(page, { fsm: { [P2.sa]: 'PHASE_2_GATE' } });
  await page.evaluate(id => openArcModule(id), P2.sa);
  const g = await spec(page, P2.sa);
  const items = Object.values(g.validation_payload.buckets).flat();
  ok('P6: at least 8 messages, two buckets', items.length >= 8 && Object.keys(g.validation_payload.buckets).length === 2, String(items.length));
  const full = perfect(g);
  const half = Object.fromEntries(Object.entries(full).slice(0, Math.floor(items.length / 2)));
  await fill(page, g, half);
  await page.click('#arcConf [data-conf="3"]');
  ok('P6: half-classified → Submit stays disabled', !(await page.locator('#arcSubmit').isEnabled()));
  ok('P6: … and the screen says every part needs an answer', /Answer every part/.test(await page.locator('#arcReady').innerText()));
  // defence in depth: even if the button were forced, the submission is refused, not scored
  const forced = await page.evaluate(id => { const before = arcCfg().log.length, att = arcFsm(id).gate_attempts; const r = arcSubmitGate();
    return { r, logged: arcCfg().log.length - before, att: arcFsm(id).gate_attempts - att }; }, P2.sa);
  ok('P6: a forced half-classified submission is refused', !!forced.r.error && !forced.r.scored, JSON.stringify(forced.r));
  ok('P6: … nothing logged and no attempt burned', forced.logged === 0 && forced.att === 0, JSON.stringify(forced));
  await fill(page, g, full);
  ok('P6: fully classified → Submit enabled', await page.locator('#arcSubmit').isEnabled());
  await page.click('#arcSubmit');
  ok('P6: fully and correctly classified passes', await st(page, P2.sa) === 'PHASE_3_SYNTHESIS' && /phase 3/i.test(await page.locator('#arcContent').innerText()));
  await ctx.close();
}

/* ══ P7. Meters isolation: Domain 2-5 never move a Domain 1 percentage ═══════ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  const allNew = Object.fromEntries(Object.values(P2).map(id => [id, 'MASTERED']));
  await setup(page, { fsm: { 'isc2.cc.d1.cia-triad': null, ...allNew },
    objectives: { d2_3: true, d3_1: true, d4_1: true, d5_1: true, d5_2: true } });
  await page.evaluate(() => switchView('dash'));
  const m = await page.evaluate(() => { const c = document.getElementById('arcMeters'); return c ? { ...c.dataset, split: c.querySelector('#arcmDetail').textContent } : null; });
  ok('P7: precondition — all five new modules MASTERED, every D1 module LOCKED', await page.evaluate(([p2, d1]) =>
    p2.every(id => arcCfg().fsm[id]?.state === 'MASTERED') && d1.every(id => (arcCfg().fsm[id]?.state || 'LOCKED') === 'LOCKED'), [Object.values(P2), D1]));
  ok('P7: meters card is drawn', !!m);
  ok('P7: Reading stays 0', m && m.reading === '0', JSON.stringify(m));
  ok('P7: ARC stays 0', m && m.arc === '0', JSON.stringify(m));
  ok('P7: Overall stays 0', m && m.overall === '0', JSON.stringify(m));
  ok('P7: denominators stay 6', m && /0\/6 mastered, 0\/6 gate-cleared/.test(m.split), m && m.split);
  ok('P7: the functions agree', await page.evaluate(() => arcDomain1ModuleIds().length === 6 && arcReadingPct() === 0 && arcOverallPct() === 0 && arcGateClearedCount() === 0));
  // and the positive control: one D1 module mastered moves it to 17%
  await setup(page, { fsm: { ...allNew } });
  await page.evaluate(() => switchView('dash'));
  ok('P7: positive control — CIA mastered alone reads 17% overall', await page.evaluate(() => document.getElementById('arcMeters').dataset.overall) === '17');
  await ctx.close();
}

/* ══ P8. Today card, consolidation exits, overdue gate see Domain 2-5 ═════════ */
{
  const { ctx, page } = await open();
  await arcOn(page);
  const d1Done = Object.fromEntries(D1.map(id => [id, 'MASTERED']));
  const pick = () => page.evaluate(() => { const p = arcWelcomePick(); return { kind: p.kind, id: p.id, title: p.title }; });
  // mid-loop on a D5 module
  await setup(page, { fsm: { ...d1Done, [P2.log]: 'PHASE_2_GATE' } });
  const p1 = await pick();
  ok('P8: Today card resumes a Domain 5 module mid-loop', p1.kind === 'resume' && p1.id === P2.log, JSON.stringify(p1));
  // nothing in flight, D1 all mastered → next unstarted is a Domain 2-5 module
  await setup(page, { fsm: { ...d1Done } });
  const p2 = await pick();
  ok('P8: Today card offers a Domain 2-5 module as next', p2.kind === 'next' && Object.values(P2).includes(p2.id), JSON.stringify(p2));
  // through the real DOM: the card shows on entering Command and opens it
  await setup(page, { fsm: { ...d1Done, [P2.sa]: 'PHASE_1_CHUNK' }, lastWelcomeSeen: null });
  await page.evaluate(() => switchView('progress'));
  await page.click('.tab[data-view="dash"]');
  ok('P8: the Today card names the Domain 5 module', /Security Awareness/.test(await page.locator('#welcomeCard').innerText().catch(() => '')));
  await tap(page, '#wcGo', 'Today card go');
  ok('P8: … and opens it', await page.evaluate(() => ARC_UI.moduleId) === P2.sa);
  await page.evaluate(() => closeArc());
  // consolidation exit points at a Domain 2-5 module
  await setup(page, { fsm: { ...d1Done, [P2.ir]: 'CONSOLIDATION_PENDING' }, extra: { [P2.ir]: { consolidation_until: Date.now() + 3600e3 } } });
  await page.evaluate(id => openArcModule(id), P2.ir);
  const exitMid = await page.getAttribute('#arcExits [data-exit="module"]', 'data-mid').catch(() => null);
  ok('P8: consolidation exit offers another Domain 2-5 module', exitMid && Object.values(P2).includes(exitMid) && exitMid !== P2.ir, String(exitMid));
  await page.evaluate(() => closeArc());
  // overdue gate counts Domain 2-5 cards
  await setup(page, { fsm: { [P2.lp]: 'PHASE_4_SPACED_QUEUE', [P2.sa]: 'PHASE_4_SPACED_QUEUE', [P2.sub]: 'PHASE_4_SPACED_QUEUE', [P2.ir]: 'LOCKED' },
    overdueH: { [P2.lp]: 2, [P2.sa]: 2, [P2.sub]: 2 } });
  const og = await page.evaluate(() => arcOverdueBlocksNewMaterial());
  ok('P8: three overdue Domain 2-5 reviews pause new material', og.blocked === true, JSON.stringify(og));
  await page.evaluate(id => openArcModule(id), P2.ir);
  ok('P8: … the Begin button is disabled with the reason shown', !(await page.locator('#arcGo').isEnabled()) && await page.locator('#arcBlocked').count() === 1);
  await page.evaluate(() => closeArc());
  await ctx.close();
}

/* ══ P9. ARC off: Domains, Range and Command identical to v1.7.1 ═════════════ */
{
  ok('P9: v1.7.1 reference is available from git history (else P9 proves nothing)', !!V171);
  if (V171) {
    const views = async file => {
      const { ctx, page } = await open({ file });
      const v = await page.evaluate(() => { switchView('dash'); render(); switchView('domains'); selectDomain(1);
        return { dom: document.getElementById('view-domains').outerHTML, range: document.getElementById('view-range').outerHTML,
          dash: document.getElementById('view-dash').outerHTML, arcBtns: document.querySelectorAll('.arc-btn').length, fetched: ARC.status }; });
      await ctx.close(); return v;
    };
    const old = await views('v171.html'), neu = await views('index.html');
    ok('P9: ARC off — no ARC buttons', neu.arcBtns === 0);
    ok('P9: ARC off — corpus never fetched', neu.fetched === 'idle', neu.fetched);
    ok('P9: ARC off — Domains markup identical to v1.7.1', old.dom === neu.dom, `${old.dom.length} vs ${neu.dom.length}`);
    ok('P9: ARC off — Range markup identical to v1.7.1', old.range === neu.range, `${old.range.length} vs ${neu.range.length}`);
    ok('P9: ARC off — Command markup identical to v1.7.1', old.dash === neu.dash, `${old.dash.length} vs ${neu.dash.length}`);
  }
}

await browser.close();
server.close();
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log('\nPhase 2 — five pilot modules, trainers as gates');
console.log('─'.repeat(58));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS\n');
