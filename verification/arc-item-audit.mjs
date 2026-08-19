#!/usr/bin/env node
/**
 * arc-item-audit — adversarial oracle for ARC item-bank quality.
 *
 *   node arc-item-audit.mjs --key key.json --coop a.json,b.json --hostile f.json[,g.json]
 *
 * `bucket_assignment` fairness cannot be proven from the inside: the author who
 * wrote the answer key is the last person who can tell whether an item has a
 * defensible second home. So it is proven from the outside, by independent
 * classifiers that never see the key. Generate the key-free task file with
 *   node arc-module-probe.mjs modules --blind task.json
 * hand `task.json` to two or more independent classifiers plus at least one
 * hostile reviewer, and feed their answers back here.
 *
 * DECISION RULE — an item is DEFECTIVE if any of:
 *   (1) SPLIT      two independent answerers assigned it to different buckets
 *   (2) CONSENSUS  every answerer agreed with each other and against the key
 *   (3) HOSTILE    a hostile reviewer rated it HIGH
 *   (4) COOP-N     at least `--coop-threshold` cooperative agents flagged it
 *
 * (1) is the strongest and is free: two experts splitting on one item is the
 * cleanest possible evidence that it is a coin flip rather than doctrine.
 * (4) is the weakest — a self-reported flag means "this made me think", which
 * for a mastery gate may be the point. Requiring 2+ independent agents to flag
 * the same item filters the agent-specific noise; single-agent flag volume in
 * practice varies by ~3x between equally competent classifiers.
 *
 * Hostile reviewers MUST also commit to answers. A critic who will not put their
 * name to an answer cannot be checked — and in practice a hostile agent rating
 * an item HIGH while itself answering the key's bucket is self-refuting, which
 * you only ever see if you made it answer.
 *
 * Two traps this tool watches for, because they pull in opposite directions:
 *   - AMBIGUITY findings say "too hard / unfair"; GIVE-AWAY findings say
 *     "too easy / proves nothing". Fixing one can create the other, so any
 *     edited bank must be re-probed rather than assumed fixed.
 *   - Cutting items changes item_count, so every pass_threshold on an edited
 *     bank must be re-derived, not carried over.
 *
 * Zero dependencies. Exits 1 if any item is DEFECTIVE.
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const load = p => JSON.parse(readFileSync(p, 'utf8'));
const list = s => (s ? s.split(',').filter(Boolean) : []);

const key = load(flag('--key'));
const coops = list(flag('--coop')).map(p => ({ name: p.replace(/.*\//, ''), data: load(p) }));
const hostiles = list(flag('--hostile')).map(p => ({ name: p.replace(/.*\//, ''), data: load(p) }));
const COOP_N = Number(flag('--coop-threshold', 2));
const OVR_PATH = flag('--overrides', null);
const MODULE_DIR = flag('--modules', null);

/* An override keeps a DEFECTIVE item only if the module's own reading decides
   the case. The quote is verified against reading_markdown, so the claim is
   auditable rather than an assertion — an override citing a sentence that is
   not in the module is itself a failure. */
const overrides = new Map();
if (OVR_PATH) {
  const { readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const readings = new Map();
  if (MODULE_DIR)
    for (const f of readdirSync(MODULE_DIR).filter(x => x.endsWith('.json'))) {
      const m = load(join(MODULE_DIR, f));
      readings.set(m.id, m.content.reading_markdown);
    }
  for (const o of load(OVR_PATH).overrides || []) {
    const reading = readings.get(o.module);
    const verified = reading === undefined ? null : reading.includes(o.resolving_quote);
    overrides.set(`${o.module}\u0000${o.item}`, { ...o, verified });
  }
}

const asg = (d, m, s) => {
  const arr = Array.isArray(d) ? d : (d.answers || []);
  return (arr.find(x => x.module === m && x.site === s) || {}).assignment || {};
};
const flags = (d, m, s) => {
  const arr = Array.isArray(d) ? d : (d.answers || []);
  const e = arr.find(x => x.module === m && x.site === s) || {};
  return new Set([...(e.ambiguous || []), ...(e.compound || [])].map(f => f.item));
};
const findings = d => (Array.isArray(d) ? [] : (d.findings || []));

const verdicts = [];
for (const bank of key) {
  for (const item of bank.items) {
    const mine = bank.key[item];
    const answers = [...coops, ...hostiles].map(a => ({ who: a.name, ans: asg(a.data, bank.module, bank.site)[item] }));
    const given = answers.filter(a => a.ans !== undefined);
    const distinct = new Set(given.map(a => a.ans));
    const split = distinct.size > 1;
    const consensusAgainst = !split && distinct.size === 1 && !distinct.has(mine);
    const coopFlags = coops.filter(c => flags(c.data, bank.module, bank.site).has(item)).map(c => c.name);
    const hostileHigh = hostiles.flatMap(h => findings(h.data))
      .filter(f => f.item === item && f.severity === 'HIGH').map(f => f.why);
    // A hostile HIGH is self-refuting if that same reviewer answered the key's bucket.
    const hostileHighStanding = hostileHigh.filter((_, i) =>
      hostiles.some(h => asg(h.data, bank.module, bank.site)[item] !== mine));

    const reasons = [];
    if (split) reasons.push(`SPLIT (${given.map(a => `${a.who}=${a.ans}`).join(' | ')})`);
    if (consensusAgainst) reasons.push(`CONSENSUS-AGAINST-KEY (all answered ${[...distinct][0]}, key says ${mine})`);
    if (hostileHighStanding.length) reasons.push('HOSTILE-HIGH');
    if (coopFlags.length >= COOP_N) reasons.push(`COOP-FLAG x${coopFlags.length} (${coopFlags.join(', ')})`);

    const ovr = overrides.get(`${bank.module}\u0000${item}`);
    const overridden = reasons.length > 0 && ovr && ovr.verified === true;
    if (ovr && ovr.verified === false) reasons.push('OVERRIDE-QUOTE-NOT-IN-READING');

    verdicts.push({
      bank: `${bank.module.split('.').pop()}/${bank.site === 'gate' ? 'GATE' : 'drill'}`,
      item, mine, ovr, overridden,
      defective: reasons.length > 0 && !overridden, reasons,
      softFlags: coopFlags.length && coopFlags.length < COOP_N ? coopFlags : null,
      hostileSelfRefuted: hostileHigh.length && !hostileHighStanding.length,
    });
  }
}

const def = verdicts.filter(v => v.defective);
const kept = verdicts.filter(v => v.overridden);
const soft = verdicts.filter(v => !v.defective && (v.softFlags || v.hostileSelfRefuted));
const n = verdicts.length;

console.log(`\narc-item-audit — ${n} items · ${coops.length} cooperative + ${hostiles.length} hostile answerers`);
console.log('='.repeat(74));
console.log(`  unanimous with the key : ${n - def.length - soft.length}`);
console.log(`  advisory (below rule)  : ${soft.length}`);
console.log(`  kept by verified override: ${kept.length}`);
console.log(`  DEFECTIVE              : ${def.length}`);
if (kept.length) {
  console.log('\nKEPT BY OVERRIDE — the reading decides these. They are the dogfood watch-list:');
  for (const v of kept) {
    console.log(`\n  [${v.bank}] ${v.item}`);
    console.log(`    flagged: ${v.reasons.join('; ')}`);
    console.log(`    reading resolves it: "${v.ovr.resolving_quote.slice(0, 96)}${v.ovr.resolving_quote.length > 96 ? '…' : ''}" ✓ verified`);
  }
}
if (def.length) {
  console.log('\nDEFECTIVE — cut or rewrite, then re-probe the bank and re-derive its pass_threshold:');
  for (const v of def) { console.log(`\n  [${v.bank}] ${v.item}\n    key: ${v.mine}`); v.reasons.forEach(r => console.log(`    → ${r}`)); }
}
if (soft.length) {
  console.log('\nADVISORY — did not meet the rule; judgement call, not an automatic cut:');
  for (const v of soft)
    console.log(`  · [${v.bank}] ${v.item.slice(0, 68)}${v.item.length > 68 ? '…' : ''}` +
      (v.softFlags ? `  (flagged by ${v.softFlags.join(', ')} only)` : '') +
      (v.hostileSelfRefuted ? '  (hostile rated HIGH but answered the key itself — self-refuting)' : ''));
}
console.log();
process.exit(def.length ? 1 : 0);
