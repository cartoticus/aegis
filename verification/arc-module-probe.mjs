#!/usr/bin/env node
/**
 * arc-module-probe — the definition of done for an ARC content module.
 *
 *   node arc-module-probe.mjs [moduleDir] [--engine <path>] [--blind <out.json>]
 *
 * Three layers, because each catches a class of defect the others cannot:
 *
 *   1. SCHEMA     — structural. Missing keys, bad enums, wrong types.
 *   2. SEMANTICS  — ARC rules V1-V13 via the real engine's validateSemantics()
 *                   plus validateCorpus() for DAG resolvability and acyclicity.
 *   3. LIVE SCORE — every gate and drill payload is actually executed through
 *                   scoreAccuracy() / isPassed() / computeQ() with a perfect,
 *                   a boundary and a wrong response.
 *
 * Layer 3 is the one that earns its keep. validateSemantics() proves a module is
 * LEGAL — that its metric name is permitted for its scoring class. It never
 * proves the payload is SHAPED correctly for the function that will consume it
 * at runtime. A module can be schema-valid, pass V1-V13, and still throw the
 * first time a learner submits. That is precisely the failure a green suite
 * hides, and it is the same lesson ARC's own changelog keeps relearning.
 *
 * --blind additionally emits an answer-key-free version of every CLASSIFY and
 * CONSTRUCT_SET item bank. Hand it to an independent classifier that has never
 * seen the module. Disagreement with your key is the only objective evidence
 * that an item has a defensible second home; your own confidence is not.
 *
 * Zero dependencies. Exits 0 on pass, 1 on failure.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i === -1 ? dflt : argv[i + 1]; };
const DIR = resolve(argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true)
  || import.meta.dirname + '/../modules/');
const ENGINE = resolve(flag('--engine', import.meta.dirname + '/../arc-core.mjs'));
const SCHEMA = resolve(flag('--schema', import.meta.dirname + '/schema/arc-module.schema.json'));
const BLIND_OUT = flag('--blind', null);
const EXPECT_ROOT = flag('--expect-root', null);   // corpus must have exactly this one root
const EXPECT_POLICY = flag('--policy', null);      // every module must declare this invalidation_policy

const {
  validateSemantics, validateCorpus, scoreAccuracy, isPassed, computeQ, CLASS_OF,
} = await import(ENGINE);
const moduleSchema = JSON.parse(readFileSync(SCHEMA, 'utf8'));

/* ── layer 1: schema ─────────────────────────────────────────────────────── */
function validate(schema, data, path = '$', errs = []) {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : null;
  if (types) {
    const actual = data === null ? 'null' : Array.isArray(data) ? 'array'
      : typeof data === 'number' ? (Number.isInteger(data) ? 'integer' : 'number') : typeof data;
    if (!types.some(t => t === actual || (t === 'number' && actual === 'integer'))) {
      errs.push(`${path}: expected ${types.join('|')}, got ${actual}`); return errs;
    }
  }
  if (schema.enum && !schema.enum.some(v => JSON.stringify(v) === JSON.stringify(data)))
    errs.push(`${path}: ${JSON.stringify(data)} not in enum`);
  if (Array.isArray(data) && schema.items) data.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errs));
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const r of schema.required || []) if (!(r in data)) errs.push(`${path}: missing required '${r}'`);
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in data) validate(sub, data[k], `${path}.${k}`, errs);
  }
  return errs;
}

/* ── layer 3: response builders ──────────────────────────────────────────────
   Whatever these produce IS the client contract. If a payload cannot drive
   them, the UI cannot drive it either — which is the whole point. */
const build = {
  binary: {
    perfect: vp => ({ response: vp.accept, accept: vp.accept, pattern: vp.pattern, normalisation: vp.normalisation }),
    wrong: vp => ({ response: '∅ not the answer', accept: vp.accept, pattern: vp.pattern, normalisation: vp.normalisation }),
  },
  correct_slot_ratio: {
    perfect: vp => ({ response: vp.accept.map(a => a[0]), accept: vp.accept, normalisation: vp.normalisation }),
    wrong: vp => ({ response: vp.accept.map(() => 'nonsense'), accept: vp.accept, normalisation: vp.normalisation }),
  },
  set_f1: {
    perfect: vp => ({ selected: [...vp.correct_set], correct_set: vp.correct_set, normalisation: vp.normalisation }),
    wrong: vp => ({ selected: vp.distractors || ['nothing'], correct_set: vp.correct_set, normalisation: vp.normalisation }),
  },
  kendall_tau: {
    perfect: vp => ({ response: [...vp.correct], correct: vp.correct }),
    wrong: vp => ({ response: [...vp.correct].reverse(), correct: vp.correct }),
  },
  bucket_assignment: {
    perfect: vp => {
      const assignment = {};
      for (const [b, items] of Object.entries(vp.buckets)) for (const it of items) assignment[it] = b;
      return { assignment, buckets: vp.buckets, normalisation: vp.normalisation };
    },
    wrong: vp => {
      const names = Object.keys(vp.buckets), assignment = {};
      for (const [b, items] of Object.entries(vp.buckets))
        for (const it of items) assignment[it] = names.find(n => n !== b) ?? b;
      return { assignment, buckets: vp.buckets, normalisation: vp.normalisation };
    },
  },
  rubric_proportion: {
    perfect: vp => ({ confirmed_items: (vp.rubric_items || []).length, rubric_items: (vp.rubric_items || []).length }),
    wrong: vp => ({ confirmed_items: 0, rubric_items: (vp.rubric_items || []).length }),
  },
  keyword_density: {
    perfect: vp => ({ response: vp.required_keywords.join(' '), required_keywords: vp.required_keywords, normalisation: vp.normalisation }),
    wrong: vp => ({ response: 'i do not remember any of it', required_keywords: vp.required_keywords, normalisation: vp.normalisation }),
  },
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ` — ${d}` : '')); } };

// The deployed modules/ directory also holds the manifest the app fetches, so
// skip anything that is not a module. Detect by shape, not by filename: a
// rename should not silently drop a module from validation.
const isModule = o => o && typeof o === 'object' && o.id && o.gate && Array.isArray(o.drills);
const files = readdirSync(DIR).filter(f => f.endsWith('.json'))
  .filter(f => isModule(JSON.parse(readFileSync(join(DIR, f), 'utf8')))).sort();
const corpus = files.map(f => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
if (!files.length) { console.error(`no ARC modules found in ${DIR}`); process.exit(1); }

for (const [i, m] of corpus.entries()) {
  const L = files[i];
  const se = validate(moduleSchema, m);
  ok(`${L}: schema`, se.length === 0, se.join('; '));
  const sem = validateSemantics(m, corpus);
  ok(`${L}: semantics V1-V13`, sem.length === 0, sem.join('; '));

  for (const { what, o } of [{ what: 'gate', o: m.gate }, ...m.drills.map(d => ({ what: d.id, o: d }))]) {
    const vp = o.validation_payload, b = build[vp.accuracy_metric];
    if (!b) { ok(`${L}: ${what} has a probe builder`, false, `no builder for ${vp.accuracy_metric}`); continue; }
    let good, bad;
    try { good = scoreAccuracy(vp.accuracy_metric, b.perfect(vp)); }
    catch (e) { ok(`${L}: ${what} perfect response scores`, false, e.message); continue; }
    try { bad = scoreAccuracy(vp.accuracy_metric, b.wrong(vp)); }
    catch (e) { ok(`${L}: ${what} wrong response scores`, false, e.message); continue; }

    ok(`${L}: ${what} perfect = 1.0`, Math.abs(good.raw_accuracy - 1) < 1e-9, JSON.stringify(good));
    ok(`${L}: ${what} perfect passes`, isPassed(good, o.pass_threshold) === true);
    ok(`${L}: ${what} wrong fails`, isPassed(bad, o.pass_threshold) === false, JSON.stringify(bad));
    ok(`${L}: ${what} class matches type`, CLASS_OF[o.type] === o.scoring_class);

    if (o.pass_threshold.item_count !== undefined)
      ok(`${L}: ${what} item_count matches payload`, good.item_count === o.pass_threshold.item_count,
         `declared ${o.pass_threshold.item_count}, metric reports ${good.item_count}`);
    if (o.pass_threshold.min_correct !== undefined) {
      ok(`${L}: ${what} threshold reachable`, o.pass_threshold.min_correct <= good.item_count);
      ok(`${L}: ${what} threshold non-trivial`, o.pass_threshold.min_correct > good.item_count / 2,
         `${o.pass_threshold.min_correct} of ${good.item_count} is a coin flip or worse`);
    }
    const q = computeQ({ scoring_class: o.scoring_class, raw_accuracy: good.raw_accuracy, cumulative_attempts: 1,
      hints_used: 0, latency_ms: o.expected_duration_s * 1000, expected_duration_s: o.expected_duration_s });
    ok(`${L}: ${what} perfect on-time q = 5`, Math.abs(q - 5) < 1e-9, `q=${q}`);
  }
}

const ce = validateCorpus(corpus);
ok('corpus: DAG resolvable and acyclic', ce.length === 0, ce.join('; '));
ok('corpus: unique module ids', new Set(corpus.map(m => m.id)).size === corpus.length);
ok('corpus: no EXPLAIN_NOVICE (needs a model; AEGIS is offline)', corpus.every(m =>
  m.gate.type !== 'EXPLAIN_NOVICE' && m.drills.every(d => d.type !== 'EXPLAIN_NOVICE')));
if (EXPECT_ROOT) {
  const roots = corpus.filter(m => (m.prerequisites || []).length === 0);
  ok('corpus: exactly one root', roots.length === 1, roots.map(r => r.id).join(', ') || 'none');
  ok(`corpus: root is ${EXPECT_ROOT}`, roots[0]?.id === EXPECT_ROOT, roots[0]?.id);
  const reach = new Set([EXPECT_ROOT]); let grew = true;
  while (grew) { grew = false; for (const m of corpus)
    if (!reach.has(m.id) && (m.prerequisites || []).every(p => reach.has(p))) { reach.add(m.id); grew = true; } }
  ok('corpus: every module reachable from the root', reach.size === corpus.length,
     corpus.filter(m => !reach.has(m.id)).map(m => m.id).join(', '));
}
if (EXPECT_POLICY)
  ok(`corpus: every module declares invalidation_policy ${EXPECT_POLICY}`,
     corpus.every(m => m.invalidation_policy === EXPECT_POLICY),
     corpus.filter(m => m.invalidation_policy !== EXPECT_POLICY).map(m => m.id).join(', '));

/* ── --blind: emit answer-key-free item banks ────────────────────────────── */
if (BLIND_OUT) {
  const banks = [];
  for (const m of corpus)
    for (const { what, o } of [{ what: 'gate', o: m.gate }, ...m.drills.map(d => ({ what: d.id, o: d }))]) {
      const vp = o.validation_payload;
      if (vp.accuracy_metric === 'bucket_assignment') {
        const items = Object.values(vp.buckets).flat().sort((a, b) => a.length - b.length || a.localeCompare(b));
        // The prompt MUST travel with the bank. Omitting it makes the probe harder than
        // reality — blind answerers classify without the instruction the learner sees, so
        // any disambiguation carried by the prompt is invisible to the audit and the
        // instrument reports ambiguity the learner would never meet.
        banks.push({ module: m.id, site: what, kind: 'CLASSIFY', prompt: o.prompt,
          hints: o.hints || [], buckets: Object.keys(vp.buckets), items });
      } else if (vp.accuracy_metric === 'set_f1') {
        banks.push({ module: m.id, site: what, kind: 'SELECT', prompt: o.prompt,
          items: [...vp.correct_set, ...(vp.distractors || [])].sort() });
      }
    }
  writeFileSync(BLIND_OUT, JSON.stringify(banks, null, 1));
  console.log(`  blind probe written: ${BLIND_OUT} (${banks.length} banks, ${banks.reduce((n, b) => n + b.items.length, 0)} items, no answer key)`);
}

console.log(`\narc-module-probe — ${files.length} modules in ${DIR}`);
console.log('─'.repeat(60));
for (const [i, m] of corpus.entries())
  console.log(`  ${files[i].padEnd(44)} ${String(m.content.reading_markdown.trim().split(/\s+/).length).padStart(4)}w  ${m.gate.type}`);
console.log('─'.repeat(60));
console.log(`  ${pass} checks passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  PASS\n');
