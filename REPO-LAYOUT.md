# What goes in the repo

AEGIS is a static PWA. There is **no build step** — the repo *is* the site, and
`.github/workflows/deploy.yml` already uploads `path: '.'`, so new files at the
root are picked up with no workflow change.

## Drop these in at the ROOT

Not in a subfolder. Every path in the app is relative (`./modules/index.json`,
`./arc-core.mjs`, `sw.js`), and the service worker's scope is the directory it
is served from. Nesting them under `app/` would change the site URL and break
the existing install for anyone who already added AEGIS to their home screen.

```
your-repo/
├─ index.html        ← REPLACE (v1.6.0)
├─ sw.js             ← REPLACE (cache name aegis-v1.6.0)
├─ arc-core.mjs      ← NEW · the ARC v4.3.0 engine, unmodified
├─ modules/          ← NEW
│  ├─ index.json                                  (the manifest the app fetches)
│  ├─ d1-00-cia-triad.arc-module.json
│  ├─ d1-01-authn-nonrep-privacy.arc-module.json
│  ├─ d1-02-control-types.arc-module.json
│  ├─ d1-03-code-of-ethics.arc-module.json
│  ├─ d1-04-risk-lifecycle.arc-module.json
│  └─ d1-05-governance.arc-module.json
├─ package.json      ← NEW · dev-only, for running the tests
├─ verification/     ← NEW · optional, see below
└─ docs/             ← NEW · optional
```

## Keep exactly as they are

`manifest.webmanifest` · `outline-versions.json` · `icons/` · `LICENSE` ·
`.gitignore` · `.github/workflows/deploy.yml`

`index.html` still references the manifest, the icons and
`outline-versions.json` by the same paths. Do **not** copy a
`manifest.webmanifest` from any package I sent — yours is the real one.

## Update by hand

**`CHANGELOG.md`** — add the v1.5.1 and v1.6.0 entries. The in-app changelog
(inside `index.html`) already has them; the repo file is the mirror.

**`README.md`** — worth a line that Domain 1 can run in ARC mode, and that
`modules/*.json` is where content lives now.

## Optional: `verification/` and `docs/`

Committing them is worth it — they are how you re-verify after any content
change, and they make Domains 2–5 tractable. Both are inert at runtime: the app
never fetches them.

```bash
npm install     # playwright, dev-only
npm test        # 332 checks across four suites
```

Two things to know if you commit them:

1. **`verification/audit/` contains the gate answer keys.** They are already
   public — an offline-first app *must* ship its answer key so it can score
   without a server, so `modules/*.json` contains every correct answer anyway.
   Publishing the audit files exposes nothing new. Worth understanding rather
   than being surprised by: AEGIS's gates are honour-based against anyone
   willing to read the source. That is the right trade for self-study, and it
   is the reason the certificate is a completion record and not a credential.
2. **Everything in the repo is published by Pages**, including these folders.
   Harmless — about 300 KB — but if you would rather they were not served, move
   them to a `dev` branch or add them to a `.gitignore`d path instead.

## Verify before you push

```bash
npm test                 # all four suites green
npm run serve            # then load http://localhost:8080
```

Check by hand once: the beta toggle lives under **Progress**, defaults to off,
and with it off the app behaves exactly as v1.5.1 did.

## Deploying

Push to `main`. The existing workflow does the rest. After it lands, hard-refresh
once — the cache name changed to `aegis-v1.6.0`, so the old cache is evicted on
activate and the What's New panel fires by itself.
