# AEGIS Phase 2 build report (v1.8.0): five pilot modules, Range trainers as gates

**Brief:** `claude/PHASE-2-BUILD-BRIEF.md` (Project). **Built:** 26 Nov 2026 by the scheduled build session "AEGIS Phase 2 build".

**Baseline, checked before any edit:**
- `APP_VERSION === '1.7.1'` on `main`, `sw.js` CACHE `aegis-v1.7.1`, head `376a955`, full history.
- Pages runs `45715835645` (for `00f6414`) and `45716265394` were both green.
- Baseline `npm test` all green, and `test:faults` caught **50/50**.

**Status: shipped.** Commit `ceb89fb` is on `main` and the Pages deploy is green (details at the end).

## 1. Modules built

| key | module id / file | profile | gate → metric | threshold | lesson | sources |
|---|---|---|---|---|---|---|
| `d2_3` | `isc2.cc.d2.incident-response` · `d2-03-incident-response` | CONCEPT | ORDER_SEQUENCE → `kendall_tau`, 5 steps (the IR Sim's optimal path) | 10/10 pairs (perfect order) | **new** | `nist-sp800-61r2`, `nist-sp800-61r3`, `cisa-ir-playbooks` |
| `d3_1` | `isc2.cc.d3.least-privilege` · `d3-01-least-privilege` | CONCEPT | CONSTRUCT_SET → `set_f1`, `ACL_SCENARIO` verbatim (4 needed, 5 dangerous) | **`ratio: 1.0`** (see §6.1) | from `LESSONS.d3_1`, expanded | `nist-sp800-53r5`, `cis-controls-v8` |
| `d4_1` | `isc2.cc.d4.subnetting` · `d4-01-subnetting` | **SKILL** | CLOZE → `correct_slot_ratio`, 172.16.45.130/26: network, broadcast, usable hosts, mask | 4/4 (V13), `expected_duration_s` 240 | from `LESSONS.d4_1`, block-size method added | `ietf-rfc4632`, `ietf-rfc1918` |
| `d5_1` | `isc2.cc.d5.security-awareness` · `d5-01-security-awareness` | CONCEPT | CLASSIFY → `bucket_assignment`, **12** one-line messages (sender · subject · the ask) | 11/12 | from `LESSONS.d5_1`, expanded | `nist-sp800-50r1`, `nist-sp800-63b4`, `cisa-guidance` |
| `d5_2` | `isc2.cc.d5.logging-monitoring` · `d5-02-logging-monitoring` | CONCEPT | CLOZE → `correct_slot_ratio` with the embedded SOC terminal (`gate.workspace: "soc-terminal"`). Findings: source IP, failed attempts (5), accounts tried (3), span in seconds (8), any success? (no) | 5/5 | **new** | `nist-sp800-92`, `cisa-event-logging`, `mitre-attack` |

Each module is a full ARC module:
- a prequestion, a reading, a gate with two audited strategy-only hints, and analog synthesis with a calibration question
- drills at RECOGNITION (CLOZE), APPLICATION (CLASSIFY, or CLOZE for subnet) and GENERATIVE (FREE_RECALL)
- an `accessible_equivalent` on the gate and analog
- the only prerequisite is `isc2.cc.d1.cia-triad`, so no invented edges
- `invalidation_policy: REVIEW` and `provenance.sources` from the registry

**Three-layer validation:** `arc-module-probe.mjs` gives **378/378** (schema, V1–V13 with `validateCorpus`, live scoring) across all 11 modules. In-page `validateCorpus(ARC.modules)` returns `[]`.

**Source check (brief §"Content sourcing"):**
- **NIST SP 800-61 Rev. 3** is final (April 2025) and supersedes Rev. 2 (2012). It frames incident response through the six CSF 2.0 functions. The lesson teaches the four-phase lifecycle as the exam-tested model, attributes it to Rev. 2, and states plainly that Rev. 3 reframes it. The exam-tested model does not change, so there was no need to stop. In the registry, `nist-sp800-61r3` is added and `nist-sp800-61r2` is marked `superseded`.
- **NIST SP 800-92 (2006)** is still the current final. Rev. 1 exists only as an initial public draft (Oct 2023), and the CSRC page says NIST is "in the process of addressing public comments". The final is cited, and the draft is noted in the registry.
- **ATT&CK:** the lesson cites IDs only (T1110, T1110.001, T1110.003).
- **Registry:** 1.0.0 → 1.1.0 with eight new entries. The Project copy has been updated to match.

`modules/index.json` lists all 11. The service worker precaches whatever the manifest lists, so no list in `sw.js` changed.

## 2. App changes (`index.html`)

- **`ARC_OBJECTIVE_MAP`** gains `d2_3 d3_1 d4_1 d5_1 d5_2`. `syncArcButtons()` already iterates the map, so the five objectives get ARC buttons when ARC is on. With ARC off, the markup is unchanged (asserted byte-for-byte against v1.7.1).
- **Split module lists.** `arcDomain1Keys()` returns the `d1_*` keys. `arcDomain1ModuleIds()` returns those six ids. The new `arcAllModuleIds()` returns every ARC objective. `arcReadingPct()` reads `d1_*` keys only.
- **SOC terminal refactor.** `createTerminal({body, tasks, mission, autofocus, banner, onCleared})` returns an instance bound to its root element. Nothing global remains except `FS` (read-only) and `termState`, which is still the name of the free-play instance.
  - **Free-play:** `initTerminal()` builds the free-play instance on `#termBody`/`#termTasks` with the mission checklist, the teaching commentary and `completeDrill('terminal')` on clearing.
  - **Gate:** the gate builds its own instance in `#arcTermBody`. It has no checklist, no commentary (the "→ Five failed logins from 203.0.113.66 in 8 seconds…" line would hand over the findings), no `completeDrill` and no autofocus. The slots sit below it, and only the slots are scored.
- **Labelled slots.** An optional `validation_payload.slot_labels` names each blank. This is allowed by the schema, and the engine ignores it. With labels, the slot stacks label over input, and the input is monospace at 16 px so phones don't zoom.
- **SKILL gate.**
  - The gate shows the rule before the attempt: all N right, no hint, within the time.
  - The hint button says that revealing one means the attempt cannot clear.
  - The result screen's heading now follows the **engine's** verdict (the state after `step()`), not the display's `isPassed` copy. Before this, a right-but-not-fluent subnet answer would have said "✓ Gate cleared" while the engine kept the learner at the gate.
  - When the answer is right but not fluent, the screen says why ("used a hint" / "took N minutes").
- **`arcStep` passes `has_prequestion`.** The engine sends SKILL modules straight to reading unless `ctx.has_prequestion === true`, so without this the subnet prequestion would never show. CONCEPT behaviour is unchanged.
- **`set_f1` result line.** "4 of 4 needed selected, plus 1 that should not be there — this gate needs exactly the right set". Without it, an over-provisioned answer read "4 of 4 correct, ✗ Not yet".
- **CSS:** `.arc-item .ai-txt{overflow-wrap:anywhere}`. Phishing addresses such as `helpdesk@yourcompany.com.mailbox-support.io` pushed the modal sideways at every phone width; the new sweep caught it.
- **Copy:** the explainer now reads "all of Domain 1 plus five objectives in Domains 2–5 so far". There is a What's New entry for 1.8.0. The static footer placeholder `v1.1.0` is now `v1.8.0` (the v1.7.1 report's note).

**Not touched:** `arc-core.mjs`, FSRS, `scoreAccuracy`/`isPassed`/`computeQ`, gate submission (`arcSubmitGate`), `arcPrereqsMet`, `arcDraftSite`/`arcRedrawWidget`, the free-play trainers' screens and scoring, and the Domain 1 modules.

### Every caller of `arcDomain1ModuleIds()`, and the choice made

| caller | before | now | why |
|---|---|---|---|
| `arcGateClearedCount()` | all of map | **D1 only** | ARC meter (Domain 1 panel) |
| `arcMasteredCount()` | all of map | **D1 only** | ARC and Overall meters |
| `arcOverallPct()` | all of map | **D1 only** | Overall meter denominator stays 6 |
| `renderArcDash()` (`n`) | all of map | **D1 only** | all three meters and the split text |
| `arcReadingPct()` (keys) | all keys | **`d1_*` only** | Reading meter |
| `arcWelcomePick()` | all of map | **`arcAllModuleIds()`** | Today card sees every module |
| `arcWaitNextModule()` | all of map | **`arcAllModuleIds()`** | consolidation exits |
| `arcOverdueCards()` | reads `cards` | unchanged | already counted every card |
| `syncArcButtons()`, `renderArcSettings()` | map / `ARC.modules` | unchanged | already all modules |

## 3. Audits

The full record is in `docs/ITEM-AUDIT-v1.8.0.md`; the raw files are in `verification/audit/items-v1.8.0/`. Each round used 3 cooperative reviewers and 1 hostile reviewer, all fresh agents, with no answer key. The audit covered 15 scored banks, 5 FREE_RECALL keyword sets and 10 hints.

- **r1, all 5 modules:** every bank was answered to the key by all four reviewers. Fixes followed: an IR step that mixed two phases, an ambiguous payroll-report item, a contradictory "no hint" prompt on the subnet gate, and a phishing set the request column alone could sort (now 12 messages, including a hijacked internal account and a legitimate external supplier). A FREE_RECALL keyword set was also replaced: `keyword_density` matches whole words only, so "alerts" never counted for "alert", and expert answers scored 3–4/8. Four hints were rewritten.
- **r2, all 5:** unanimous for least privilege, subnetting and awareness. The **IR gate was rated HIGH**: the two containment steps had no dependency between them. Step 2 now uses the running workstation's connection records, so it depends on step 1. IR hint 1 and logging hint 1 were rewritten.
- **r3, IR and logging:** no HIGH. The fixes were factual nits: connections are "records in memory" after isolation, the lesson now names detection-time metrics, and a log line no longer claims to record the tried password.
- **r4, IR and logging: unanimous.**

**Hints:** 10/10 rated CHANGES_APPROACH by A, B and C, with none rated HIGH leak. 4 were kept from r1, and 6 were rewritten once or twice.

## 4. Tests

| suite | v1.7.1 | v1.8.0 | notes |
|---|---|---|---|
| `verify-version.mjs` | 5 artifacts | 5 | all claim v1.8.0 |
| `verify-fsrs-oracle.mjs` | 160 | 160 | |
| `arc-module-probe.mjs` | 211 | **378** | 11 modules |
| `verify-module-seam.mjs` | 36 | 36 | counts now read from the manifest (`NMOD`), not hard-coded 6 |
| `verify-arc-loop.mjs` | 112 | **132** | all 11 modules driven to MASTERED; the mastery bar is the module's own (SKILL 30 d) |
| `verify-step-a.mjs` | 99 | 99 | "caught up" now means every ARC module is mastered |
| **`verify-phase2.mjs`** (new) | — | **227** | below |
| `verify-mobile-ui.mjs` | 156 | **390** | new §6 |
| `test:rollback` (v1.8.0 → v1.7.1 → v1.8.0) | 24 | 24 | |

`verify-phase2.mjs` covers:
- **P0:** the corpus has 11 modules, the map, ARC buttons, `arcDomain1ModuleIds` is exactly D1, and `validateCorpus` returns `[]`.
- **P0b:** a Phase 2 module served with an unresolvable prerequisite is dropped, the drop reason names the prerequisite, its button reads "unavailable", and the other ten load (degraded).
- **P1:** each of the five modules runs the full loop through the **real DOM**: ARC button → Begin → prequestion → read → **wrong** gate (fails, stays at gate, logged as failing) → **right** gate (Phase 3) → reflection → consolidation → next-day clock tick → drill recalled.
- **P2:** IR gate. The widget doesn't start in key order (precondition). A click-sort into the **reversed** order scores 0 and fails. The right order scores 1.0 and advances. An eradicate/restore swap scores 9/10 and fails.
- **P3:** subnet (SKILL).
  - Perfect, unhinted and in time → clears.
  - **Same answers over time** → fails, and the screen says it took too long.
  - **Same answers with a hint** → fails, and the screen says a hint was used.
  - **One wrong slot** → 3/4, fails, and no fluency note appears.
  - The SKILL module enters Phase 0.
- **P4:** SOC gate.
  - The terminal is embedded with no checklist, and the slots sit below it. `cat` and `grep` work. The commentary that gives the findings is **not** printed.
  - Wrong IP fails even after investigating. **No commands typed + right findings → passes.**
  - No `drills.terminal` is recorded at any point.
  - **Free-play SOC Terminal:** the mission checklist renders, the commentary still teaches, the mission completes, `drills.terminal === true`, the checklist is fully ticked, the week count goes up by exactly 1, and focus follows the prompt.
- **P5:** least privilege. Needed permissions plus "Delete audit logs" → F1 < 1, fails, and the screen names the extra grant. Granting everything fails. The exact set passes.
- **P6:** phishing. A half-classified answer leaves Submit disabled and the screen asks for every part. Forcing `arcSubmitGate()` is **refused**: nothing is logged and no attempt is burned. The full correct answer passes.
- **P7:** meters isolation. With all five new modules MASTERED, every D1 module LOCKED and `d2_3…d5_2` marked read, Reading, ARC and Overall all read 0 and the split reads "0/6 … 0/6". Positive control: CIA mastered alone gives 17%.
- **P8:**
  - The Today card resumes a D5 module and offers a D2–5 module as "next". Through the DOM it names the module and opens it.
  - The consolidation exit offers another D2–5 module.
  - Three overdue D2–5 reviews block Begin, with the reason shown.
- **P9:** ARC off. Domains, Range and Command `outerHTML` are **byte-identical to v1.7.1** (`git show 00f6414:index.html`), no ARC buttons render, and the corpus is never fetched.

`verify-mobile-ui.mjs` §6 sweeps all five gates at 300/320/360/390/1280.
- **Fit:** the modal stays inside the viewport, with no horizontal page scroll and no sideways scroll inside the modal.
- **No overlap:** slot labels vs inputs, item text vs selects, ordering text vs move buttons. Inputs are at least 120 px wide, and Submit is inside the modal.
- **SOC terminal:**
  - It sits inside the modal, and its body doesn't scroll sideways.
  - The prompt doesn't overlap the input, and the input is inside the terminal and at least 80 px wide.
  - The findings are below the terminal.
  - After `cat` of the whole log, nothing scrolls sideways.
  - **At phone widths with the viewport cut to 480 px (keyboard up), the focused last finding is on screen.**

### Fault injection: 71 faults, 71 caught, 0 escaped, 0 broken

All 50 earlier faults are still caught. S2's pattern was re-pointed because a comment now sits between `ARC_PAST_GATE` and `arcDomain1ModuleIds`; it is the same mutation. The new faults:

| id | fault | caught by |
|---|---|---|
| P1 | meters include non-D1 modules | phase2 (6) |
| P1b | Reading counts non-D1 objectives | phase2 (2) |
| P2 | Today card ignores non-D1 modules | phase2 (5) |
| P2b | consolidation exits ignore non-D1 | phase2 (1) |
| P3 | subnet fluency bypassed (profile sent as CONCEPT) | phase2 (4) |
| P3b | subnet fluency bypassed (hints and latency not sent) | phase2 (4) |
| P4 | SOC gate scores commands instead of slots | phase2 (15) |
| P5 | gate terminal writes `drills.terminal` (mission + completeDrill) | phase2 (4) |
| P6 | free-play terminal no longer records cleared | phase2 (2) |
| P6b | free-play terminal loses its checklist | phase2 (2) |
| P6c | free-play terminal loses its commentary | phase2 (5) |
| P7 | IR gate scored from the answer key, not the screen | phase2 (10) |
| P8 | phishing gate scores a half-classified answer | phase2 (2) |
| P9 | least-privilege gate ignores distractors (`min_correct 4/4`, on the module) | phase2 (20) |
| P10 | module with an unresolvable prerequisite still loads (loader drop removed) | phase2 (5) |
| P11 | SKILL result screen claims the gate cleared (display `passed`) | phase2 (8) |
| P12 | SKILL module skips its prequestion | phase2 (3) |
| P13 | gate terminal prints the finding commentary | phase2 (1) |
| U1 | long phishing addresses no longer wrap | ui (4) |
| U2 | gate terminal input can overflow | ui (12) |
| U3 | labelled slots squeezed beside long labels | ui (16) |

P7 and P9 were first caught only by aborts (0 named checks). The helpers now turn a missing control into a named failed assertion and use a 5-second default timeout, so both are caught by named checks (10 and 20).

## 5. Deferred and not done

- Per-domain meters, the other Domain 2–5 objectives, Domain 4 Advanced, the track crosswalk, the `d1_4` threshold and drag-to-reorder are all out of scope, as briefed.
- The live site can't be fetched from the build sandbox. The deploy is confirmed by the green Pages run.

## 6. Judgment calls (none reopens a locked decision; flag any you disagree with)

1. **Least-privilege gate uses `pass_threshold: {ratio: 1.0}`, not `min_correct`.** `set_f1` reports `correct_count` = true positives, and `isPassed` prefers `min_correct`. Under `min_correct: 4, item_count: 4`, ticking **all nine** permissions passes, because distractors never count. `ratio: 1.0` makes F1 the test: the exact set passes, and one extra grant (0.889) or one missing (0.857) fails. This is the free-play Workshop's own criterion. It is V4/V5-legal because there is no `item_count`, so the small-set rule doesn't fire. **Pre-existing, not fixed:** the same defect exists in two Domain 1 APPLICATION drills, `cia-triad` and `control-types` (`min_correct 3/4`). Select-all scores F1 0.667, so q = 3.3, which counts as "Recalled". Fixing that changes D1 content and needs its own audit, so it is left for the design chat.
2. **The result heading follows the engine.** Before this change, a passing gate jumped straight to Phase 3, so the result screen was only ever seen on a miss. A SKILL miss on fluency was the one case where the screen ("✓ Gate cleared") and the engine (still at the gate) disagreed.
3. **`has_prequestion` passed to `step()`.** This is the engine's own documented switch (rows 1–2). Without it, the SKILL module would skip a prequestion the brief requires.
4. **`expected_duration_s` = 240 for subnet.** That is 4 minutes on a phone for two dotted addresses, a count and a mask. Latency is measured from "I've read it" (or Continue) to Submit, and includes the confidence tap.
5. **The SOC gate reuses the free-play `auth.log` unchanged**, as briefed. A fifth slot, "did any attempt from that address succeed?", was added after the r1 audit, because the lesson calls it the key question. The decoy successes come from 10.0.0.5.
6. **Phishing grew to 12 messages** after r1, including a hijacked internal account and a legitimate external supplier. Ten one-line lines could be sorted on either cue alone. The threshold is 11/12.
7. **The gate workspace is data-driven** (`gate.workspace: "soc-terminal"`), not keyed on the module id. The schema doesn't restrict extra gate keys, and the engine ignores it.
8. **Free-play terminal behaviour, with one difference.** The old tap-to-focus did `$('.term-input')`, which picked the first `.term-input` in the whole document. That was a disabled earlier line, or the Subnet trainer's input, so it did nothing after the first command. The instance now focuses its own enabled input. Everything else (output, checklist, commentary, clearing, `completeDrill`) is asserted unchanged.
9. **Test-count edits to earlier suites** (seam and loop counts derived from the manifest, Step A "caught up" means all modules) are consequences of a bigger corpus. No assertion was loosened.
10. **The local test environment** uses Playwright 1.63.0 installed `--no-save` to match the preinstalled Chromium. `package.json` and the lockfile were left alone.

## 7. Notes for the design chat (not acted on)

- **The `set_f1` + `min_correct` defect** in the two D1 drills (§6.1). This is the standing "silently-wrong metric" class.
- **Least-privilege gate is easy.** The hostile reviewer rated it GIVEAWAY at MED because the locked `ACL_SCENARIO` distractors are all blatantly powerful. Near-miss permissions would make a stronger gate.
- **IR steps 1 and 2.** The hostile reviewer still argued at MED that a responder might scope before isolating. All reviewers keyed it correctly. Watch it in dogfooding.
- **`keyword_density` matches whole words exactly**, so plurals don't count. The keyword sets were chosen against real expert answers, but authors of future FREE_RECALL drills should know this.

## 8. Ship record

- Version lockstep → **v1.8.0**: `APP_VERSION`, the header badge, the in-app CHANGELOG, `sw.js` CACHE `aegis-v1.8.0`, `package.json`, and the README badge (which was stale at 1.7.0). `npm run changelog` regenerated `CHANGELOG.md`.
- `npm test` green, `npm run test:faults` **71/71**, `npm run test:rollback` 24/24.
- **Commit `ceb89fb`** on `main`, pushed: "v1.8.0 — Phase 2: five pilot ARC modules across Domains 2–5, Range trainers as gates".
- **Deploy:** GitHub Actions "Deploy AEGIS to GitHub Pages", run `45741595276`, **completed · success** (19 s, 2026-11-26T02:19:04Z).
- This report lands in a follow-up docs-only commit.

**v1.8.0 is shipped.**
