# Domain 1 — consensus table

62 items · key + 2 independent cooperative answerers + 1 hostile answerer, none of whom saw the key.

**Agreement classes.** UNANIMOUS 62 · 3-OF-4 0 · SPLIT 0 · SPLIT+HIGH 0 · COOP-CONSENSUS-vs-KEY 0

The hostile answer is a tiebreaker, not a peer: it cannot create a SPLIT alone (those rows are marked *hostile only*). Its findings carry full weight.

## Every non-unanimous row

| item | bank | key | v7-D | v7-E | F | agreement | hostile | verdict |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | *no non-unanimous rows* | — | — |

## Unanimity per bank

| bank | unanimous | pass_threshold | % |
|---|---|---|---|
| cia-triad/GATE | 6/6 | 5/6 | 83% |
| control-types/constructset | 8/8 | 3/4 | 75% |
| code-of-ethics/GATE | 8/8 | 7/8 | 88% |
| governance/GATE | 8/8 | 7/8 | 88% |
| cia-triad/constructset | 8/8 | 3/4 | 75% |
| authn-nonrep-privacy/GATE | 6/6 | 5/6 | 83% |
| authn-nonrep-privacy/classify | 6/6 | 5/6 | 83% |
| control-types/GATE | 6/6 | 5/6 | 83% |
| risk-lifecycle/classify | 6/6 | 5/6 | 83% |

## Advisory — unanimous but flagged

| item | bank | flags | override |
|---|---|---|---|
| Ransomware encrypts the file server | cia-triad/GATE | v7-D, v7-E | ✓ verified |
| Separation of duties on payment approvals | control-types/constructset | v7-D, v7-E | ✓ verified |
| You decline to exaggerate a threat in a sales pitch to frigh… | code-of-ethics/GATE | v7-D, v7-E | ✓ verified |
| Every system must have a named owner who is accountable for … | governance/GATE | v7-D, v7-E | — |
| Offline immutable backups | cia-triad/constructset | v7-E | ✓ verified |
| You refuse to scan a network you have no written authorisati… | code-of-ethics/GATE | v7-D | — |
| You tell a client up front that a specialised cloud engageme… | code-of-ethics/GATE | v7-E | — |
| You turn down a second client whose work would create a conf… | code-of-ethics/GATE | v7-D | — |
| You report a peer who is selling leaked ISC2 exam questions … | code-of-ethics/GATE | v7-E | — |
