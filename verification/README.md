# Verification

No build step — AEGIS is static files. These only test.

```bash
npm install          # playwright, dev-only
npm test             # all five suites
npm run test:content # modules: schema · ARC semantics V1-V13 · live scoring
npm run test:seam    # fetched modules + service worker, incl. offline
npm run test:loop    # the 5-phase loop, all six modules to MASTERED
npm run test:ui      # touch vs mouse, phone vs desktop, 300px → 1280px
```

`npm run serve` then open <http://localhost:8080>. Use a real server, not
`file://` — service workers and `fetch()` need an origin.

## What each suite is for

| suite | proves |
|---|---|
| `verify-version.mjs` | `APP_VERSION`, header badge, CHANGELOG head and `sw.js` CACHE all agree |
| `arc-module-probe.mjs` | every module is schema-valid, ARC-legal, **and actually scorable** |
| `verify-module-seam.mjs` | the corpus loads, degrades and survives offline |
| `verify-arc-loop.mjs` | the gate gates, consolidation can't be rushed, confidence precedes feedback |
| `verify-mobile-ui.mjs` | tooltips behave on touch and mouse; objective rows and the header fit every width from 300px to 1280px |
| `verify-rollback.mjs` | reverting to the previous release loses no learner data |

`verify-rollback.mjs` needs two checkouts. Make the old one a worktree first:

```bash
git worktree add /tmp/aegis-prev HEAD~1   # the previous release commit
npm run test:rollback
```

The third layer of the probe is the one that earns its keep: `validateSemantics`
proves a module is *legal*, never that its payload is shaped correctly for the
function that will consume it. A module can pass schema and V1–V13 and still
throw on the first learner submission.

## Content QA for new modules

`arc-item-audit.mjs` and `consensus-table.mjs` score item banks against
independent blind classifiers — necessary because bucket fairness cannot be
judged by the person who wrote the answer key. See `docs/MERGED-DEFECT-LIST.md`
for the method and `audit/` for every raw answer file from the Domain 1 rounds.

```bash
npm run blind        # emits an answer-key-free task file
# hand it to 2+ independent classifiers and 1 hostile reviewer that must ALSO answer
node verification/consensus-table.mjs --key key.json --coop D.json,E.json \
  --hostile F.json --overrides verification/item-overrides.json --modules modules
```
