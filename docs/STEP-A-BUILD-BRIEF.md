# AEGIS · Step A Build Brief — Dashboard, progress model & the two retro fixes

> Mirror of the design Project's `claude/STEP-A-BUILD-BRIEF.md`, committed so a build session
> can always reach it. If the two ever differ, the Project copy wins — and fix the drift.

**For:** the build chat. **Ships as:** **v1.7.0** (confirmed 7 Nov 2026).
**Prereqs:** v1.6.1 live — **met** (commit `5a2e98d`; verified on the Galaxy S25+ 7 Nov 2026, reorder reviews answerable). Fault-injection harness committed (`npm run test:faults`).
**Outcome:** three honest progress meters, a welcome-back card, a first-open explainer, a real overdue-review gate, a redesigned consolidation-wait screen, and an audited hint set — closing out the Phase 1 dogfood retro (locked in `roadmap.html`, 29 Sep 2026).

---

## Decisions confirmed (7 Nov 2026) — do not relitigate

1. **Version: v1.7.0.**
2. **Meter scope:** a **Domain-1 panel**, shown only while ARC mode is enabled, **additive** to the legacy all-domain dashboard (§2). Not a replacement.
3. **`NEEDS_RECALIBRATION` counts as gate-cleared-not-mastered** — verified against `arc-core.mjs` `step()`: the state is only entered from `PHASE_4_SPACED_QUEUE|DRILL` or `MASTERED|DRILL` on a lapse (`q < 3`), and both of those are only reachable after passing the Phase 2 gate. The `PAST_GATE` list in §3 is correct.
4. **Hint audit runs in parallel** with the code work (separate workstream, e.g. independent reviewer agents) and **ships in the same v1.7.0 release**. If the audit hasn't converged when the code is ready, stop and tell Wayne — don't ship the old hints silently, and don't ship empty hint arrays.
5. **Bad FSRS grades from the v1.6.0 reorder bug: leave them.** No migration, no scrub.

---

## 0. Before you start

- **Work from the repo.** Clone `cartoticus/aegis` and confirm `APP_VERSION === '1.6.1'` in `index.html` and `aegis-v1.6.1` in `sw.js`. Run `npm install && npm test && npm run test:faults` first — all green, 25/25 faults caught — so you start from a known baseline.
- **Code excerpts below were drawn from v1.6.0.** The sections they quote (`renderArc()`'s `LOCKED` and `CONSOLIDATION_PENDING` branches, the progress helpers, `syncArcButtons()`) were not changed by v1.6.1, so they still match. Anything touching ARC answer widgets uses the v1.6.1 helpers: `arcDraftSite(key)` for draft ownership and `arcRedrawWidget(spec, root)` for redraws — never a full `renderArc()` from inside a widget.
- **Shipped means pushed:** finish with the commit on `main` and a green Pages run, and put both in the build report.

---

## 1. Scope guardrails

- ✅ The three progress meters, the welcome-back card, the first-open explainer, the overdue-review gate, the consolidation-screen redesign, and the hint-content audit. These land together because they touch the same surfaces (dashboard render, ARC overlay, Settings).
- ❌ **Not** Phase 2 (rewiring Range trainers as ARC gates), Domains 2–5 as ARC modules, Domain 6, the transfer/motivation layer, or the capstone.
- ❌ Not a hint **mechanism** change — hints still cost scheduling quality. This brief only replaces hint *text*.
- ❌ Don't touch `d1_4`'s threshold or the track-crosswalk question — both stay open.
- ❌ Don't touch `arc-core.mjs`, FSRS, `scoreAccuracy`/`isPassed`, or gate logic.
- ❌ Don't regress anything v1.6.1 fixed. If a change touches the same surfaces (Domains objective row, ARC overlay, header), `verify-mobile-ui.mjs`, the loop suite's D2 section and `npm run test:faults` must stay green. The new dashboard card sits near the header: the 300–1280px header sweep must stay green.

---

## 2. How this relates to the existing (legacy) progress system

Two progress systems currently coexist in `index.html`, and this brief does **not** unify them — that's a Phase 3–4 question. Today:

- **Legacy** (`domainPct()`, `vocabPct()`, `overallPct()`, `rankFor()`, driving `render()`'s shield/ring/domain-rows/ladder) — covers all five domains. This is what a learner with the ARC toggle off sees, and what Domains 2–5 still run on with it on.
- **ARC** (`arcCfg().fsm[id].state`, surfaced today only as per-objective button labels via `syncArcButtons()`) — Domain 1 only, no dashboard-level rollup.

**Decision (confirmed):** the three meters are a **Domain-1-scoped panel** on the Command dashboard, shown only while ARC mode is enabled, additional to the existing shield/ring/domain-rows. Showing Domains 2–5 at 0% under a Mastered-only definition would be misleading, not honest. When Domains 2–5 are ARC-ified, the legacy system retires and the meters become the whole dashboard.

---

## 3. The three progress meters (new)

- **Reading %** — coverage only. `(objectives read in Domain 1) / 6`, using `state.objectives[d1_N]`. Feeds nothing else; label it "what you've read, not what you've retained".
- **ARC %** — a single **two-tone bar**: *gate-cleared* and *mastered* segments. Tap/hover reveals the split (`x/6 mastered, y/6 gate-cleared but not yet retained`) — don't put both numbers in the headline.
- **Overall %** — `mastered / 6`, zero partial credit. "The honest headline" — allowed to read lower than Reading % or the legacy `overallPct()`. Don't average it with anything.

```js
// New, additive — does not touch domainPct/vocabPct/overallPct/rankFor.
function arcDomain1ModuleIds(){ return Object.values(ARC_OBJECTIVE_MAP); } // 6 ids, d1 only
function arcReadingPct(){
  const ids=Object.keys(ARC_OBJECTIVE_MAP); // d1_0..d1_5
  const done=ids.filter(k=>state.objectives[k]).length;
  return ids.length?Math.round(done/ids.length*100):0;
}
function arcGateClearedCount(){
  const PAST_GATE=['PHASE_3_SYNTHESIS','CONSOLIDATION_PENDING','PHASE_4_SPACED_QUEUE','MASTERED','NEEDS_RECALIBRATION'];
  return arcDomain1ModuleIds().filter(id=>PAST_GATE.includes(arcCfg().fsm[id]?.state)).length;
}
function arcMasteredCount(){
  return arcDomain1ModuleIds().filter(id=>arcCfg().fsm[id]?.state==='MASTERED').length;
}
function arcOverallPct(){ const n=arcDomain1ModuleIds().length; return n?Math.round(arcMasteredCount()/n*100):0; }
```

Render as a new card in the dashboard's `.dash-grid`, visible only when `arcCfg().enabled && (ARC.status==='ready'||ARC.status==='degraded')` — the same guard `syncArcButtons()` uses — so it never appears mid-load or when the corpus failed to fetch. Re-render it when the corpus finishes loading.

---

## 4. Today panel + welcome-back card (new)

A light, **dismissible** card — not a blocking modal — shown on entering the Command dashboard, throttled to once per calendar day (`state.lastWelcomeSeen = today()`).

**Priority ladder (locked, highest first):**
1. Reviews due now — any card in `arcOverdueCards()` (§6): "Review now" into Phase 4 for the most-overdue module.
2. Just finished consolidating — a module whose `CONSOLIDATION_PENDING` resolved to `PHASE_4_SPACED_QUEUE` since last session (read from `arcCfg().log` rather than inventing new state).
3. Mid-loop resume point — a module in `PHASE_0`–`PHASE_3`: "Pick up where you left off."
4. Caught up / next unstarted objective — a `LOCKED` module with prerequisites met (`arcPrereqsMet()`), or a congratulatory state if none remain.

**First-ever open is different:** if `state.lastSeenVersion == null`, show the explainer (§5) instead, never both on the same visit. Don't add a second "first open" flag.

---

## 5. Onboarding + explainer (new)

A short, dismissible explainer: reading vs. gate-clearing vs. mastery, why there's a 24-hour wait, what "overdue" means. Two entry points:
- Owns the very first-ever open (mutually exclusive with the welcome-back card).
- A **permanent re-open link** on the Progress tab next to `#arcSettings`.

Its own overlay (`#explainerOverlay`, same pattern as `#wnOverlay`) — don't repurpose What's New.

---

## 6. Overdue-review gate (new)

**Threshold (locked):** block starting **new** ARC material (a `LOCKED` module's "Begin →") when **3+ cards are overdue**, or **any card is overdue by more than 48 hours**. Never blocks reading, glossary, or Range trainers. Always show why and the way out.

```js
function arcOverdueCards(){
  const now=Date.now();
  return Object.entries(arcCfg().cards||{})
    .filter(([id,card])=>card && Date.parse(card.due)<=now)
    .map(([id,card])=>({id, overdueMs: now-Date.parse(card.due)}));
}
function arcOverdueBlocksNewMaterial(){
  const overdue=arcOverdueCards();
  if(overdue.length>=3) return {blocked:true, reason:'3+ reviews are overdue'};
  const worst=Math.max(0,...overdue.map(o=>o.overdueMs));
  if(worst > 48*3600*1000) return {blocked:true, reason:'a review is more than 48 hours overdue'};
  return {blocked:false};
}
```

Wire into the `LOCKED` branch of `renderArc()`: prerequisites met but `arcOverdueBlocksNewMaterial().blocked` → disable "Begin →" (visibly — a control that looks live and does nothing is a locked door), show the reason, and a button that opens the most-overdue module (its state is already `PHASE_4_SPACED_QUEUE`).

---

## 7. Consolidation-wait screen — redesign (fix, not new content)

The `CONSOLIDATION_PENDING` branch in `renderArc()` is a dead end — a countdown and a single Close button:

```js
// current shipped behavior — the bug (unchanged in v1.6.1)
if(s.state==='CONSOLIDATION_PENDING'){
  const ms=arcConsolidationRemainingMs(id),h=Math.floor(ms/3600000),mi=Math.round(ms%3600000/60000);
  c.innerHTML=head+`<div class="arc-phase">Consolidating</div>
    <p>...</p><div class="arc-count">${h}h ${mi}m</div>
    <p class="muted">The first review unlocks then. Nothing you do here can shorten it.</p>
    <div class="arc-foot"><button class="btn ghost" id="arcClose2">Close</button></div>`;
  $('#arcClose2').onclick=closeArc;
  return;
}
```

Not a data-model block — `arcPrereqsMet()` never treats a sibling's consolidation timer as a lock. Other unlocked objectives, the glossary and the Range are already reachable; the screen just never says so.

**Fix — same screen, real exits, no new content:**
- Another Domain 1 objective unlocked and not mastered → "While you wait: [objective name] is ready →" opening that module.
- Always "Browse the glossary →" (`switchView('glossary')`), and "Run Ethics Tribunal →" if unlocked.
- Keep the countdown and the "nothing shortens it" copy.
- Freestanding "while-you-wait bonus practice" is **out of scope** (parked).

---

## 8. Hint-content audit (parallel workstream, same release)

Retro verdict: hints cost scheduling quality but the text doesn't change the learner's approach. **The mechanism stays.** Content fix only.

1. Pull every `gate.hints[]` from the six Domain 1 modules.
2. Independent reviewers (no answer key) judge each hint: *"does this change how I'd approach the answer, or just restate the prompt?"*
3. Unanimous "changes approach" → keep. Any split, or a hostile-reviewer "HIGH" (gives the answer away) → cut and rewrite.
4. Rewrite toward the *method* (which classifier to apply, what distinction to check), never the answer. Re-review rewrites the same way until unanimous.

`modules/*.json` content edit only. Re-run `arc-module-probe.mjs` (all three layers) after editing. Follow `docs/CONTENT-SOURCING-GUIDELINES.md`. Record the audit (hints, verdicts, rounds) in `docs/` as the item-bank audit was.

---

## 9. Version, changelog

- Bump `APP_VERSION`, header badge, in-app `CHANGELOG`, `sw.js` `CACHE` and `package.json` together → **v1.7.0**; then `npm run changelog`.
- The changelog names all six pieces plainly and says outright that **Overall % is Mastered-only and may read lower than before** — leading, not buried.

---

## 10. Test checklist

- [ ] Toggle OFF: dashboard identical to v1.6.1 — no meter card, no welcome-back card, What's New unchanged.
- [ ] Meters only render when ARC is enabled and the corpus is `ready`/`degraded` — no flash during load.
- [ ] Overall % is 0 until a module reaches `MASTERED`; gate-cleared modules count only toward ARC %'s gate-cleared segment. `NEEDS_RECALIBRATION` counts as gate-cleared.
- [ ] Welcome-back card at most once per calendar day; first-ever open shows the explainer instead, never both.
- [ ] Overdue gate: 3 overdue → "Begin →" blocked; 2 overdue (<48h each) → not; 1 overdue by 49h → blocked. Reading/glossary/trainers never blocked. Blocked state shows reason + way out.
- [ ] Consolidation screen: another unlocked objective → link appears and opens it; none unlocked → glossary/trainer links still appear.
- [ ] New surfaces (meter card, welcome card, explainer) swept at 300/320/360/390 and desktop in `verify-mobile-ui.mjs` — assert both overlap and horizontal scroll.
- [ ] `npm test` and `npm run test:faults` green. **Add faults for every new feature** to `verification/fault-inject.mjs` (e.g. meter counts gate-cleared as mastered; welcome card not throttled; overdue threshold off by one; blocked "Begin" left enabled; consolidation exits removed) and confirm each is caught.
- [ ] Hint audit: every kept hint has unanimous agreement; every cut hint is replaced, not deleted.
- [ ] Version lockstep at v1.7.0; What's New leads with the Overall-%-is-now-honest change.
- [ ] Pushed to `main`; Pages run green; commit hash in the build report.

---

## 11. Definition of done

Domain 1 (with ARC enabled) shows three honest, additive progress meters without disturbing the legacy dashboard; a throttled welcome-back card replaces silence on return visits; a first-open explainer teaches the reading/gate/mastery distinction and stays reachable; new ARC material is gated behind a real, always-escapable overdue threshold; the consolidation screen offers productive exits; the six Domain-1 hint sets have passed blind review. `d1_4`'s threshold and the track-crosswalk question remain open. **v1.7.0 is live on `cartoticus.github.io/aegis`**, with a build report (`docs/STEP-A-BUILD-REPORT.md`, and `claude/STEP-A-BUILD-REPORT.md` in the design Project if reachable) ending in the commit hash and deploy result.
