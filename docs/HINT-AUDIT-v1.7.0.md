# Hint audit — v1.7.0 (Step A §8)

**Scope:** every `gate.hints[]` in the six Domain 1 modules — 12 hints. Drills carry no hints.
**Mechanism unchanged:** a revealed hint still lowers `q` (`hints_used` → `computeQ`). Text only.
**Result:** 1 hint kept, 11 rewritten (one of those, `control-types` #0, passed round 1 and then split in round 2). None deleted; every gate still ships two. 9 rounds. All three probe layers pass (211/211).

## Method

- **Task files without an answer key**: prompt, bucket names (or the steps to order, listed alphabetically), the items, and the hints. They are in `verification/audit/hints-v1.7.0/roundN-task.json`. From round 3 on, `hints_under_review` marks which hints are being judged; approved hints stay in the file as context so duplication can be judged.
- **Four reviewers per round, fresh agents every round, no shared context**:
  - **A** is a novice who has read the lesson.
  - **B** answers each question without hints first, then checks whether each hint helps on the items they hesitated over.
  - **C** is a learning-design reviewer who also judges duplication between a module's two hints.
  - **H** is hostile. H rates leakage: **HIGH** means someone who doesn't understand the concept could place an item from the hint alone, **MED** means it narrows specific items, **LOW** means it teaches a method only. H also flags factual problems.

  Reviewers were told not to open any other file.
- **Keep rule (brief §8)**: a hint is kept only if A, B and C all say `CHANGES_APPROACH` and H does not rate it `HIGH`. Any `RESTATES` or `MISLEADS`, or a HIGH from H, means the hint is cut and rewritten toward the *method*, never the answer. Rewrites are re-reviewed the same way. A factual flag from H was also treated as a reason to reword, even when the leak rating was acceptable.
- **Calibration note.** From round 2, H's instructions said that stating the concept's *defining distinction* is not HIGH merely because applying it yields the answer. HIGH is for shortcuts that work without understanding. For the ordering question, pinning a step the learner would place correctly anyway is not HIGH. The rule was added after round 1's H marked several method-only hints as leaks. It narrows what HIGH means. It does not lower the bar for what counts as a shortcut.

Notation: `ABC/H`. C = changes approach, R = restates, M = misleads. H = leak rating.

## Hints — before → after, with the round trail

### `cia-triad`

**Hint 0 — KEPT.** Trail: r1 CCC/MED · r2 CCC/MED — kept (original text)

- text: **Name the property the attacker destroyed, not the technology they used. The same technology shows up as a control on one side and a weapon on the other.**

**Hint 1 — REWRITTEN.** Trail: r1 MMM/MED (two tests, no tie-break) → rewritten · r2 CCC/LOW

- before: _If two legs seem to fit, ask which loss the victim notices first, and which one they could still be suffering without knowing._
- after: **Ask what the attacker needed to happen for the attack to succeed: someone sees the data, the data changes, or its owner can't use it. Classify by that goal, even if other damage follows along the way.**

### `authn-nonrep-privacy`

**Hint 0 — REWRITTEN.** Trail: r1 RCC/**HIGH** (glosses paraphrased the items) → rewritten · r2 CCC/MED

- before: _Ask what each measure exists *for*: establishing who someone is, making an action undeniable afterwards, or holding less data in the first place._
- after: **Two of these properties involve identity, so check which job the measure does: verifying a person before they are allowed to act, or leaving evidence of an action that someone else could check later.**

**Hint 1 — REWRITTEN.** Trail: r1 RRR/LOW → rewritten · r2 CCC/MED

- before: _Several of these produce a side effect that belongs to a different bucket. Sort by the reason the measure was put there, not by everything it happens to help with._
- after: **Ask whose interest the measure serves first: the organisation's need to know who is acting and what they did, or the individual's control over information about themselves.**

### `control-types`

**Hint 0 — REWRITTEN.** Trail: r1 CCC/LOW · r2 RRC/LOW (split: "just the bucket definitions") → rewritten · r3 CCC/LOW (hostile: "a person's judgement" would misfile guards) → reworded · r4 CCC/LOW (hostile: "rule" collides with "firewall rule") → reworded · r5 CCC/LOW

- before: _Ask what actually does the enforcing: a machine, a rule that people follow, or a barrier in the physical world._
- after: **Ask what an attacker would have to defeat to get past it: logic running in software or hardware, a policy or process the organisation imposes on people, or a physical obstacle.**

**Hint 1 — REWRITTEN.** Trail: r1 RRR/LOW → rewritten · r2 CCC/MED (hostile: "paperwork or not" targets one item; test unreliable) → rewritten · r3 CCC/LOW

- before: _A control can be preventive or detective and still be any of the three types. Type and function are separate questions — answer the one being asked._
- after: **A control's type doesn't follow from what it protects. Something guarding a computer may be enforced by people, and something guarding a building may be enforced by software. Classify by the enforcer, never by the asset.**

### `code-of-ethics`

**Hint 0 — REWRITTEN.** Trail: r1 MMR/MED ("who is protected" misroutes Canon II) → rewritten · r2 CCC/MED

- before: _Ask who is primarily being protected: the public, your own integrity, the client who hired you, or the profession itself._
- after: **Test the duty, not the people who benefit: would you owe this even if nobody had hired you? If not, it is about your principals. If you would, decide whether it is about harm reaching the public, your own conduct, or the field as a whole.**

**Hint 1 — REWRITTEN.** Trail: r1 RRR/LOW → rewritten · r2 CCC/MED (hostile: "honesty won't separate the canons" contradicts Canon II) → rewritten · r3 MCM/MED ("flip it" sends the competence item to II) → rewritten · r4 CCC/MED

- before: _More than one canon can be true of the same act. Ask which one the situation is fundamentally *about*, not which others it also touches._
- after: **Honesty is Canon II's subject when your own honesty or lawfulness is the whole point. If the honest act is really part of serving the people who hired you, or of looking after the profession, the situation is about that relationship instead.**

### `risk-lifecycle`

**Hint 0 — REWRITTEN.** Trail: r1 RRR/LOW → rewritten · r2 CRC/LOW (generic) → rewritten · r3 CCC/**HIGH** (echoed "likelihood/impact", "vulnerability") → rewritten · r4 CCC/LOW

- before: _You cannot rank a risk before you have judged how likely it is and what it would cost._
- after: **Raising a concern is not the same as understanding it. Ask what you would need to write down about this server before you could compare it with anything else on your list.**

**Hint 1 — REWRITTEN.** Trail: r1 CMC/**HIGH** → r2 CCC/**HIGH** → r3 CCC/**HIGH** → r4 RCC/LOW (circular) → r5 MCC/MED → r6 CCC/**HIGH** → r7 CCC/MED (hostile: "nothing left to find out" overstated) → r8 CCC/**HIGH** → r9 CCC/MED. Every HIGH came from echoing the step wording (choose/apply/verify/accept).

- before: _Choosing a treatment is not the last step — something always remains afterwards, and it needs a named owner._
- after: **Residual risk is whatever is left over from the controls as they actually exist, not as they were planned. Work out which steps have to be finished before anyone can honestly describe that.**

### `governance`

**Hint 0 — REWRITTEN.** Trail: r1 CCM/MED ("policy = intention" pushes the named-owner item to Standard) → rewritten · r2 CCC/MED

- before: _Work down in order: is it imposed on you from outside, is it optional, and does it state an intention, a specific requirement, or a sequence of actions?_
- after: **Ask two separate questions of each item: is it binding or only advised, and how much does it specify — a goal or responsibility with no 'how', a named technology or setting, or a series of actions? Then check whether it comes from inside the organisation at all.**

**Hint 1 — REWRITTEN.** Trail: r1 RCC/MED → rewritten · r2 CCR/MED (duplicates hint 0) → rewritten · r3 MMM ("chain" has no place for guidelines) → r4 MMM ("survives a tech refresh" sends standards to Policy) → r5 MMM (three audiences for five buckets) → r6 CCC/MED (hostile: omits that procedures bind) → reworded · r7 CCC/MED

- before: _Force and specificity are two separate axes. Something can be mandatory and vague, or detailed and optional — the pair of answers picks the layer._
- after: **'Must' doesn't settle the layer — policies, standards and procedures all bind, and so does the law. For a binding internal statement that isn't a list of steps, ask how an auditor would check it: by inspecting a system's settings, or only by looking at how the organisation is run.**

## Final standing

All 12 hints: unanimous `CHANGES_APPROACH` from A, B and C in their last round, and no HIGH from H. H rated 4 hints LOW and 8 MED.

| module | #0 | #1 |
|---|---|---|
| cia-triad | CCC/MED (kept) | CCC/LOW |
| authn-nonrep-privacy | CCC/MED | CCC/MED |
| control-types | CCC/LOW | CCC/LOW |
| code-of-ethics | CCC/MED | CCC/MED |
| risk-lifecycle | CCC/LOW | CCC/MED |
| governance | CCC/MED | CCC/MED |

## Observations for the design chat (not acted on — out of Step A scope)

These concern items, not hints. The brief limits §8 to hint text, so the item banks were not touched.

1. **`authn-nonrep-privacy`: "Keeping a tamper-evident audit log of who changed each record"** is keyed Non-repudiation. H flagged it twice (r1 and r2): a log gives accountability, and a log alone isn't a cryptographic binding to one person. It is defensible at CC level, but it is the weakest Non-repudiation item.
2. **`code-of-ethics`: "You report a peer who is selling leaked ISC2 exam questions"** is keyed Canon IV, matching the lesson ("exam cheating is the standard example"). H noted it could be argued as Canon II.
3. **`code-of-ethics`: the competence-disclosure item** is keyed Canon III, matching the lesson. H noted that older ISC2 guidance put "within your competence" under Canon II. Worth checking against the current Code if this item is ever revisited.
4. **`risk-lifecycle`: the fixed order assumes the treatment is mitigation.** H suggested "Implement the chosen treatment and verify it", which would also cover transfer and avoid. Relevant to the still-open `d1_4` threshold question.
5. **Variance in the hostile reviewer.** The same residual-risk idea was rated HIGH in r3, r6 and r8 and MED in r5, r7 and r9, depending on wording. The HIGHs always came from echoing the step text. Ordering tasks with five steps leave very little room for a hint that helps without pinning a position. That is worth knowing before Phase 2's IR-Sim reorder gate gets hints.
