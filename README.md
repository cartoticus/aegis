# AEGIS — ISC2-Aligned Cybersecurity Learning System

![AEGIS](docs/screenshot.png)

![Version](https://img.shields.io/badge/version-1.7.0-E8B04B)
![PWA](https://img.shields.io/badge/PWA-installable-E8B04B)
![Works offline](https://img.shields.io/badge/works-offline-4FD7C9)
![No build](https://img.shields.io/badge/build-none-5BD6A0)
![Runtime dependencies](https://img.shields.io/badge/runtime%20deps-0-5BD6A0)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

A free, self-contained cybersecurity range for **ISC2 Certified in Cybersecurity (CC)** and
**CompTIA Security+** prep. AEGIS turns the five CC domains into a guided
**learn → drill → prove** loop, and — in its ARC learning mode — replaces "mark complete"
with mastery you actually have to demonstrate.

It's an installable **Progressive Web App**: add it to your phone's home screen and it runs
full-screen and **offline**. No build step, no runtime dependencies, no accounts. Progress
saves on the device.

**Live:** <https://cartoticus.github.io/aegis/>

---

## Features

- **In-app lessons** — plain-language explanations with diagrams and worked examples.
- **ARC learning mode (beta, Domain 1)** — switch it on under **Progress**. Each objective runs
  a five-phase loop: a question before you read, the reading, a **gate you have to pass**, a
  paper exercise away from the screen, then spaced retrieval scheduled by **FSRS-6**. You record
  your confidence *before* seeing the answer, and there's a 24-hour wait before the first review.
  Content lives in `modules/*.json`; the engine is `arc-core.mjs`.
- **FSRS-6 review queue** — Again / Hard / Good / Easy grading; a miss genuinely brings a card
  back sooner. Mastering a glossary term files a card automatically.
- **7 hands-on trainers** — SOC terminal, subnet/CIDR, incident-response simulator,
  least-privilege workshop, phishing triage, ethics tribunal, and a mixed exam bank.
- **Per-domain quizzes** with a real **80% pass gate**.
- **Code of Ethics gate** — offensive trainers unlock only after you accept the four canons.
- **Glossary** — ~95 terms and acronyms, auto-highlighted in lessons (hover on desktop, tap on touch).
- **Certification map + outline currency check** — flags when a newer exam outline is listed.
- **Phone-first** — tested from 300px to 1280px, touch and mouse.

## The trainers

| Trainer | Domain | What you do |
|---|---|---|
| SOC Terminal | 5 · Security Ops | Simulated Linux shell — hunt a brute-force attack in the auth log, verify file integrity |
| Subnet & CIDR Trainer | 4 · Networking | Network/broadcast addresses, host counts and masks with real IPv4 math |
| Incident Response Sim | 2 · BC/DR/IR | Branching ransomware scenario scored on making the right calls in order |
| Least-Privilege Workshop | 3 · Access Controls | Provision a new analyst with exactly the access they need |
| Phishing Triage | 5 · Awareness | Flag phishing vs. legitimate mail and name the red flags |
| Ethics Tribunal | 1 · Ethics | Decide which canon governs each gray-area dilemma |
| CC Exam Bank | All | 12-question mixed exam across every domain |

## Install on your phone

1. Open <https://cartoticus.github.io/aegis/> in **Chrome** (Android) or **Safari** (iPhone/iPad).
2. Chrome: tap **Install AEGIS** (bottom-right) or ⋮ → **Install app**. Safari: **Share → Add to Home Screen**.
3. After the first load it works offline.

## Deploy

Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml` (about 20
seconds). The repo *is* the site — there is no build step. **A release isn't shipped until it's
on `main` and the Pages run is green.**

## Releasing a version

Bump these together — `npm test` fails if they disagree:

- `APP_VERSION` and the header badge in `index.html`
- the top entry of the in-app `CHANGELOG` in `index.html` (this drives **What's New**)
- `CACHE` in `sw.js` (e.g. `aegis-v1.7.0`) — this is what makes installed apps refresh
- `version` in `package.json`

Then regenerate the repo changelog with `npm run changelog`.

## Run locally

Service workers and `fetch()` need an origin, so `file://` won't run ARC mode. Serve it:

```bash
npm run serve        # python3 -m http.server 8080
```

## Testing

```bash
npm install          # dev-only: Playwright
npm test             # version lockstep, FSRS oracle, modules, seam, 5-phase loop, interface
npm run test:faults  # revert each fix in turn and require a test to notice
```

See [`verification/README.md`](verification/README.md) for what each suite proves. The rule
the suite is built on: **an assertion only counts if it fails when the thing it names is gone.**

## Repository layout

```
aegis/
├─ index.html               ← the app (inline CSS + vanilla JS)
├─ sw.js                    ← service worker (network-first shell, cached modules)
├─ arc-core.mjs             ← ARC v4.3.0 engine, unmodified
├─ modules/                 ← ARC content: index.json + one *.arc-module.json per objective
├─ manifest.webmanifest     ← PWA metadata
├─ outline-versions.json    ← maintained list of current exam outlines (see below)
├─ icons/
├─ verification/            ← test suites, fault injection, content-QA tooling (never served to the app)
├─ docs/                    ← build reports, item banks, content-sourcing rules + source registry
├─ CHANGELOG.md             ← generated from the in-app changelog
└─ .github/workflows/deploy.yml
```

## Writing content

All module content follows [`docs/CONTENT-SOURCING-GUIDELINES.md`](docs/CONTENT-SOURCING-GUIDELINES.md):
teach concepts, never copy expression; source from the tiers in
[`docs/sources-registry.json`](docs/sources-registry.json); never source from ISC2, CompTIA,
paywalled ISO/IEC standards or exam-dump sites. New modules pass three-layer validation
(schema · ARC semantics V1–V13 · live scoring) and a blind cooperative-plus-hostile item audit
before they ship.

## Keeping outlines current

Vendors don't publish a machine-readable feed of exam outlines, so AEGIS reads
**`outline-versions.json`**. If it lists a newer outline than the edition baked into the app,
the Cert Map flags that certification (**Upcoming** for a future date, **Update** for one in
effect). To flag a new outline, bump that cert's `outline` and `asOf` (`YYYY-MM-DD`) and add a
`note`; every installed copy shows it on its next online load.

## Disclaimer

AEGIS is an **independent study tool** and is **not affiliated with, endorsed by, or sponsored
by ISC2® or CompTIA®**. Certification names are trademarks of their owners and are used only to
describe what the material aligns to. AEGIS is exam prep, not a credential; any completion
record it produces is not an accredited certification.

Practice offensive techniques **only** against systems you own or are explicitly authorized to
test. Unauthorized scanning or access is illegal under laws such as the U.S. CFAA.

## License

MIT — see [`LICENSE`](LICENSE).
