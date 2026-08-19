# AEGIS Phase 1 — Build Report

**v1.5.1 → v1.6.0** · Domain 1 as engine-driven ARC modules, behind a default-OFF beta toggle.

## What ships

| | |
|---|---|
| `index.html` | v1.6.0 — corpus loader, 5-phase loop, beta toggle |
| `sw.js` | cache `aegis-v1.6.0`, corpus precached at install |
| `arc-core.mjs` | ARC v4.3.0 reference engine, unmodified |
| `modules/*.json` + `index.json` | six Domain 1 modules and their manifest |

**332 automated checks, 0 failures**, across four suites:

| suite | checks | proves |
|---|---|---|
| `verify-version.mjs` | 4 artifacts | `APP_VERSION` · header · CHANGELOG · sw CACHE all claim 1.6.0 |
| `arc-module-probe.mjs` | 211 | schema · semantics V1–V13 · live scoring, per module and as a corpus |
| `verify-module-seam.mjs` | 36 | fetched modules + service worker, including offline and every failure mode |
| `verify-arc-loop.mjs` | 81 | the 5-phase loop, all six modules driven to MASTERED |

## The three assertions

**1. The gate is the assertion.** No completion click exists in the ARC path. Passage is
`isPassed()` against the module's own `pass_threshold`. 4 of 6 fails; 5 of 6 passes; three
consecutive failures route back to the reading rather than walling the learner in. The
classic "mark complete" tick provably cannot move ARC state.

**2. Consolidation is enforced.** Fifty clock ticks in one sitting leave the module in
`CONSOLIDATION_PENDING` with ~24h remaining. Only elapsed wall-clock opens Phase 4.

**3. Confidence precedes feedback — structurally.** Submitting without it is refused;
recording it after feedback returns `false`; the log proves the ordering by timestamp
(`confidence_recorded_at ≤ feedback_at`). Confident-and-wrong raises OVERCONFIDENCE.

## Two architectural findings, both from half-escaped faults

**The gate has two independent layers.** Hardcoding the display's `passed` to `true` failed
the display check but the module still refused to advance — `arc-core`'s `step()` recomputes
passage from the submission and gate and does not trust the caller's flag. Breaking
advancement required a second, deeper injection. The display can lie and the FSM still holds.
Both checks are kept because they guard different properties.

**The widget→engine boundary needed a validator, not just a try/catch.** `scoreAccuracy`
throws on a non-permutation (`kendall_tau`) but *silently scores* a half-finished
`bucket_assignment` — a partial classify answer scores 0.5 and records as a real attempt.
So malformed input is refused before the engine sees it, with an actionable message, and
fails **closed**: no score, no attempt burned, no log record, no feedback revealed.
Removing the validator is caught in five places, including proof that the engine would
have scored the partial answer rather than complaining.

## Non-invasiveness, proven at three layers

- **Network** — with the beta off, zero requests for `modules/*` or `arc-core.mjs`.
- **DOM** — entry points are added and removed, not CSS-hidden. 6 buttons on, 0 off.
- **Behaviour** — the classic lesson/quiz/glossary flow is untouched; ARC state is a
  separate key and the classic tick cannot reach it.

## Degradation is legible, not silent

A module that fails to load is named in Settings with its reason and a note that nothing
is lost; its objective shows a disabled `unavailable` chip in the Domains list rather than
vanishing. Losing the DAG root cascades transitively — five dependants dropped with
`prerequisite … unavailable` — so no learner is stranded at a gate that cannot open.

## Open, for the dogfood rather than a test

1. **The 24h consolidation gate** — provably enforced, but whether it protects retention or
   merely nags is a two-week question, not a unit-test one.
2. **`d1_4`'s perfect-order threshold** (10/10) — same class of number.
3. **The strategy-only gate hints** — rewritten after the item-level audit; a too-generic
   hint fails safe (wastes a `q` point, cannot mislead), so the dogfood adjudicates.
