/**
 * ARC v4.3.0 — Reference Engine (ARC-Core)
 *
 * PURE LIBRARY. No side effects on import, no process.exit, no I/O.
 * (v4.0.1 shipped these functions inside the test runner, which executed the
 *  whole suite and exited at import time — the documented differential-testing
 *  path was unusable. Spec §10.)
 *
 * Every exported function cites the section it implements. Spec §12.5 requires
 * that every normatively specified rule have a call site; `SPEC_CALL_SITES`
 * below is asserted by the conformance runner.
 */

export const SPEC_VERSION = "4.3.0";

/* ══════════════════════════ §4.6 — Determinism ═════════════════════════ */

/** D8: trim → collapse whitespace → NFC → lowercase. Punctuation significant. */
export function normalise(s, opts = {}) {
  let out = String(s).trim().replace(/\s+/g, " ").normalize("NFC").toLowerCase();
  if (opts.strip_diacritics) out = out.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
  return out;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** §4.4: half-up. Used ONLY by calibration (§7.1), never on computed_q. */
export const roundHalfUp = (n) => Math.floor(n + 0.5);

/* ══════════════════════ §4.2 — Accuracy metrics ═══════════════════════ */

/** Every metric returns {raw_accuracy, correct_count, item_count}. */
export const ACCURACY_METRICS = {
  /**
   * §4.7 payload shapes are NORMATIVE. 4.0.1 specified the formulas but not the
   * input contract, so two independent readings of §4.2 produced incompatible
   * interfaces for 4 of 6 metrics. These shapes are the reconciled contract.
   */

  /** binary — {response, accept} or {response, pattern} for REGEX. */
  binary({ response, accept, pattern, normalisation = {} }) {
    const r = normalise(response, normalisation);          // D9
    const ok = pattern !== undefined
      ? new RegExp(pattern).test(r)
      : r === normalise(accept, normalisation);
    return { raw_accuracy: ok ? 1.0 : 0.0, correct_count: ok ? 1 : 0, item_count: 1 };
  },

  /** correct_slot_ratio — {response: string[], accept: string[][]} */
  correct_slot_ratio({ response, accept, normalisation = {} }) {
    let c = 0;
    accept.forEach((list, i) => {
      const got = normalise(response?.[i] ?? "", normalisation);
      if (list.some((a) => normalise(a, normalisation) === got)) c++;
    });
    return { raw_accuracy: accept.length ? c / accept.length : 0, correct_count: c, item_count: accept.length };
  },

  /** set_f1 — {selected: string[], correct_set: string[]}. D2 exact form; D3 guard. */
  set_f1({ selected, correct_set, normalisation = {} }) {
    const sel = new Set((selected || []).map((x) => normalise(x, normalisation)));
    const cor = new Set((correct_set || []).map((x) => normalise(x, normalisation)));
    let tp = 0;
    for (const x of sel) if (cor.has(x)) tp++;
    return { raw_accuracy: tp === 0 ? 0.0 : (2 * tp) / (sel.size + cor.size), correct_count: tp, item_count: cor.size };
  },

  /** kendall_tau — {response: T[], correct: T[]}. D4 pairwise counts; D5 rejects n<=1. */
  kendall_tau({ response, correct }) {
    const n = (correct || []).length;
    if (n <= 1) throw new Error("D5: kendall_tau undefined for n <= 1");
    if (!response || new Set(response).size !== response.length || response.length !== n)
      throw new Error("D5: response is not a permutation of `correct`");
    const rank = new Map(correct.map((v, i) => [v, i]));
    let C = 0, D = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = rank.get(response[i]), b = rank.get(response[j]);
        if (a === undefined || b === undefined) throw new Error("D5: unknown item in response");
        a < b ? C++ : D++;
      }
    const pairs = (n * (n - 1)) / 2;
    return { raw_accuracy: ((C - D) / pairs + 1) / 2, correct_count: C, item_count: pairs };
  },

  /**
   * bucket_assignment — {buckets: {name: string[]}}; response {assignment: {item: bucket}}.
   * CLASSIFY is a SORTING task: set_f1 over a flattened set loses the bucket
   * structure and silently makes the task easier. correct_count = items placed
   * in the right bucket; item_count = total items.
   */
  bucket_assignment({ assignment, buckets, normalisation = {} }) {
    const truth = new Map();
    for (const [b, items] of Object.entries(buckets || {}))
      for (const it of items) truth.set(normalise(it, normalisation), b);
    let c = 0;
    for (const [it, b] of Object.entries(assignment || {}))
      if (truth.get(normalise(it, normalisation)) === b) c++;
    const n = truth.size;
    return { raw_accuracy: n ? c / n : 0, correct_count: c, item_count: n };
  },

  /** rubric_proportion — {confirmed_items: number, rubric_items: number}. D6. */
  rubric_proportion({ confirmed_items, rubric_items }) {
    return {
      raw_accuracy: rubric_items ? confirmed_items / rubric_items : 0,
      correct_count: confirmed_items, item_count: rubric_items,
    };
  },

  /** keyword_density — {response, required_keywords: string[]}. D7 word-boundary. */
  keyword_density({ response, required_keywords, normalisation = {} }) {
    const hay = normalise(response, normalisation);
    let found = 0;
    for (const kw of required_keywords || []) {
      const k = normalise(kw, normalisation).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?<![\\p{L}\\p{N}])${k}(?![\\p{L}\\p{N}])`, "u").test(hay)) found++;
    }
    const n = (required_keywords || []).length;
    return { raw_accuracy: n ? found / n : 0, correct_count: found, item_count: n };
  },
};

export const CLASS_METRICS = {
  A: ["binary"],
  B: ["correct_slot_ratio", "set_f1", "kendall_tau", "bucket_assignment"],
  C: ["rubric_proportion", "keyword_density"],
};

export function scoreAccuracy(metric, input) {
  const fn = ACCURACY_METRICS[metric];
  if (!fn) throw new Error(`unknown accuracy_metric: ${metric}`);
  return fn(input);
}

/* ═══════════════════ §4.3 / §4.4 — Latency and quality ═══════════════ */

/** §4.3, D1. */
export function latencyPenalty(latency_ms, expected_duration_s) {
  if (!(expected_duration_s >= 1)) throw new Error("D1: expected_duration_s must be >= 1");
  // Integer arithmetic: x2 removes the 2.5 multiplier's fractional form entirely.
  const ms2 = latency_ms * 2, base2 = expected_duration_s * 2000;
  if (ms2 <= base2) return 0.0;              // t <= 1.0 x E
  if (ms2 <= base2 * 2.5) return 0.5;        // t <= 2.5 x E  (base2*2.5 is exact: base2 is a multiple of 2000)
  return 1.0;
}

/** §4.4. Class A uses cumulative_attempts (§3.4); B and C share a formula. D10, D11. */
export function computeQ(i) {
  const pen = latencyPenalty(i.latency_ms, i.expected_duration_s);
  const hints = (i.hints_used || 0) * 1.0;
  if (i.scoring_class === "A")
    return clamp(5.0 - ((i.cumulative_attempts ?? 1) - 1) * 1.5 - hints - pen, 0, 5);
  if (i.scoring_class === "B" || i.scoring_class === "C")
    return clamp(5.0 * i.raw_accuracy - hints - pen, 0, 5);
  throw new Error(`unknown scoring_class: ${i.scoring_class}`);
}

/* ══════════════════════ §3.3 — Passage predicate ════════════════════ */

/** §3.3. Total function; D12: min_correct takes precedence when both present. */
export function isPassed(submission, pass_threshold) {
  const pt = pass_threshold || {};
  if (pt.min_correct !== undefined) return (submission.correct_count ?? 0) >= pt.min_correct;
  if (pt.ratio !== undefined) return (submission.raw_accuracy ?? 0) >= pt.ratio;
  throw new Error("V4: pass_threshold declares neither ratio nor min_correct");
}

/** §5.2 fluency guard — a NORMATIVE transition guard, consulted by step(). */
export function fluencyCleared(submission, gate) {
  return (
    isPassed(submission, gate.pass_threshold) &&
    (submission.hints_used || 0) === 0 &&
    submission.latency_ms * 2 <= gate.expected_duration_s * 2000
  );
}

/* ═══════════════════════════ §7.1 — Calibration ═════════════════════ */

export function calibration(predicted_confidence, q) {
  const err = predicted_confidence - roundHalfUp(q);
  let alert = null;
  if (predicted_confidence >= 4 && q < 3) alert = "OVERCONFIDENCE";
  else if (predicted_confidence <= 2 && q >= 4) alert = "UNDERCONFIDENCE";
  return { calibration_error: err, alert };
}

/* ═════════════════════════════ §3.5 — FSM ═══════════════════════════ */

export const STATES = [
  "LOCKED", "PHASE_0_PREQUESTION", "PHASE_1_CHUNK", "PHASE_2_GATE",
  "PHASE_3_SYNTHESIS", "CONSOLIDATION_PENDING", "PHASE_4_SPACED_QUEUE",
  "NEEDS_RECALIBRATION", "MASTERED",
];

export const EVENTS = [
  "PREREQ_RESOLVED", "PREQUESTION_DONE", "CHUNK_DONE",
  "GATE_SUBMIT", "REFLECTION_DONE", "CLOCK_TICK", "DRILL",
  "CONTENT_VERSION_CHANGE",   // 3.5 row 18 - was declared but absent from 3.7, EVENTS and step()
];

export const PROFILE_DEFAULTS = {
  CONCEPT: { consolidation_hours: 24, mastery_interval_days: 60, remediation_threshold: 3 },
  SKILL: { consolidation_hours: 24, mastery_interval_days: 30, remediation_threshold: 3 },
};

export function initialState(start = "LOCKED") {
  return {
    state: start,
    gate_attempts: 0,
    cumulative_attempts: 0,
    consecutive_failures: 0,
    pacing_flag: false,
    repetitions: 0,
    lapses: 0,
    has_lapsed: false,
    previously_mastered: false,
    consolidation_until: null,
    interval_days: 0,
  };
}

/**
 * §3.5 + §3.7. One transition. Returns a NEW state object.
 * Unhandled (state, event) pairs are ignored without mutation, per §3.7.
 */
function ARC_initial(prev) {
  const z = initialState("LOCKED");
  z.previously_mastered = prev.previously_mastered;
  z.has_lapsed = prev.has_lapsed;
  return z;
}

export function step(s, event, ctx = {}) {
  const profile = ctx.profile ?? "CONCEPT";
  const p = { ...PROFILE_DEFAULTS[profile], ...(ctx.params || {}) };
  const n = { ...s };
  const e = event.type;

  const gateSubmit = (passedNext) => {
    n.gate_attempts++;
    n.cumulative_attempts++;
    if (passedNext) {
      n.consecutive_failures = 0;
      n.gate_attempts = 0;
      return true;
    }
    n.consecutive_failures++;
    return false;
  };

  switch (`${s.state}|${e}`) {
    case "LOCKED|PREREQ_RESOLVED":                       // rows 1-2
      n.state = (profile === "CONCEPT" || ctx.has_prequestion === true)
        ? "PHASE_0_PREQUESTION" : "PHASE_1_CHUNK";
      return n;

    case "PHASE_0_PREQUESTION|PREQUESTION_DONE":         // row 3
      n.state = "PHASE_1_CHUNK";
      return n;

    case "PHASE_1_CHUNK|CHUNK_DONE":                     // row 4
      n.pacing_flag = (event.reading_ratio ?? 1) < 0.25; // §8.4 advisory only
      n.state = "PHASE_2_GATE";
      return n;

    case "PHASE_2_GATE|GATE_SUBMIT": {                   // rows 5-7
      // §5.2: SKILL gates additionally require the fluency guard. This MUST be a
      // real call to fluencyCleared() — in 4.0.1 the rule existed but nothing
      // invoked it, so a hinted, over-time SKILL submission advanced anyway.
      const passed = event.submission && event.gate
        ? isPassed(event.submission, event.gate.pass_threshold)
        : event.passed;
      const fluent = profile !== "SKILL" ? true
        : event.submission && event.gate
          ? fluencyCleared(event.submission, event.gate)
          : event.fluency_cleared === true;
      const clears = passed && fluent;
      if (gateSubmit(clears)) { n.state = "PHASE_3_SYNTHESIS"; return n; }
      if (n.consecutive_failures >= p.remediation_threshold) { // row 7 remediation
        n.gate_attempts = 0;
        n.consecutive_failures = 0;
        n.state = "PHASE_1_CHUNK";
      }
      return n;
    }

    case "PHASE_3_SYNTHESIS|REFLECTION_DONE":            // row 8
      n.consolidation_until = (ctx.now ?? 0) + p.consolidation_hours * 3600_000;
      n.state = "CONSOLIDATION_PENDING";
      return n;

    case "CONSOLIDATION_PENDING|CLOCK_TICK": {           // row 9
      const now = event.now ?? ctx.now ?? 0;
      if (now >= n.consolidation_until) n.state = "PHASE_4_SPACED_QUEUE";
      return n;
    }

    case "PHASE_4_SPACED_QUEUE|DRILL":                   // rows 10-12
    case "MASTERED|DRILL": {                             // rows 13-14
      const wasMastered = s.state === "MASTERED";
      if (event.q >= 3) {
        n.repetitions++;
        n.interval_days = event.next_interval_days ?? n.interval_days;
        n.state = n.interval_days >= p.mastery_interval_days ? "MASTERED" : (wasMastered ? "MASTERED" : "PHASE_4_SPACED_QUEUE");
        return n;
      }
      n.lapses++;
      n.repetitions = 0;
      n.has_lapsed = true;
      if (wasMastered) n.previously_mastered = true;    // §3.6: ONLY on exit from MASTERED
      n.state = "NEEDS_RECALIBRATION";
      return n;
    }

    case "NEEDS_RECALIBRATION|GATE_SUBMIT": {            // rows 15-17
      const rcPassed = event.submission && event.gate
        ? isPassed(event.submission, event.gate.pass_threshold)
        : event.passed;
      if (gateSubmit(rcPassed)) {
        n.interval_days = 1;
        n.state = "PHASE_4_SPACED_QUEUE";
        return n;
      }
      if (n.consecutive_failures >= p.remediation_threshold) {
        n.gate_attempts = 0;
        n.consecutive_failures = 0;
        n.state = "PHASE_1_CHUNK";
      }
      return n;
    }

    default:
      // §8.2 / §3.5 row 18. Legal from every state; behaviour is policy-driven.
      if (e === "CONTENT_VERSION_CHANGE") {
        const policy = event.invalidation_policy ?? "REVIEW";
        if (policy === "PRESERVE") return s;
        if (policy === "INVALIDATE") {
          const z = ARC_initial(s);
          z.state = "LOCKED";
          return z;
        }
        // REVIEW: back into the queue at Day 1, mastery history retained.
        n.state = "PHASE_4_SPACED_QUEUE";
        n.interval_days = 1;
        n.gate_attempts = 0;
        n.consecutive_failures = 0;
        return n;
      }
      return s; // §3.7: ignored, unchanged, no error, no mutation
  }
}

export function run(profile, start, events, ctx = {}) {
  let s = initialState(start);
  for (const ev of events) s = step(s, ev, { ...ctx, profile });
  return s;
}

/* ═══════════════════ §7.2 — Interleaved assembly ═══════════════════ */

export function assembleQueue(due) {
  const pool = new Map();
  for (const d of due) {
    if (!pool.has(d.module_id)) pool.set(d.module_id, { count: 0, branch: d.dag_branch });
    pool.get(d.module_id).count++;
  }
  const out = [];
  for (let left = due.length; left > 0; left--) {
    const cands = [...pool.entries()].filter(([, v]) => v.count > 0)
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
    const last = out.at(-1), prev = out.at(-2);
    const p1 = ([id]) => !last || id !== last.module_id;
    const p2 = ([, v]) => !(last && prev && last.dag_branch === v.branch && prev.dag_branch === v.branch);
    const pick = cands.find((c) => p1(c) && p2(c)) ?? cands.find(p1) ?? cands[0];
    out.push({ module_id: pick[0], dag_branch: pick[1].branch });
    pick[1].count--;
  }
  let p1ok = true, p2ok = true;
  for (let i = 1; i < out.length; i++) if (out[i].module_id === out[i - 1].module_id) p1ok = false;
  for (let i = 2; i < out.length; i++)
    if (out[i].dag_branch === out[i - 1].dag_branch && out[i].dag_branch === out[i - 2].dag_branch) p2ok = false;
  const mods = new Set(due.map((d) => d.module_id)), brs = new Set(due.map((d) => d.dag_branch));
  return {
    queue: out, p1_satisfied: p1ok, p2_satisfied: p2ok,
    interleave_constraint: mods.size === 1 ? "SINGLE_MODULE" : brs.size === 1 ? "SINGLE_BRANCH" : null,
  };
}

/** §7.3 — tier is a function of the current interval. */
export function tierForInterval(interval_days) {
  if (interval_days < 7) return "RECOGNITION";
  if (interval_days < 30) return "APPLICATION";
  return "GENERATIVE";
}

/* ══════════════════ §11 — Semantic validation V1-V12 ═══════════════ */

const CLASS_OF = {
  EXACT_MATCH: "A", REGEX: "A",
  CLASSIFY: "B", CONSTRUCT_SET: "B", CLOZE: "B", LABEL_DIAGRAM: "B", ORDER_SEQUENCE: "B",
  FREE_RECALL: "C", PRODUCE: "C", EXPLAIN_NOVICE: "C", RUBRIC_SELF_ASSESS: "C",
};
export { CLASS_OF };

function thresholdErrors(where, cls, pt) {
  const e = [];
  const hasR = pt?.ratio !== undefined, hasM = pt?.min_correct !== undefined;
  if (hasR === hasM) e.push(`V4 ${where}: pass_threshold must declare exactly one of ratio / min_correct`);
  if (hasM) {
    if (pt.item_count === undefined) e.push(`V5 ${where}: min_correct requires item_count`);
    if (pt.min_correct < 1) e.push(`V5 ${where}: min_correct must be >= 1`);
  }
  // V5 small-set rule is Class B/C ONLY (§3.3 carve-out; Class A binary is always item_count 1)
  if ((cls === "B" || cls === "C") && pt?.item_count !== undefined && pt.item_count < 10 && !hasM)
    e.push(`V5 ${where}: item_count ${pt.item_count} < 10 requires min_correct`);
  if (cls === "A" && !(hasR && pt.ratio === 1.0)) e.push(`V6 ${where}: Class A must declare ratio = 1.0`);
  return e;
}

/** §11 V1-V12. `corpus` enables V11's cross-module DAG checks. */
export function validateSemantics(m, corpus = null) {
  const e = [];
  const words = (m.content?.reading_markdown || "").trim().split(/\s+/).filter(Boolean).length;
  if (words > 1200) e.push(`V1: reading_markdown is ${words} words, cap 1200`);

  if (CLASS_OF[m.gate?.type] !== m.gate?.scoring_class)
    e.push(`V2: gate ${m.gate?.type} must be class ${CLASS_OF[m.gate?.type]}, declared ${m.gate?.scoring_class}`);
  for (const d of m.drills || [])
    if (CLASS_OF[d.type] !== d.scoring_class)
      e.push(`V3: drill ${d.id}: ${d.type} must be class ${CLASS_OF[d.type]}`);

  e.push(...thresholdErrors("gate", m.gate?.scoring_class, m.gate?.pass_threshold));
  for (const d of m.drills || []) e.push(...thresholdErrors(`drill ${d.id}`, d.scoring_class, d.pass_threshold));

  const metricOk = (where, cls, mt) => {
    if (!mt) return [`V7 ${where}: validation_payload.accuracy_metric is required`];
    if (!(CLASS_METRICS[cls] || []).includes(mt))
      return [`V7 ${where}: accuracy_metric '${mt}' is not legal for class ${cls}`];
    return [];
  };
  e.push(...metricOk("gate", m.gate?.scoring_class, m.gate?.validation_payload?.accuracy_metric));
  for (const d of m.drills || [])
    e.push(...metricOk(`drill ${d.id}`, d.scoring_class, d.validation_payload?.accuracy_metric));

  if (m.profile === "CONCEPT" && !m.content?.prequestion) e.push("V8: CONCEPT requires content.prequestion");

  // V13: SKILL fluency (spec 5.2 rule 1) requires a perfect set at the GATE.
  // fluencyCleared() enforces hints and latency but delegates correctness to
  // pass_threshold, so the perfect-set requirement must be validated here or it
  // is unenforced - the exact "normative rule nothing checks" class of defect.
  if (m.profile === "SKILL") {
    const pt = m.gate?.pass_threshold || {};
    if (pt.min_correct === undefined || pt.min_correct !== pt.item_count)
      e.push(`V13: SKILL gate pass_threshold must be a perfect set (min_correct === item_count), got ${JSON.stringify(pt)}`);
  }

  const tiers = new Set((m.drills || []).map((d) => d.interval_tier));
  const mid = m.mastery_interval_days ?? PROFILE_DEFAULTS[m.profile]?.mastery_interval_days ?? 60;
  const need = m.profile === "CONCEPT" || mid >= 30
    ? ["RECOGNITION", "APPLICATION", "GENERATIVE"] : ["RECOGNITION", "APPLICATION"];
  for (const t of need) if (!tiers.has(t)) e.push(`V9: profile ${m.profile} requires a ${t} drill`);
  const gen = (m.drills || []).filter((d) => d.interval_tier === "GENERATIVE");
  if (gen.length && !gen.some((d) => d.type === "FREE_RECALL"))
    e.push("V9: GENERATIVE tier must be offline-satisfiable via FREE_RECALL");

  const ab = m.provenance?.authored_by;
  if ((ab === "agent" || ab === "hybrid") && !m.provenance?.generator_id)
    e.push(`V10: authored_by '${ab}' requires generator_id`);

  const ids = (m.drills || []).map((d) => d.id);
  if (new Set(ids).size !== ids.length) e.push("V11: drill ids must be unique within a module");
  if (!m.dag_branch) e.push("V12: dag_branch is required");
  if (!m.gate?.accessible_equivalent) e.push("V12: gate.accessible_equivalent is required (L2)");
  if (!m.analog_synthesis?.accessible_equivalent) e.push("V12: analog_synthesis.accessible_equivalent is required (L2)");

  if (corpus) e.push(...validateCorpus(corpus).filter((x) => x.includes(m.id)));
  return e;
}

/** §8.1 V11 — prerequisite resolvability and acyclicity. */
export function validateCorpus(modules) {
  const e = [];
  const byId = new Map(modules.map((m) => [m.id, m]));
  for (const m of modules)
    for (const p of m.prerequisites || [])
      if (!byId.has(p)) e.push(`V11: ${m.id} references unresolvable prerequisite '${p}'`);
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map(modules.map((m) => [m.id, WHITE]));
  const visit = (id, path) => {
    if (colour.get(id) === GREY) { e.push(`V11: prerequisite cycle ${[...path, id].join(" -> ")}`); return; }
    if (colour.get(id) === BLACK) return;
    colour.set(id, GREY);
    for (const p of byId.get(id)?.prerequisites || []) if (byId.has(p)) visit(p, [...path, id]);
    colour.set(id, BLACK);
  };
  for (const m of modules) visit(m.id, []);
  return e;
}

/** §12.5 — every normatively specified rule must have a call site. */
export const SPEC_CALL_SITES = {
  fluencyCleared: "step() PHASE_2_GATE|GATE_SUBMIT guard (§3.5 row 5, §5.2)",
  calibration: "runner §7.1 assertions; L2 clients call after gate submission",
  tierForInterval: "runner §7.3 assertions; clients select the Phase 4 drill",
  validateCorpus: "validateSemantics() and the runner's corpus check (§8.1 V11)",
};
