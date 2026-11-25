# Item fixes — v1.7.1 (brief §2)

**Scope:** the four Domain 1 gate items flagged by the v1.7.0 hint audit (`HINT-AUDIT-v1.7.0.md`, "Observations"), plus any hint those changes made misleading.
**Result:** 2 items reworded, 2 items kept in place after checking them against the canons, 1 hint reworded (a single word). **2 rounds**, unanimous in round 2. Module `version` fields are unchanged because these are text-only edits. The `sw.js` cache bump makes clients refetch.

## Canon check (ISC2 Code of Ethics, current text)

Checked on 25 Nov 2026 against `isc2.org/ethics`. As the content rules allow, the canons are named and paraphrased here, never copied into the app. The page lists four mandatory canons and gives them no ranking. The "lower number wins" ordering is still only the exam-tested convention, as noted in v1.5.1.

| Item | Keyed | What the current Code says | Verdict |
|---|---|---|---|
| "You report a peer who is selling leaked ISC2 exam questions to candidates" | Canon IV | Canon IV is about advancing and protecting the profession. The Code also says that not reporting an observed breach through the complaint procedure can itself breach the Code under Canon IV, and it treats certification as a privilege that has to be earned and kept. | **Kept in IV.** The Code's wording doesn't move it. |
| "You tell a client up front that a specialised cloud engagement is beyond what you are qualified to deliver" | Canon III | Canon III's own text is about diligent and *competent* service to principals. | **Kept in III.** The Code's wording doesn't move it. |

Neither check would move an item, so the locked decision stood and there was nothing to escalate.

## Changes

| Module · site | Before | After |
|---|---|---|
| `authn-nonrep-privacy` gate, Non-repudiation | Keeping a tamper-evident audit log of who changed each record | **Requiring each engineer to approve change requests with a private key that only they hold** |
| `risk-lifecycle` gate, step 4 (`ORDER_SEQUENCE` `correct[3]`) | Apply the control and verify it actually works | **Implement the chosen treatment and verify it** |
| `risk-lifecycle` gate, hint 1 | Residual risk is whatever is left over from the **controls as they actually exist**, not as they were planned. … | Residual risk is whatever is left over from the **response as it actually exists**, not as it was planned. … |

The step-4 text appears in exactly one payload, the gate's `correct`. No drill, explanation or hint reuses it. `docs/D1-ITEM-BANKS.md` was updated to match. The lesson prose ("Apply it, then verify it actually works", about controls) is not step text, so it was left unchanged. See the note below.

## Method

The method is the same as `HINT-AUDIT-v1.7.0.md`. Each round used task files with no answer key (buckets and items in alphabetical order, ordering steps in alphabetical order, hints included). Each round had four **fresh** agents with no shared context, told not to open any other file:
**A** novice who has studied Domain 1 · **B** practitioner/CC instructor · **C** learning-design reviewer (checks word-matching and hint duplication) · **H** hostile. H must also answer, rates each item's worst defect HIGH/MED/LOW, and rates hint leakage.

**Keep rule:** every reviewer places every item as the key does. A, B and C rate each item under review `CLEAN`. H rates no item `HIGH`. No reviewer finds a hint `MISLEADS`. For a hint under review, A, B and C all say `CHANGES_APPROACH` and H rates its leakage below `HIGH`.

All three gates were reviewed in full (the authn, ethics and risk gates, 6 + 8 + 5 items, and all six of their hints). Raw files are in `verification/audit/items-v1.7.1/`.

## Trail

**Round 1.** All four reviewers answered every item to the key (19/19 each).
- The private-key item (worded "…sign their change requests…" at this stage) was CLEAN from A, B and C, and **MED** from H. H's reason: both Non-repudiation items were the only ones containing "sign", so the bucket could be won by matching that word. C also flagged it as close to the payment item. → reworded "sign" to "approve".
- Leaked exam questions: CLEAN from A, B and C, LOW from H.
- Competence disclosure: CLEAN from A, B and C (confidence 3), LOW from H.
- Step 4: CLEAN from A, B and C, MED from H ("accept" appears in both step 3 and step 5).
- **Risk hint 1: H rated it MISLEADS.** It said "controls" while the reworded step says "treatment". → changed "controls" to "response", the minimum edit, and put the hint under review.

**Round 2.** Fresh agents. All four answered every item to the key again (19/19 each).
- All four items were CLEAN from A, B and C. H rated the private-key item MED (still a key-based measure, like the payment item), the competence item MED ("up front" pulls toward Canon II), step 4 MED (an ISO-style "accept residual risk before implementing" reading), and leaked exam questions LOW. **No HIGH.**
- All six hints were OK from all four reviewers. Risk hint 1 rated **CCC/MED**.
- **Unanimous. Stopped.**

## Notes for the design chat (not acted on)

1. **Competence item.** All three cooperative reviewers placed it in III but at confidence 3 in both rounds. "Up front" pulls toward Canon II (honesty), and "qualified" shares a word with the bucket's "competent". The brief locked it as *keep*, so the text was not changed. A possible future rewording, from the reviewers: *"You decline a specialised cloud engagement because it is beyond what you are qualified to deliver."*
2. **Both Non-repudiation items are now key/signature-based.** The settings differ (a payment vs. a change approval), as the brief asked, but H rated the pair MED as conceptual near-duplicates. A non-cryptographic second item would give more spread, but a log-based one is exactly what was flagged in v1.7.0.
3. **Lesson prose for `d1_4`** still says "Apply it, then verify it actually works" in the paragraph about controls. That is accurate where it sits, but a learner could look for that phrase in the gate and not find it. Consider aligning it with the step wording when `d1_4`'s threshold question is settled.
4. **"Accept" appears in both step 3 and step 5** of the risk gate. H noted that this could tempt someone to put formal acceptance before implementation. The perfect-order threshold (open item 1) amplifies the cost of that confusion.
