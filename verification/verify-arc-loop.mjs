/**
 * One module end-to-end through all five phases — the checkpoint before the
 * other five get built into the UI.
 *
 * Everything before this round existed to make one property true: passing the
 * Phase 2 gate means the learner knows it. These are the assertions that cash
 * that in, and each is fault-injectable:
 *
 *   A. THE GATE IS THE ASSERTION — isPassed() against the module's real
 *      pass_threshold, and no completion click anywhere. A below-threshold
 *      submission must not reach PHASE_3, and MASTERED must be unreachable.
 *   B. CONSOLIDATION IS ENFORCED — the full loop in one sitting cannot reach
 *      MASTERED, because only the clock opens CONSOLIDATION_PENDING.
 *   C. CONFIDENCE PRECEDES FEEDBACK — recording it after the answer is revealed
 *      is refused, and the log proves the ordering by timestamp.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Repo root: the app is served from the top level, so tests point one dir up.
const ROOT = process.env.APP_ROOT || import.meta.dirname + '/../';
const PORT = Number(process.env.PORT_BASE || 8801);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const n = req.url.split('?')[0].replace(/^\//, '') || 'index.html';
  let b; try { b = readFileSync(ROOT + n); } catch { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[n.slice(n.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(b);
}).listen(PORT);

const URL = `http://127.0.0.1:${PORT}/index.html`;
const MID = 'isc2.cc.d1.cia-triad';
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ` — ${d}` : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(URL);
await page.evaluate(async () => { arcCfg().enabled = true; save(); await loadArcCorpus(); });

/* Helper: drive the engine directly with a chosen gate answer, so the test can
   express "a learner who got 4 of 6 right" without simulating six clicks. */
const runGate = (correctCount, confidence = 3) => page.evaluate(async ([mid, n, conf]) => {
  openArcModule(mid);
  const m = arcModule(mid);
  // walk to the gate
  if (arcFsm(mid).state === 'LOCKED') arcStep(mid, { type: 'PREREQ_RESOLVED' });
  if (arcFsm(mid).state === 'PHASE_0_PREQUESTION') arcStep(mid, { type: 'PREQUESTION_DONE' });
  if (arcFsm(mid).state === 'PHASE_1_CHUNK') arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });
  // build an answer with exactly n items correct
  const buckets = m.gate.validation_payload.buckets, names = Object.keys(buckets);
  const assignment = {}; let placed = 0;
  for (const [b, items] of Object.entries(buckets))
    for (const it of items) { assignment[it] = placed++ < n ? b : names.find(x => x !== b); }
  ARC_UI.moduleId = mid; ARC_UI.module = m; ARC_UI.draft = assignment;
  ARC_UI.feedbackShown = false; ARC_UI.confidence = null; ARC_UI.hintsUsed = 0; ARC_UI.startedAt = Date.now();
  arcSetConfidence(conf);
  const r = arcSubmitGate();
  return { passed: r.passed, correct: r.scored.correct_count, item_count: r.scored.item_count,
           q: r.q, state: arcFsm(mid).state, alert: r.cal.alert, calErr: r.cal.calibration_error };
}, [MID, correctCount, confidence]);

const reset = () => page.evaluate(mid => {
  const a = arcCfg(); delete a.fsm[mid]; delete a.cards[mid]; a.log = []; save();
}, MID);

/* ══ A. The gate is the assertion ══════════════════════════════════════════ */
await reset();
{
  const thr = await page.evaluate(mid => arcModule(mid).gate.pass_threshold, MID);
  ok('gate threshold is the module\'s own', thr.min_correct === 5 && thr.item_count === 6, JSON.stringify(thr));

  const r4 = await runGate(4);
  ok('4 of 6 does NOT pass', r4.passed === false, JSON.stringify(r4));
  ok('4 of 6 does NOT advance past the gate', r4.state === 'PHASE_2_GATE', r4.state);

  const r5 = await runGate(5);
  ok('5 of 6 passes (threshold is min_correct, not perfection)', r5.passed === true, JSON.stringify(r5));
  ok('passing advances to synthesis', r5.state === 'PHASE_3_SYNTHESIS', r5.state);
}

// No completion click anywhere: the classic "mark complete" must not touch ARC state.
{
  const leak = await page.evaluate(mid => {
    const before = JSON.stringify(arcCfg().fsm[mid]);
    state.objectives['d1_0'] = true; save();          // the classic tick
    return { same: JSON.stringify(arcCfg().fsm[mid]) === before, state: arcCfg().fsm[mid].state };
  }, MID);
  ok('classic "mark complete" cannot move ARC state', leak.same === true, leak.state);
}

// Failing three times in a row routes back to the reading — remediation, not a wall.
await reset();
{
  await runGate(0); await runGate(0);
  const third = await runGate(0);
  ok('three consecutive failures send you back to re-read', third.state === 'PHASE_1_CHUNK', third.state);
}

/* ══ B. Consolidation is enforced ══════════════════════════════════════════ */
await reset();
{
  const sitting = await page.evaluate(async mid => {
    if (arcFsm(mid).state === 'LOCKED') arcStep(mid, { type: 'PREREQ_RESOLVED' });
    arcStep(mid, { type: 'PREQUESTION_DONE' });
    arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });
    const m = arcModule(mid), buckets = m.gate.validation_payload.buckets;
    const assignment = {};
    for (const [b, items] of Object.entries(buckets)) for (const it of items) assignment[it] = b;
    ARC_UI.moduleId = mid; ARC_UI.module = m; ARC_UI.draft = assignment;
    ARC_UI.feedbackShown = false; ARC_UI.confidence = null; ARC_UI.startedAt = Date.now(); ARC_UI.hintsUsed = 0;
    arcSetConfidence(5);
    arcSubmitGate();
    arcStep(mid, { type: 'REFLECTION_DONE' });
    const afterReflection = arcFsm(mid).state;
    // Hammer the clock as hard as a learner could in one sitting.
    for (let i = 0; i < 50; i++) arcTick(mid);
    return { afterReflection, now: arcFsm(mid).state, remainingH: arcConsolidationRemainingMs(mid) / 3600000 };
  }, MID);
  ok('reflection enters consolidation', sitting.afterReflection === 'CONSOLIDATION_PENDING', sitting.afterReflection);
  ok('50 clock ticks in one sitting cannot open the door', sitting.now === 'CONSOLIDATION_PENDING', sitting.now);
  ok('MASTERED unreachable in one sitting', sitting.now !== 'MASTERED');
  ok('~24h remain, per the CONCEPT profile', sitting.remainingH > 23 && sitting.remainingH <= 24, String(sitting.remainingH));

  // Only the passage of real time opens it.
  const later = await page.evaluate(mid => {
    arcCfg().fsm[mid].consolidation_until = Date.now() - 1000;   // simulate tomorrow
    return arcTick(mid).state;
  }, MID);
  ok('once the wait has actually elapsed, Phase 4 opens', later === 'PHASE_4_SPACED_QUEUE', later);
}

/* ══ C. Confidence precedes feedback ═══════════════════════════════════════ */
await reset();
{
  const c = await page.evaluate(async mid => {
    const m = arcModule(mid);
    arcStep(mid, { type: 'PREREQ_RESOLVED' }); arcStep(mid, { type: 'PREQUESTION_DONE' });
    arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });
    const buckets = m.gate.validation_payload.buckets, assignment = {};
    for (const [b, items] of Object.entries(buckets)) for (const it of items) assignment[it] = b;
    ARC_UI.moduleId = mid; ARC_UI.module = m; ARC_UI.draft = assignment;
    ARC_UI.feedbackShown = false; ARC_UI.confidence = null; ARC_UI.startedAt = Date.now(); ARC_UI.hintsUsed = 0;

    const refusedBefore = arcSubmitGate();            // no confidence yet
    const acceptedPre = arcSetConfidence(2);
    arcSubmitGate();
    const acceptedPost = arcSetConfidence(5);         // must be refused
    const rec = arcCfg().log.filter(x => x.site === 'gate').pop();
    return { refusedBefore: !!refusedBefore.error, acceptedPre, acceptedPost,
             recorded: rec.predicted_confidence,
             ordered: Date.parse(rec.confidence_recorded_at) <= Date.parse(rec.feedback_at) };
  }, MID);
  ok('submission without confidence is refused', c.refusedBefore === true);
  ok('confidence accepted before feedback', c.acceptedPre === true);
  ok('confidence REFUSED after feedback', c.acceptedPost === false);
  ok('the recorded value is the pre-feedback one', c.recorded === 2, String(c.recorded));
  ok('log proves the ordering by timestamp', c.ordered === true);
}

// And the calibration signal itself: confident + wrong = the overconfidence alert.
await reset();
{
  const over = await runGate(1, 5);
  ok('confident + wrong raises OVERCONFIDENCE', over.alert === 'OVERCONFIDENCE', JSON.stringify(over));
  await reset();
  const under = await runGate(6, 1);
  ok('unsure + right raises UNDERCONFIDENCE', under.alert === 'UNDERCONFIDENCE', JSON.stringify(under));
}

/* ══ Phase 4 drills reach the FSRS queue ═══════════════════════════════════ */
await reset();
{
  const d = await page.evaluate(mid => {
    const m = arcModule(mid);
    arcStep(mid, { type: 'PREREQ_RESOLVED' }); arcStep(mid, { type: 'PREQUESTION_DONE' });
    arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });
    arcStep(mid, { type: 'GATE_SUBMIT', passed: true });
    arcStep(mid, { type: 'REFLECTION_DONE' });
    arcCfg().fsm[mid].consolidation_until = Date.now() - 1; arcTick(mid);
    const drill = arcDrillFor(mid);
    const good = {}; drill.validation_payload.accept.forEach((a, i) => good[i] = a[0]);
    const r = arcSubmitDrill(mid, drill, drill.validation_payload.accept.map(a => a[0]));
    return { tier: drill.interval_tier, q: r.q, interval: r.interval, state: r.state,
             card: !!arcCfg().cards[mid], stability: arcCfg().cards[mid]?.stability };
  }, MID);
  ok('Phase 4 serves the RECOGNITION drill first', d.tier === 'RECOGNITION', d.tier);
  ok('a correct drill scores q >= 3', d.q >= 3, String(d.q));
  ok('the drill creates a real FSRS card', d.card === true && d.stability > 0, JSON.stringify(d));
  ok('the interval comes from FSRS, not a ladder', d.interval >= 1, String(d.interval));
}

/* ══ Toggle off restores the classic app exactly ═══════════════════════════ */
{
  const off = await page.evaluate(() => {
    arcCfg().enabled = false; save(); syncArcButtons();
    return { buttons: document.querySelectorAll('#domPanels .arc-btn').length };
  });
  ok('toggle off removes every ARC entry point from the DOM', off.buttons === 0, String(off.buttons));
  const on = await page.evaluate(() => { arcCfg().enabled = true; save(); syncArcButtons();
    return document.querySelectorAll('#domPanels .arc-btn').length; });
  ok('toggle on restores them', on === 6, String(on));
}

/* ══ D. The widget → engine boundary, exercised on kendall_tau ═════════════
   The CIA template never used ORDER_SEQUENCE, so this input surface is the one
   the single-module checkpoint did not touch. scoreAccuracy() THROWS on a
   non-permutation, so every malformed ordering must be refused BEFORE it gets
   there — and refused closed: no score, no attempt burned, no stack trace. */
{
  const ORD = 'isc2.cc.d1.risk-lifecycle';
  const cases = await page.evaluate(mid => {
    const m = arcModule(mid), gate = m.gate, correct = gate.validation_payload.correct;
    const attempt = resp => {
      const sub = arcBuildSubmission(gate, resp);
      const g = arcScoreGuarded(gate, sub);
      return g.error ? { refused: true, why: g.error } : { refused: false, acc: g.scored.raw_accuracy, cc: g.scored.correct_count };
    };
    return {
      perfect:    attempt(correct.slice()),
      reversed:   attempt(correct.slice().reverse()),
      duplicate:  attempt([correct[0], correct[0], correct[2], correct[3], correct[4]]),
      missing:    attempt(correct.slice(0, 4)),
      extra:      attempt([...correct, 'a step that does not exist']),
      unknown:    attempt([correct[0], correct[1], correct[2], correct[3], 'bogus']),
      empty:      attempt([]),
      notArray:   attempt('first, second, third'),
      threshold:  gate.pass_threshold,
    };
  }, ORD);

  ok('ordering: a correct permutation scores 1.0', cases.perfect.refused === false && cases.perfect.acc === 1, JSON.stringify(cases.perfect));
  ok('ordering: a reversed permutation scores, and scores 0', cases.reversed.refused === false && cases.reversed.acc === 0, JSON.stringify(cases.reversed));
  ok('ordering: duplicate step refused', cases.duplicate.refused === true, JSON.stringify(cases.duplicate));
  ok('ordering: incomplete ordering refused', cases.missing.refused === true, JSON.stringify(cases.missing));
  ok('ordering: extra item refused', cases.extra.refused === true, JSON.stringify(cases.extra));
  ok('ordering: unknown item refused', cases.unknown.refused === true, JSON.stringify(cases.unknown));
  ok('ordering: empty refused', cases.empty.refused === true, JSON.stringify(cases.empty));
  ok('ordering: non-array refused', cases.notArray.refused === true, JSON.stringify(cases.notArray));
  ok('ordering: refusals are human-readable', [cases.duplicate, cases.missing, cases.unknown]
      .every(c => typeof c.why === 'string' && c.why.length > 10 && !/undefined|\[object/.test(c.why)),
      JSON.stringify([cases.duplicate.why, cases.missing.why, cases.unknown.why]));

  // Distinguish the two layers. The validator produces a SPECIFIC, actionable
  // message; the try/catch backstop produces a generic one. If a fixable
  // mistake reaches the backstop the learner is told "could not be scored"
  // instead of "order all 5 steps", which is a real regression even though
  // both refuse — so assert the specific message, not merely that it refused.
  ok('ordering: incomplete gets the actionable message, not the backstop',
     /Order all 5 steps/.test(cases.missing.why || ''), cases.missing.why);
  ok('ordering: duplicate gets the actionable message',
     /appears twice/.test(cases.duplicate.why || ''), cases.duplicate.why);
  ok('ordering: no refusal falls through to the generic backstop',
     ![cases.duplicate, cases.missing, cases.extra, cases.unknown, cases.empty]
       .some(c => /could not be scored/.test(c.why || '')),
     JSON.stringify([cases.duplicate.why, cases.extra.why]));

  // The metrics that do NOT throw are where a missing validator fails OPEN.
  // bucket_assignment happily scores a half-finished answer as a real result,
  // so only the validator stands between a partial submission and a recorded
  // attempt the learner never meant to make.
  const partial = await page.evaluate(() => {
    const m = arcModule('isc2.cc.d1.cia-triad'), gate = m.gate, vp = gate.validation_payload;
    const all = Object.entries(vp.buckets);
    const half = {}; let i = 0;
    for (const [b, items] of all) for (const it of items) { if (i++ < 3) half[it] = b; }
    const sub = arcBuildSubmission(gate, half);
    const guarded = arcScoreGuarded(gate, sub);
    // what the raw engine would have said, with no guard at all
    const raw = ARC.engine.scoreAccuracy('bucket_assignment', sub);
    return { refused: !!guarded.error, why: guarded.error,
             engineWouldScore: raw.raw_accuracy, engineThrew: false };
  });
  ok('partial classify is refused (the engine would NOT have thrown)', partial.refused === true, JSON.stringify(partial));
  ok('partial classify refusal is actionable', /Every item needs a category/.test(partial.why || ''), partial.why);
  ok('the engine really would have scored it silently', partial.engineWouldScore > 0 && partial.engineWouldScore < 1,
     String(partial.engineWouldScore));

  // A refused submission must not burn a gate attempt or write to the log.
  const noSideEffects = await page.evaluate(mid => {
    const a = arcCfg(); delete a.fsm[mid]; a.log = []; save();
    arcStep(mid, { type: 'PREREQ_RESOLVED' }); arcStep(mid, { type: 'PREQUESTION_DONE' });
    arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });
    const m = arcModule(mid);
    ARC_UI.moduleId = mid; ARC_UI.module = m; ARC_UI.feedbackShown = false;
    ARC_UI.confidence = null; ARC_UI.startedAt = Date.now(); ARC_UI.hintsUsed = 0;
    arcSetConfidence(3);
    ARC_UI.draft = m.gate.validation_payload.correct.slice(0, 3);   // incomplete
    const r = arcSubmitGate();
    return { refused: !!r.error, attempts: arcFsm(mid).cumulative_attempts,
             logged: arcCfg().log.filter(x => x.site === 'gate').length,
             state: arcFsm(mid).state, feedbackShown: ARC_UI.feedbackShown };
  }, ORD);
  ok('refused submission is refused', noSideEffects.refused === true);
  ok('refused submission burns no attempt', noSideEffects.attempts === 0, String(noSideEffects.attempts));
  ok('refused submission writes no log record', noSideEffects.logged === 0, String(noSideEffects.logged));
  ok('refused submission does not reveal feedback', noSideEffects.feedbackShown === false);
  ok('refused submission leaves you at the gate', noSideEffects.state === 'PHASE_2_GATE', noSideEffects.state);

  // The move-up/move-down widget can only ever produce a permutation.
  const shuffled = await page.evaluate(mid => {
    openArcModule(mid);
    arcStep(mid, { type: 'PREREQ_RESOLVED' }); arcStep(mid, { type: 'PREQUESTION_DONE' });
    arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });
    renderArc();
    const before = ARC_UI.draft.slice();
    document.querySelectorAll('[data-mv]').forEach((b, i) => { if (i % 3 === 0) b.click(); });
    const after = ARC_UI.draft.slice();
    const correct = arcModule(mid).gate.validation_payload.correct;
    return { sameSet: JSON.stringify(after.slice().sort()) === JSON.stringify(correct.slice().sort()),
             len: after.length, moved: JSON.stringify(before) !== JSON.stringify(after) };
  }, ORD);
  ok('ordering widget keeps a valid permutation after reordering', shuffled.sameSet === true && shuffled.len === 5, JSON.stringify(shuffled));
  ok('ordering widget actually reorders', shuffled.moved === true);
}

/* ══ E. All six modules, each driven to MASTERED ═══════════════════════════ */
{
  const all = await page.evaluate(async () => {
    const out = [];
    const a = arcCfg(); a.fsm = {}; a.cards = {}; a.log = []; save();
    for (const m of ARC.modules) {
      const mid = m.id;
      // prerequisites first: put the root into the queue so dependants unlock
      arcStep(mid, { type: 'PREREQ_RESOLVED' });
      if (arcFsm(mid).state === 'PHASE_0_PREQUESTION') arcStep(mid, { type: 'PREQUESTION_DONE' });
      arcStep(mid, { type: 'CHUNK_DONE', reading_ratio: 1 });

      // a perfect gate answer, built from the module's own payload
      const vp = m.gate.validation_payload;
      let draft;
      if (vp.accuracy_metric === 'bucket_assignment') {
        draft = {}; for (const [b, items] of Object.entries(vp.buckets)) for (const it of items) draft[it] = b;
      } else if (vp.accuracy_metric === 'kendall_tau') draft = vp.correct.slice();
      else if (vp.accuracy_metric === 'correct_slot_ratio') draft = vp.accept.map(x => x[0]);
      else if (vp.accuracy_metric === 'set_f1') draft = vp.correct_set.slice();
      else draft = vp.required_keywords.join(' ');

      ARC_UI.moduleId = mid; ARC_UI.module = m; ARC_UI.draft = draft;
      ARC_UI.feedbackShown = false; ARC_UI.confidence = null; ARC_UI.startedAt = Date.now(); ARC_UI.hintsUsed = 0;
      arcSetConfidence(4);
      const g = arcSubmitGate();
      const gateOk = !g.error && g.passed === true;

      arcStep(mid, { type: 'REFLECTION_DONE' });
      const consolidating = arcFsm(mid).state === 'CONSOLIDATION_PENDING';
      arcCfg().fsm[mid].consolidation_until = Date.now() - 1;   // simulate the next day
      arcTick(mid);

      // drill until MASTERED or we give up
      let rounds = 0, drills = [];
      while (arcFsm(mid).state !== 'MASTERED' && rounds++ < 12) {
        const d = arcDrillFor(mid);
        const dvp = d.validation_payload;
        let dd;
        if (dvp.accuracy_metric === 'bucket_assignment') { dd = {}; for (const [b, items] of Object.entries(dvp.buckets)) for (const it of items) dd[it] = b; }
        else if (dvp.accuracy_metric === 'kendall_tau') dd = dvp.correct.slice();
        else if (dvp.accuracy_metric === 'correct_slot_ratio') dd = dvp.accept.map(x => x[0]);
        else if (dvp.accuracy_metric === 'set_f1') dd = dvp.correct_set.slice();
        else dd = dvp.required_keywords.join(' ');
        const r = arcSubmitDrill(mid, d, dd);
        if (r.error) { drills.push('ERR:' + r.error); break; }
        drills.push(`${d.interval_tier}:${r.interval}d`);
        // let the clock reach the next due date
        const card = arcCfg().cards[mid];
        card.last_review = new Date(Date.parse(card.due) - 1000).toISOString();
      }
      out.push({ id: mid, gateOk, consolidating, state: arcFsm(mid).state, rounds, drills,
                 interval: arcFsm(mid).interval_days, metric: vp.accuracy_metric });
    }
    return out;
  });

  ok('all six modules were driven', all.length === 6, String(all.length));
  for (const r of all) {
    const short = r.id.split('.').pop();
    ok(`${short}: gate cleared on a perfect answer`, r.gateOk === true, JSON.stringify(r));
    ok(`${short}: reflection entered consolidation`, r.consolidating === true);
    ok(`${short}: reached MASTERED`, r.state === 'MASTERED', `${r.state} after ${r.rounds} drills: ${r.drills.join(', ')}`);
    ok(`${short}: mastery interval >= 60d`, r.interval >= 60, String(r.interval));
  }
  const metrics = new Set(all.map(r => r.metric));
  ok('gates exercised more than one metric', metrics.size >= 2, [...metrics].join(', '));
  ok('kendall_tau gate exercised end to end', metrics.has('kendall_tau'), [...metrics].join(', '));
}

/* ══ F. The corpus still resolves AS A SET after all the content churn ════ */
{
  const corpus = await page.evaluate(() => {
    const e = ARC.engine, mods = ARC.modules;
    const roots = mods.filter(m => (m.prerequisites || []).length === 0);
    const ids = new Set(mods.map(m => m.id));
    const dangling = mods.flatMap(m => (m.prerequisites || []).filter(p => !ids.has(p)).map(p => `${m.id}->${p}`));
    return { errs: e.validateCorpus(mods), n: mods.length, roots: roots.map(r => r.id), dangling,
             semantic: mods.flatMap(m => e.validateSemantics(m, mods)) };
  });
  ok('corpus: validateCorpus clean across all six', corpus.errs.length === 0, corpus.errs.join('; '));
  ok('corpus: V1-V13 clean across all six', corpus.semantic.length === 0, corpus.semantic.slice(0, 3).join('; '));
  ok('corpus: exactly one root', corpus.roots.length === 1, corpus.roots.join(', '));
  ok('corpus: the root is the CIA triad', corpus.roots[0] === 'isc2.cc.d1.cia-triad', corpus.roots[0]);
  ok('corpus: no dangling prerequisite pointers', corpus.dangling.length === 0, corpus.dangling.join(', '));
  ok('corpus: every objective in the map resolves to a loaded module', await page.evaluate(() =>
    Object.values(ARC_OBJECTIVE_MAP).every(id => !!arcModule(id))));
}

ok('no page errors across the whole loop', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
console.log('\nARC 5-phase loop — one module end to end');
console.log('─'.repeat(58));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS\n');
