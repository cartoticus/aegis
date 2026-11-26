#!/usr/bin/env node
/**
 * phase2-audit — blind item + hint audit tooling for the v1.8.0 modules.
 *
 *   node verification/phase2-audit.mjs task  <out-task.json> <out-key.json> [--only id,id]
 *   node verification/phase2-audit.mjs score <task.json> <key.json> <ans-A.json> <ans-B.json> <ans-C.json> <ans-H.json>
 *
 * `task` strips every answer key out of the five Phase 2 modules: bucket items are
 * listed alphabetically without their bucket, ordering steps are listed alphabetically
 * and lettered, set options are lettered, cloze blanks carry only their labels. The key
 * goes to a separate file the reviewers never see.
 *
 * `score` applies the decision rule mechanically:
 *   ITEM  passes when all four reviewers answer it to the key AND the hostile reviewer
 *         does not rate it HIGH. Cooperative flags are reported for the author to act on.
 *   HINT  passes when A, B and C all say CHANGES_APPROACH AND H does not rate it HIGH.
 * Free-recall prompts are checked differently: each reviewer writes a model answer,
 * and the module's own keyword_density metric must pass it — proof the keyword set is
 * one an expert actually hits, not one only the author's phrasing would.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const FILES = ['d2-03-incident-response', 'd3-01-least-privilege', 'd4-01-subnetting',
  'd5-01-security-awareness', 'd5-02-logging-monitoring'];
const ARC = await import(resolve(ROOT, 'arc-core.mjs'));
const L = i => String.fromCharCode(65 + i);
const alpha = a => a.slice().sort((x, y) => x.localeCompare(y));
const norm = s => ARC.normalise(String(s ?? ''));

/* The SOC gate's workspace is the Range terminal's fixed file system. Its auth.log is
   read out of index.html so the audit sees exactly what the learner sees. */
function authLog() {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const m = html.match(/'\/var\/log\/auth\.log':\{type:'file',content:\s*`([^`]*)`/);
  return m ? m[1] : '(auth.log not found)';
}

function build(only) {
  const task = { instructions: 'see prompt', modules: [] }, key = { items: {}, recall: {} };
  for (const f of FILES) {
    const m = JSON.parse(readFileSync(resolve(ROOT, 'modules', f + '.arc-module.json'), 'utf8'));
    if (only && !only.includes(m.id)) continue;
    const tm = { module: m.id, title: m.content.title, reading: m.content.reading_markdown, items: [], hints: [] };
    const banks = [['gate', m.gate], ...m.drills.map(d => [d.id, d])];
    for (const [bid, spec] of banks) {
      const vp = spec.validation_payload, met = vp.accuracy_metric, id = `${m.id}::${bid}`;
      const base = { id, bank: bid === 'gate' ? 'gate' : spec.interval_tier, prompt: spec.prompt };
      if (bid === 'gate' && m.id.endsWith('logging-monitoring')) base.workspace_file = { path: '/var/log/auth.log', content: authLog() };
      if (met === 'bucket_assignment') {
        const items = alpha(Object.values(vp.buckets).flat());
        tm.items.push({ ...base, kind: 'CLASSIFY', buckets: alpha(Object.keys(vp.buckets)), statements: items.map((t, i) => ({ n: i + 1, text: t })) });
        key.items[id] = { kind: 'CLASSIFY', answer: Object.fromEntries(items.map((t, i) => [i + 1, Object.keys(vp.buckets).find(b => vp.buckets[b].includes(t))])) };
      } else if (met === 'kendall_tau') {
        const steps = alpha(vp.correct);
        tm.items.push({ ...base, kind: 'ORDER', steps: steps.map((t, i) => ({ letter: L(i), text: t })) });
        key.items[id] = { kind: 'ORDER', answer: vp.correct.map(t => L(steps.indexOf(t))) };
      } else if (met === 'set_f1') {
        const opts = alpha([...vp.correct_set, ...(vp.distractors || [])]);
        tm.items.push({ ...base, kind: 'SELECT', options: opts.map((t, i) => ({ letter: L(i), text: t })) });
        key.items[id] = { kind: 'SELECT', answer: opts.map((t, i) => vp.correct_set.includes(t) ? L(i) : null).filter(Boolean) };
      } else if (met === 'correct_slot_ratio') {
        tm.items.push({ ...base, kind: 'CLOZE', blanks: vp.accept.map((_, i) => (vp.slot_labels || [])[i] || `Blank ${i + 1}`) });
        key.items[id] = { kind: 'CLOZE', accept: vp.accept };
      } else if (met === 'keyword_density') {
        tm.items.push({ ...base, kind: 'RECALL' });
        key.recall[id] = { required_keywords: vp.required_keywords, min_correct: spec.pass_threshold.min_correct };
      }
    }
    (m.gate.hints || []).forEach((h, i) => tm.hints.push({ id: `${m.id}::hint${i}`, for: 'gate', text: h }));
    task.modules.push(tm);
  }
  return { task, key };
}

function score(taskP, keyP, ansPs) {
  const key = JSON.parse(readFileSync(taskP === keyP ? keyP : keyP, 'utf8'));
  const ans = Object.fromEntries(ansPs.map(p => { const a = JSON.parse(readFileSync(p, 'utf8')); return [a.reviewer, a]; }));
  const R = ['A', 'B', 'C', 'H'];
  const out = { items: {}, hints: {}, recall: {}, pass: true };
  const match = (k, a) => {
    if (a == null) return false;
    if (k.kind === 'CLASSIFY') return Object.entries(k.answer).every(([n, b]) => norm(a[n]) === norm(b));
    if (k.kind === 'ORDER') return Array.isArray(a) && a.join('') === k.answer.join('');
    if (k.kind === 'SELECT') return Array.isArray(a) && alpha(a).join('') === alpha(k.answer).join('');
    if (k.kind === 'CLOZE') return Array.isArray(a) && k.accept.every((acc, i) => acc.some(x => norm(x) === norm(a[i])));
    return false;
  };
  const miss = (k, a) => {   // per-statement detail for CLASSIFY, so a split is visible
    if (k.kind !== 'CLASSIFY' || !a) return null;
    return Object.entries(k.answer).filter(([n, b]) => norm(a[n]) !== norm(b)).map(([n]) => `#${n}→${a[n]}`);
  };
  for (const [id, k] of Object.entries(key.items)) {
    const row = {};
    for (const r of R) {
      const a = ans[r]?.items?.[id] || {};
      row[r] = { ok: match(k, a.answer), miss: miss(k, a.answer), flag: a.flag || 'CLEAN', severity: a.severity, conf: a.confidence, note: a.note };
    }
    row.pass = R.every(r => row[r].ok) && row.H.severity !== 'HIGH';
    if (!row.pass) out.pass = false;
    out.items[id] = row;
  }
  for (const [id, k] of Object.entries(key.recall)) {
    const row = {};
    for (const r of R) {
      const text = ans[r]?.items?.[id]?.answer || '';
      const s = ARC.scoreAccuracy('keyword_density', { response: text, required_keywords: k.required_keywords });
      row[r] = { found: s.correct_count, of: s.item_count, ok: s.correct_count >= k.min_correct, flag: ans[r]?.items?.[id]?.flag || 'CLEAN', note: ans[r]?.items?.[id]?.note };
    }
    row.pass = R.every(r => row[r].ok);
    if (!row.pass) out.pass = false;
    out.recall[id] = row;
  }
  const hintIds = new Set(R.flatMap(r => Object.keys(ans[r]?.hints || {})));
  for (const id of hintIds) {
    const row = {};
    for (const r of R) row[r] = ans[r]?.hints?.[id] || {};
    row.pass = ['A', 'B', 'C'].every(r => row[r].verdict === 'CHANGES_APPROACH') && row.H.leak !== 'HIGH';
    if (!row.pass) out.pass = false;
    out.hints[id] = row;
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'task') {
  const oi = rest.indexOf('--only'); const only = oi >= 0 ? rest[oi + 1].split(',') : null;
  const { task, key } = build(only);
  writeFileSync(rest[0], JSON.stringify(task, null, 2)); writeFileSync(rest[1], JSON.stringify(key, null, 2));
  console.log(`task: ${task.modules.length} modules, ${Object.keys(key.items).length} scored banks, ${Object.keys(key.recall).length} recall prompts, ${task.modules.reduce((n, m) => n + m.hints.length, 0)} hints`);
} else if (cmd === 'score') {
  const r = score(rest[0], rest[1], rest.slice(2));
  const short = id => id.replace(/^isc2\.cc\./, '');
  for (const [id, row] of Object.entries(r.items)) {
    const cell = x => (row[x].ok ? '✓' : '✗') + (row[x].flag !== 'CLEAN' ? `(${row[x].flag})` : '') + (row[x].miss?.length ? `[${row[x].miss.join(' ')}]` : '');
    console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${short(id).padEnd(46)} A${cell('A')} B${cell('B')} C${cell('C')} H${cell('H')} sev=${row.H.severity || '-'}`);
  }
  for (const [id, row] of Object.entries(r.recall))
    console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${short(id).padEnd(46)} ` + ['A', 'B', 'C', 'H'].map(x => `${x}${row[x].found}/${row[x].of}`).join(' '));
  for (const [id, row] of Object.entries(r.hints))
    console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${short(id).padEnd(46)} ` + ['A', 'B', 'C'].map(x => (row[x].verdict || '?')[0]).join('') + `/${row.H.leak || '?'}`);
  console.log(r.pass ? '\nUNANIMOUS' : '\nNOT YET');
  process.exitCode = r.pass ? 0 : 1;
} else {
  console.error('usage: phase2-audit.mjs task|score …'); process.exitCode = 2;
}
