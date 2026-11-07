# AEGIS · Step A Build Report — v1.7.0

**Brief:** `claude/STEP-A-BUILD-BRIEF.md` (Project, canonical). It matches the repo mirror `docs/STEP-A-BUILD-BRIEF.md` apart from the mirror's header note.
**Built:** 7 Nov 2026, by the scheduled build session "AEGIS Step A build".
**Baseline before any edit:** `APP_VERSION='1.6.1'`, `sw.js` CACHE `aegis-v1.6.1`, at repo head `2f62811`. `npm test` was green and `test:faults` caught 25/25.
**Status:** **Shipped.** On `main` as `5cf7821`, with the Pages deploy green (details at the end).

---

## What was built

| # | Piece | Where | Notes |
|---|---|---|---|
| 1 | **Three Domain-1 meters** (§3) | New `#arcMeters` card at the top of the right-hand column inside `.dash-grid` | **Reading** = D1 objectives read ÷ 6. **ARC** = one two-tone bar (mastered + gate-cleared-not-mastered); its headline is the gate-cleared %, and a tap or hover reveals "x/6 mastered, y/6 gate-cleared but not yet retained". **Overall** = mastered ÷ 6, with no partial credit and no averaging. The card renders only when ARC is on and the corpus is `ready` or `degraded` (the same guard `syncArcButtons()` uses). It re-renders when the corpus finishes loading and is removed when ARC is turned off. On a phone it sits below the five-domain list. |
| 2 | **Today / welcome-back card** (§4) | `#welcomeCard`, prepended to `#view-dash` | Dismissible, not a modal. Shows at most once per calendar day (`state.lastWelcomeSeen = today()`, set when shown) on entering Command. Priority ladder as locked: overdue review → just finished consolidating → mid-loop resume → next unstarted objective, or a caught-up message. Its button opens the module through `openArcModule()`. Never shown on the same visit as the first-open explainer. |
| 3 | **Explainer** (§5) | `#explainerOverlay` (own overlay, same pattern as `#wnOverlay`) + `#explainerLink` in the `#arcSettings` card on the Progress tab | Covers reading vs gate vs mastery, why the 24-hour wait exists, and what "overdue" means and what it blocks. It owns the first-ever open (`state.lastSeenVersion == null`); there is no new flag. |
| 4 | **Overdue-review gate** (§6) | `renderArc()` LOCKED branch | Blocks a LOCKED module's **Begin →** at 3+ overdue cards or any card more than 48 h overdue. The button is visibly disabled. The screen gives the reason and a **Review [most overdue] →** button. Reading, the glossary, the Range, and any in-flight module (including the overdue review itself) are never blocked. |
| 5 | **Consolidation-wait exits** (§7) | `renderArc()` CONSOLIDATION_PENDING branch | Adds "While you wait: [objective] is ready →" (the first other D1 module that is unlocked and actionable), **Browse the glossary →**, and **Run Ethics Tribunal →** when that trainer is unlocked. The countdown and the "Nothing you do here can shorten it" line are kept. No new content. |
| 6 | **Hint audit** (§8) | `modules/d1-0*.arc-module.json` (`gate.hints` only) | 9 rounds, 3 blind cooperative reviewers plus 1 hostile per round, fresh agents each round, no answer key. 1 kept, 11 rewritten, 0 deleted. Full record below and in `docs/HINT-AUDIT-v1.7.0.md`. |

The legacy dashboard (`domainPct`, `vocabPct`, `overallPct`, `rankFor`, the shield, ring, domain rows and ladder) is untouched. **With ARC off, the Command dashboard markup is byte-identical to v1.6.1**; `verify-step-a.mjs` S1 renders both and compares them.

## Functions and lines touched (`index.html`)

**Edited (targeted):**
- CSS: a new `v1.7.0 · Step A` block directly after `.arc-note`. Classes: `.arcm*`, `.welcome-card*`, `.arc-exits`, `.arc-block`, `.arc-foot.wrap-ok`.
- HTML: new `#explainerOverlay` after `#wnOverlay`, which is still before `#lessonOverlay`/`#arcOverlay`, so the ARC overlay stays on top. New `#explainerLink` inside the `#arcSettings` card.
- Default state: `lastWelcomeSeen:null`.
- `APP_VERSION`, the header badge, `CHANGELOG` (new v1.7.0 head entry).
- `render()`: calls `renderArcDash()` at the end.
- `switchView(v)`: `if(v==='dash')maybeShowWelcome();`
- `arcTick(id)`: when the clock resolves consolidation, it now pushes `{site:'consolidation', state_after}` to `arcCfg().log` (see judgment call 2). The transition itself still goes through `arcStep` → `arc-core.step()`.
- `renderArc()`: **LOCKED** branch (overdue gate) and **CONSOLIDATION_PENDING** branch (exits). No other branch changed.
- `boot()`: `initExplainer()`; the corpus-load callback also runs `renderArcDash(); maybeShowWelcome();`; the first-ever open shows the explainer, and otherwise What's New opens exactly as before.

**New (one additive block, before `TOAST + BOOT`):** `ARC_PAST_GATE`, `arcDomain1ModuleIds`, `arcReadingPct`, `arcGateClearedCount`, `arcMasteredCount`, `arcOverallPct`, `arcLive`, `arcOverdueCards`, `arcOverdueBlocksNewMaterial`, `arcMostOverdue`, `renderArcDash`, `arcWelcomePick`, `maybeShowWelcome`, `EXPLAINER_HTML`, `openExplainer`, `closeExplainer`, `initExplainer`, `arcWaitNextModule`, `arcTrainerUnlocked`, `arcWaitExitsHTML`, `arcWireWaitExits`.

**Not touched:** `arc-core.mjs`, FSRS (`fsrsNew`/`fsrsReview`, oracle 160/160), `scoreAccuracy`/`isPassed`/`computeQ`, gate submission, `arcPrereqsMet`, `arcDraftSite`/`arcRedrawWidget` and the answer widgets, `d1_4`'s threshold, the track crosswalk, and the FSRS grades from the v1.6.0 bug (left as decided).

**Other files:** `sw.js` (CACHE → `aegis-v1.7.0`), `package.json` (1.7.0, new `test:stepa`, Step A suite added to `npm test`), `verification/verify-version.mjs` (lockstep now also checks `package.json`, five artifacts), `CHANGELOG.md` (via `npm run changelog`), `README.md` (badge), `verification/README.md`.

## Judgment calls (none reopens a locked decision; flag any you disagree with)

1. **First-ever open shows the explainer first, then What's New.** In v1.6.1 What's New opens on every new version, including a first-ever visit. Opening both would stack two overlays. So the explainer goes first, as §5 says it owns that open, and closing it opens What's New exactly as v1.6.1 did. Returning learners see no change.
2. **Consolidation now leaves a log entry.** §4 rung 2 says to read "consolidation resolved" from `arcCfg().log`, but the log only recorded prequestion, gate and drill events, never the clock tick. `arcTick` now appends `{site:'consolidation'}` when the engine moves a module out of `CONSOLIDATION_PENDING`. That is a log line, not new FSM state.
3. **The Today card gives consolidation its clock tick.** Previously consolidation only resolved when you opened that module. The card runs the same `CLOCK_TICK` (through `arcStep` → engine) for pending modules before ranking, so rung 2 can actually fire. Rung 2 is "PHASE_4, no card yet, has a consolidation log entry": the first review is waiting.
4. **Rung 3 includes `NEEDS_RECALIBRATION`.** That state renders as a gate retake. Leaving it out would tell a learner with a lapsed module "you're caught up".
5. **The overdue gate counts only cards whose module loaded.** A card for a module that failed to download can never be cleared, which would break "always escapable". This is tested (S6) and has a fault (S15).
6. **Module `version` fields stay at 1.0.0.** Only hint text changed. `arc-core` does not read the version, and `CONTENT_VERSION_CHANGE` semantics would be wrong for a text edit. The `sw.js` cache bump makes clients refetch the modules.
7. **The app opens on Domains** (pre-existing: `boot()` calls `selectDomain(0)`). The Today card shows when you tap **Command**, or straight away if Command is already showing when the corpus loads.

## Hint audit record (summary — full trail in `docs/HINT-AUDIT-v1.7.0.md`; raw files in `verification/audit/hints-v1.7.0/`)

Keep rule: A, B and C all say "changes approach" **and** the hostile reviewer does not rate it HIGH. Otherwise it is cut and rewritten toward method, then re-reviewed. A factual flag from the hostile reviewer also triggered rewording.

| module | #0 | #1 |
|---|---|---|
| cia-triad | **kept** · CCC/MED | rewritten r1 → CCC/LOW (r2) |
| authn-nonrep-privacy | rewritten (r1 HIGH: glosses paraphrased the items) → CCC/MED (r2) | rewritten → CCC/MED (r2) |
| control-types | passed r1, split r2 → rewritten, reworded twice for hostile factual notes → CCC/LOW (r5) | rewritten twice → CCC/LOW (r3) |
| code-of-ethics | rewritten (r1 misled Canon II) → CCC/MED (r2) | rewritten 3× → CCC/MED (r4) |
| risk-lifecycle | rewritten 3× → CCC/LOW (r4) | rewritten 8× (HIGH in r1–3, r6, r8 from echoing step wording) → CCC/MED (r9) |
| governance | rewritten (r1 "policy = intention" misled) → CCC/MED (r2) | rewritten 5× → CCC/MED (r7) |

Final: 12/12 unanimous among the cooperative reviewers. No HIGH from the hostile reviewer, who rated 4 hints LOW and 8 MED. Probe: 211/211 (schema · V1–V13 · live scoring). The new S8 check asserts every gate still ships two non-empty hints.

**Notes for the design chat on the items themselves, not acted on (out of scope):** the "tamper-evident audit log" item is arguably accountability rather than strict non-repudiation. The "leaked exam questions" item (Canon IV) could be argued as II. The competence-disclosure item (III) conflicts with older ISC2 guidance that put competence under II. The risk-order item assumes the treatment is mitigation, which bears on the open `d1_4` question. Separately, the hostile reviewer was inconsistent on five-step ordering hints; keep that in mind for Phase 2's IR-Sim reorder gate.

## Tests

| suite | before | after |
|---|---|---|
| `verify-version.mjs` | 4 artifacts | **5** (adds `package.json`) — v1.7.0 |
| `verify-fsrs-oracle.mjs` | 160 | 160 |
| `arc-module-probe.mjs` | 211 | 211 (new hints) |
| `verify-module-seam.mjs` | 36 | 36 |
| `verify-arc-loop.mjs` | 100 | 100 (D2 reorder section unchanged, green) |
| **`verify-step-a.mjs`** (new) | — | **84** |
| `verify-mobile-ui.mjs` | 95 | **156** (header sweep unchanged; new §5 sweep) |
| `test:rollback` (v1.7.0 → v1.6.1 → v1.7.0) | 24 | 24 |

`verify-step-a.mjs` covers:
- **S1** ARC off: the dashboard is byte-identical to v1.6.1 (`git show 5a2e98d`), there is no card, and What's New is unchanged.
- **S2** The meter guard (loading or unavailable shows nothing), the re-render after corpus load (including across a reload), and removal when ARC is turned off.
- **S3** Meter arithmetic: every past-gate state with none mastered gives Overall 0; NEEDS_RECALIBRATION and CONSOLIDATION_PENDING count as gate-cleared; PHASE_2 does not; 1 mastered gives 17%. The tap reveals the split, and both segment widths are checked.
- **S4** The card shows on entering Command, Dismiss works, it is throttled per day and shows again the next day, and all four ladder rungs (plus the caught-up case) are driven through real clicks. Rung 2 goes through the real engine clock tick. The first-ever visit shows no card even with ARC on.
- **S5** The explainer owns the first open, What's New follows it, the Progress link reopens it, and its content is checked.
- **S6** Overdue thresholds from both sides (3 blocks, 2 does not; 49 h blocks, 47 h does not; an unloaded-module card never blocks). The disabled state is visible (opacity), the reason is shown, and the way out opens the *most* overdue module. While blocked, reading, the glossary, the Range and the overdue review itself all stay open.
- **S7** Consolidation exits with and without another unlocked objective; each exit actually navigates.
- **S8** The hints are present.

`verify-mobile-ui.mjs` §5 checks the meter card, the Today card and the explainer at 300/320/360/390/1280. It asserts no horizontal page scroll **and** no overlap (meter labels vs percentages, split text inside the card, Today card actions vs text, its two buttons vs each other, explainer close button vs heading, no sideways scroll inside the modal). It also checks the desktop half of the wrap trade-off: on desktop the Today card's actions sit *beside* its text.

### Fault injection — 46 faults · 46 caught · 0 escaped · 0 broken

All 25 v1.6.1 faults (A–H, C, T1–T6, L1–L4, C1–C2, H3–H8) are still caught. New:

| id | fault | caught by |
|---|---|---|
| S1 | meter counts gate-cleared as mastered | step-a (4) |
| S2 | NEEDS_RECALIBRATION not gate-cleared | step-a (5) |
| S3 | Overall averaged with Reading | step-a (2) |
| S4 | meters shown without the corpus guard | step-a (2) |
| S5 | meters not re-rendered on corpus load | step-a (1) |
| S6 | turning ARC off leaves the meters | step-a (1) |
| S7 | welcome card not throttled | step-a (1) |
| S8 | welcome card on the first-ever visit | step-a (1) |
| S9 | consolidation resolution not logged | step-a (2) |
| S10 | explainer does not own the first open | step-a (3) |
| S11 | overdue threshold off by one (`>3`) | step-a (7) |
| S12 | 48-hour rule loosened to 72 | step-a (1) |
| S13 | blocked Begin left enabled | step-a (3) |
| S14 | blocked state offers no way out | step-a (3) |
| S15 | unloaded-module card can lock you out | step-a (1) |
| S16 | consolidation exits removed | step-a (10) |
| S17 | while-you-wait ignores unlocked modules | step-a (4) |
| S18 | explainer re-open link removed | step-a (4) |
| W1 | welcome row forced onto one line (no wrap, no shrink) | ui (6) |
| W2 | welcome card stacks on desktop too | ui (1) |
| W3 | meter split text can overflow the card | ui (12) |

Two things changed while building the faults:
- The first W1 ("nowrap + `flex:none` actions") **escaped**. With `min-width:0`, the text column simply shrank, so the layout still held. That fault wasn't a real failure mode, so it was replaced with one that is (the row can neither wrap nor shrink).
- S10, S11, S14 and S16–S18 were first caught only by click timeouts aborting the suite. Clicks now go through a `tap()` helper that turns a missing or hidden control into a named failed assertion, so each of those faults is caught by a check that names it.

## Deferred / not done

- Freestanding "while-you-wait bonus practice" (parked by the brief).
- Item-bank observations from the hint audit (above) for the design chat.
- The live site couldn't be fetched from the build sandbox (the proxy blocks `github.io`). The deploy is confirmed by the green Pages run, not by a page fetch. Check on the phone: the header should read **v1.7.0**.

## Ship record

- **Commit:** `5cf7821` on `main`: "v1.7.0 — Step A: honest progress meters, Today card, explainer, overdue gate, consolidation exits, audited hints".
- **Deploy:** GitHub Actions "Deploy AEGIS to GitHub Pages", run `42400818237`: **completed · success** (18 s, 2026-11-07 18:20 UTC).
- This report lands in a follow-up docs-only commit.
