# Domain 1 item audit — merged defect list & consensus result

**Method.** Item banks with the answer key stripped, handed to independent agents that
never see it: two cooperative classifiers (one "practitioner answering cold", one
"instructor writing the official key") plus a hostile reviewer **required to commit to
answers**. Seven rounds. Decision rule applied mechanically by `arc-item-audit.mjs` /
`consensus-table.mjs`.

## Headline

**62/62 four-way unanimous — every round.** Zero SPLIT. Zero CONSENSUS-AGAINST-KEY.
Not one item, in seven rounds, where two independent experts assigned different buckets.

The discriminating clause never fired, which is the finding. Every other signal is a
*self-reported hesitation*, and cooperative flag volume varied ~3x between two equally
competent classifiers (round 3: D 14, E 5), so a single-agent flag measures the agent as
much as the item. Only the intersection is robust.

Forcing the hostile agent to answer paid off immediately: its round-3 HIGH was
**self-refuting** — it rated an item HIGH for being Canon II, then answered Canon IV,
matching the key. That check is now built into the tool.

## What changed, and why

| # | item / bank | signal | verdict |
|---|---|---|---|
| 1 | Ransomware encrypts the file server | COOP x2, hostile MED | **KEEP — verified override** |
| 2 | Offline immutable backups | COOP x2 | **KEEP — verified override** |
| 3 | Separation of duties on payment approvals | COOP x2 | **KEEP — verified override** |
| 4 | Decline to exaggerate a threat in a sales pitch | COOP x2 | **KEEP — verified override** |
| 5 | Client pressures you to overstate the audit report | 3 reviewers converged; every hint misfired | **CUT → moved to analog step** |
| 6 | "…decline **and** report it" / "…report **instead of** a conference talk" | compound stems | **REWROTE** |
| 7 | "…so the field improves" (Canon IV) | give-away | **REWROTE** |
| 8 | auth-factor drill (whole bank) | hostile "trivial" x3 | **REWROTE** — scenario-shaped, TPM discriminator |
| 9 | "A memorised PIN" | give-away x2 | **CUT** |
| 10 | "Your date of birth, used as a verification question" | ambiguous x2 | **CUT — reverted my own fix** |
| 11 | duplicated "background checks" across gate and drill | hostile MED | **REPLACED** |
| 12 | duplicated Policy items in governance | hostile MED | **REPLACED** |
| 13 | CIA availability stem said "intact **and** reachable" | compound | **REWROTE** — threat-neutral |
| 14 | all six gate hint pairs | misleading-hint x4 | **REWROTE** — strategy-only |

### Overrides are auditable, not assertions

An override keeps a flagged item only if it quotes the sentence in that module's own
`reading_markdown` that decides the case, **and the tool verifies the quote is really
there**. Injecting a fabricated quote flips the item straight back to DEFECTIVE.
The principle: *a defensible second answer is a taught distinction, not a coin flip, when
the learner was told which way it goes.* Four survive; the audit-report item did not,
and its override was retired with it.

**Those four are the dogfood watch-list.** If a learner who read the module still gets one
wrong, the item is wrong and the override was a mistake.

## Three findings worth keeping

**1. The give-away/ambiguity tension is real and bit me.** I replaced a give-away ("a
memorised PIN" — *memorised* ≈ *know*) with a harder item (date of birth as a verification
question); both agents then flagged the replacement as ambiguous, since DOB feels inherent.
Fixing one failure mode created the other. Reverted, and added a discriminator doctrine
resolves cleanly instead — a private key in a TPM chip is *something you have*, because the
chip cannot export it.

**2. My instrument had a blind spot.** The `--blind` emitter never included CLASSIFY gate
**prompts**, so every agent had been classifying without the instruction the learner
actually sees. The probe was harder than reality, and any prompt-level disambiguation was
invisible to it. After the fix, cooperative flags fell 15→8→4 and 13→5→1: much of what
looked like item ambiguity was missing-prompt artifact. *A harness that is stricter than
reality manufactures defects.*

**3. Consensus is not correctness — and the primary source proved it.** Per the caution
about correlated agreement, I stopped trusting the agents on doctrine and checked ISC2
directly. **ISC2's published Code does not state the canons are in priority order.** All
three agents and I had confidently used "lower number wins" because it is ubiquitous in
CC/CISSP training material. It is the resolution method ISC2 expects and the exam tests,
but not a line you can quote from the Code. The module reading now says exactly that.

That check also surfaced a **shipped bug in AEGIS v1.5.0**: the Ethics tab lead read *"when
two conflict, the higher number wins"*, contradicting both the lesson and the Ethics
Tribunal — and contradicting its own next sentence, "Society before self". Fixed in
`index.html`, ships with v1.6.0.

## Final thresholds — re-derived, not carried over

One gate item was cut and replaced 1:1, so every `item_count` is unchanged and no threshold
needed re-deriving. Confirmed by re-running the probe after every edit.

| objective | gate | threshold | rule |
|---|---|---|---|
| d1_0 | CLASSIFY | 5/6 (83%) | n−1 |
| d1_1 | CLASSIFY | 5/6 (83%) | n−1 |
| d1_2 | CLASSIFY | 5/6 (83%) | n−1 |
| d1_3 | CLASSIFY | 7/8 (88%) | n−1 |
| d1_4 | ORDER_SEQUENCE | 10/10 (100%) | perfect order — documented exception |
| d1_5 | CLASSIFY | 7/8 (88%) | n−1 |

Drills: sorting/selection/ordering at n−1; `FREE_RECALL` at n−2. Unanimity per bank is
uniform — 6/6, 8/8, 6/6, 8/8, 6/6, 8/8 — so no bank is carrying a disproportionate
ambiguity load. Ethics was the predicted hazard and needed the most work (one cut, three
rewrites), but it lands at the same unanimity as the rest.

## Verification status — read this before shipping

| artifact | state |
|---|---|
| items, prompts, thresholds | **verified** — 62/62 unanimous, rounds 6 and 7 |
| `arc-module-probe` (211 checks) | **verified** — green after every edit |
| gate **hints** (strategy-only rewrite) | **partially verified** — both cooperative agents re-answered 62/62 unanimous in round 7; the round-7 **hostile** run was lost to a session limit |

The hint rewrite does not touch items, prompts, keys or thresholds — verified byte-identical
between rounds 6 and 7 — so the item-level result applies verbatim to what ships. The open
question is only whether the new hints are *useful* (the previous hostile critique was that
item-level hints mis-generalise; the risk of the fix is hints so generic they help nobody).
Re-run when convenient:

```bash
node arc-module-probe.mjs modules --blind /tmp/task.json
# hand /tmp/task.json to a hostile reviewer that must also answer
node consensus-table.mjs --key key.json --coop D.json,E.json --hostile F.json \
     --overrides item-overrides.json --modules modules --md CONSENSUS-TABLE.md
```

## Reusable harness — keep all of it

- `arc-module-probe.mjs` — schema · semantics · live scoring, `--blind` emitter, corpus flags.
- `arc-item-audit.mjs` — decision rule, override verification, self-refuting-critic check.
- `consensus-table.mjs` — agreement classes, hostile weighted as tiebreaker not peer.
- `item-overrides.json` — audit trail for every kept-despite-flag item.
- `audit/` — every answer file from every round, plus the key-free task files.

This is the `blind-scoring.json` equivalent for content. Domains 2–5 have more two-home
hazards than Domain 1 — access-control models and control taxonomies especially — and for
Domain 6 (AI security) there is no settled doctrine and **no ISC2 answer key to check
against at all**, which makes cross-agent disagreement the only available oracle.
