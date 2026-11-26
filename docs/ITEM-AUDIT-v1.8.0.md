# Item and hint audit for v1.8.0 (Phase 2)

**Scope:** every gate and drill item bank in the five Phase 2 modules (15 scored banks), the five FREE_RECALL keyword sets, and all ten gate hints.
**Result:** unanimous. Round 2 converged for least privilege, subnetting and security awareness. Round 4 converged for incident response and logging. Across all four rounds every reviewer answered every scored item to the key. Every change was driven by flags, a HIGH, or a hint or keyword verdict.
**Raw files:** `verification/audit/items-v1.8.0/`. That folder holds, per round, `rN-task.json` (answer key stripped), `rN-key.json`, `rN-ans-{A,B,C,H}.json`, `rN-score.txt`, and the reviewer brief.
**Tool:** `verification/phase2-audit.mjs` (`task` builds the blind file and `score` applies the rule mechanically).

## Method

The method is the same as `docs/MERGED-DEFECT-LIST.md` and `docs/HINT-AUDIT-v1.7.0.md`. Item banks and hints were audited together.

- **Blind task, no key.** Bucket items are listed alphabetically without their bucket. Ordering steps are listed alphabetically and lettered. Set options are lettered. Cloze blanks carry only their labels. The SOC gate's workspace file (`/var/log/auth.log`) is read out of `index.html`, so reviewers see exactly what a learner sees.
- **Four reviewers per round, all fresh agents, with no shared context.** Each was told to read only the brief and the task file.
  - **A** is a novice who has just read the lesson.
  - **B** is a practitioner who answers cold, then checks the lesson for factual errors.
  - **C** is an instructor writing the key, who also reviews the learning design: hint duplication, echoes of answer wording, and whether the lesson teaches each item.
  - **H** is hostile and must commit to an answer for every item. H rates item severity (HIGH means block shipping) and hint leakage, and fact-checks the lessons (NIST SP 800-61 r2/r3, SIEM, subnet maths, SP 800-63B, ATT&CK IDs).
- **Decision rules:**
  - **Items:** pass only if all four answer to the key and H's severity is not HIGH.
  - **Hints:** pass only if A, B and C all say `CHANGES_APPROACH` and H's leak is not HIGH.
  - **FREE_RECALL:** each reviewer writes a 60–120-word model answer. The module's own `keyword_density` metric must pass it at `min_correct`, which proves an expert actually hits the keyword set.
  - Cooperative flags (AMBIGUOUS, GIVEAWAY, FACTUAL, UNCLEAR) are acted on when two or more reviewers share them or when they are factual.
- **Carried-forward note from v1.7.0.** The hostile reviewer is inconsistent on five-step orderings, and hints that echo step wording draw HIGH ratings. The IR steps were written so each is self-evidently distinct, and every IR hint was checked for echoes.

## Round trail

| round | modules | outcome | what changed after it |
|---|---|---|---|
| r1 | all 5 | All 15 banks answered to the key by all four reviewers. Fails: logging FREE_RECALL keywords (3–4/8), subnet hints 0 and 1 (restated the lesson), logging hint 1 (RRR). | **IR:** step 2 mixed scoping (Detection & analysis) with containment, which all four flagged as AMBIGUOUS, so it was reworded as pure containment. Hint 1 was rewritten because it pointed at "leave it powered on" (MED ×4). The cloze blank "feeds back into ___" was tightened. **Least privilege:** the payroll-report item was ambiguous for all four, so the job now includes the report. Hint 1 (MISLEADS for H) was rewritten. **Subnet:** "with no hint" read as contradictory, so the prompt now states the skill-gate rule. Both hints were rewritten as new methods (binary, host bits). The lesson now explains why network and broadcast are reserved, and "ran out" became "was running out" (H). **Awareness:** the gate could be sorted on the request column alone (B and H GIVEAWAY). It now has 12 messages, adding a hijacked internal account (on-domain, phishing) and a real travel supplier (off-domain, legitimate). The lesson teaches reading the domain from the right and says a familiar sender is not proof. Hint 1 was rewritten. **Logging:** a fifth slot ("did any attempt from that address succeed?") was added, since the lesson calls it the key question. The FREE_RECALL keywords were replaced: the metric is word-boundary exact, so plurals such as "alerts" never matched "alert". Hint 1 was rewritten. |
| r2 | all 5 | **Unanimous for least privilege, subnetting and security awareness.** IR gate rated **HIGH** by H: the two containment steps had no dependency, so either order was defensible. IR hint 1 CRC. Logging hint 1 CMC (B: a gist read could suggest "yes" on the success slot). | **IR:** step 2 now depends on step 1 (it uses the running workstation's connection records). The prompt no longer names the shared drive. Hint 1 was rewritten to ask what each step needs to still be available. The cloze now blanks Preparation itself instead of printing it (A and H GIVEAWAY). **Logging:** hint 1 was rewritten. The cloze now accepts "correlate", "sequence" and "chronological order" (B and H). |
| r3 | IR, logging | All items answered to the key, no HIGH. Logging FREE_RECALL failed only because H omitted that item (0/8, a reviewer omission; A, B and C scored 7/8). | **IR:** step 2 now reads "connection records still in … memory", since after isolation the connections are no longer live (H). The lesson's post-incident line now names time-to-detect and time-to-contain, which IR classify #7 relies on (H). **Logging:** classify #3 dropped "all with the same password", because failed-logon logs do not record the password tried (H FACTUAL). Reviewers were now told every item id must appear. |
| r4 | IR, logging | **Unanimous.** All 8 banks to the key, no HIGH, FREE_RECALL 6–8/8, hints CCC/LOW ×3 and CCC/MED ×1. | none |

Least privilege, subnetting and security awareness were not edited after round 2. That is why rounds 3 and 4 covered only the two modules that changed.

## Final hints, with their last verdicts

| module | hint | last verdict |
|---|---|---|
| incident response | For each step, ask whether it could be undone if the attacker were still active when you did it. Anything that could be undone has to wait for the work that stops them. | r4 CCC/LOW (kept from r1) |
| | Some steps rely on information that only exists while an earlier step's conditions still hold. For each step, ask what must already be true, or still be available, before it can work. | r4 CCC/MED (rewritten twice) |
| least privilege | Read each permission as if the account had already been stolen. Ask what the thief could do with it, then whether the job described actually needs that ability. | r2 CCC/LOW (kept from r1) |
| | Some rights would let a person sign off their own work or erase the record of what they did. For each option, ask whether someone checking this analyst afterwards could still trust what they see if the analyst held it. | r2 CCC/MED (rewritten once) |
| subnetting | Try it in binary instead: write just the last octet of the address as eight bits and draw a line after the bits that belong to the network. Keep the left side, then set everything right of the line to all 0s and then to all 1s. | r2 CCC/LOW (rewritten once) |
| | If the mask arithmetic keeps slipping, start from the host bits instead: 2 raised to that number is both the size of each block and the count of addresses in it, before the two you cannot use. | r2 CCC/LOW (rewritten once) |
| security awareness | Read the sender address character by character, all the way to the end. Ask which organisation actually controls that address, whatever name it claims. | r2 CCC/LOW (kept from r1) |
| | A real account can be taken over, so a correct-looking address does not settle it. Judge the request on its own as well: would it normally arrive like this, from this person, without the usual checks? | r2 CCC/MED (rewritten once) |
| logging | Before you count anything, filter the log down to the lines that describe the suspicious activity, so you are not mixing it with normal sign-ins. | r4 CCC/LOW (kept from r1) |
| | Treat the last question separately from the counts: look for any line from that same source that records a different kind of event from the ones you counted. | r4 CCC/LOW (rewritten twice) |

## Watch-list for dogfooding (MED, not blocking)

1. **IR gate, steps 1 and 2.** In r3 and r4 H still argued at MED that a responder might scope before isolating. Every reviewer in every round placed step 1 first. If a learner who has read the lesson gets this pair wrong, revisit the wording.
2. **Least-privilege gate.** H rated it GIVEAWAY at MED: all five distractors are obviously powerful rights. The bank is the locked Least-Privilege Workshop scenario (`ACL_SCENARIO`) and was not altered. Near-miss options would make this a stronger gate, which is a design-chat question.
3. **Security-awareness gate.** In r2 H still found that the request column decides every line. The added items make the address and the request each necessary somewhere, but no line has a benign-looking request from a lookalike domain. That line would be hard to key without ambiguity.
4. **Subnet and SOC prompts versus the UI rule note.** The subnet prompt states the skill-gate rule, and the app also renders it as a note. The two say the same thing twice.
