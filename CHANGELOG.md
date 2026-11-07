# Changelog

Generated from the in-app **What’s New** list in `index.html` (`npm run changelog`). Edit it there, not here.

## v1.7.0 — Nov 2026

- **Overall % is now Mastered-only and may read lower.** With ARC learning mode on, the Command dashboard shows a Domain 1 panel with three meters. **Overall** counts only objectives you have *mastered* (a review interval past 60 days), with no partial credit. It is meant to read lower than your reading progress and the classic percentage. The classic all-domain dashboard is unchanged.
- The other two meters: **Reading** (what you have read, not what you have retained) and **ARC**, a two-tone bar of gates cleared vs mastered. Tap the bar for the exact split.
- A **Today** card on the dashboard, once a day: reviews that are due come first, then a module that has just finished its 24-hour wait, then where you left off, then the next objective. Dismiss it any time.
- A short **How progress works** explainer (reading vs gates vs mastery, the 24-hour wait, what "overdue" means). It opens on your very first visit and can be reopened from the Progress tab.
- **Overdue reviews now pause new ARC material.** With 3 or more reviews overdue, or any one more than 48 hours late, starting a new module waits until you catch up. AEGIS says why and links straight to the most overdue review. Reading, the glossary and the Range are never blocked.
- The 24-hour **consolidation screen** is no longer a dead end. It now links to another objective that is ready, the glossary and the Ethics Tribunal.
- All twelve Domain 1 **gate hints** were reviewed blind, and ten were rewritten. Each hint now gives you a method to apply instead of restating the question. Hints still cost scheduling quality, so they are now worth that cost.

## v1.6.1 — Nov 2026

- **Reorder reviews can be answered again.** On the up/down-arrow review questions the arrows worked, but the app undid each move the instant it was made, so the answer could never change. Your in-progress answer now belongs to the question, not to the screen redraw.
- Same widget: keyboard focus follows the item you moved, each move is announced to screen readers, and the first ↑ and last ↓ are disabled instead of looking pressable.
- Glossary tooltips no longer get stuck on screen on phones and tablets. On touch, tapping a term opens the full entry; mouse hover on a desktop works as before.
- Objective rows on the Domains screen reflow when their column is narrow — on a phone *and* in the cramped middle column on a desktop. The title gets the full width and the buttons sit underneath it.
- The top bar now fits a phone: the version stays on one line, and the AEGIS wordmark no longer slides under the streak counter on narrow screens.

## v1.6.0 — Aug 2026

- **ARC learning mode (beta)** — Domain 1 only, off by default, switch it on under **Progress**. It replaces the “Got it — mark complete” click with a five-phase loop: a question before you read, the reading, a **gate you have to actually pass**, a paper exercise away from the screen, then spaced retrieval scheduled by FSRS-6.
- **The gate is the point.** Marking something complete never meant you knew it. Now an objective only counts when you sort, order or recall it correctly against a threshold the module itself declares — and the engine checks that independently of anything the screen displays.
- **Confidence before the answer.** Every gate asks how sure you are *before* revealing whether you were right. When you are certain and wrong, it says so — that gap is the thing re-reading hides from you.
- A **24-hour wait** after the paper exercise before the first review. It cannot be skipped: that delay is what makes this spaced retrieval rather than a same-day repeat.
- Content now lives in `modules/*.json`, cached for offline use after your first visit. With the beta off, nothing about the classic app changes — not the lessons, not the quizzes, not even the network requests it makes.

## v1.5.1 — Aug 2026

- **Correction — Code of Ethics.** The Ethics tab said that when two canons conflict, the *higher*-numbered one wins. That was wrong, and it contradicted the lesson, the Ethics Tribunal, and its own next sentence. The canons are listed in order of importance and the **lower**-numbered canon takes precedence — society (I) before your client (III).
- Clarified what the source actually says: ISC2 publishes four *mandatory* canons in a fixed order and states they are not equal, but the published Code does not spell out a numbered precedence rule. Treat “lower number wins” as the resolution method ISC2 expects and the exam tests — not as a line you can quote from the Code.

## v1.5.0 — Aug 2026

- The review queue now schedules with **FSRS-6**, the modern spaced-repetition algorithm, instead of a fixed 1/3/7/16/35-day ladder. Each card tracks its own **stability** and **difficulty**, so intervals adapt to how *you* actually remember it.
- **Fixed a real bug:** the old queue only ever moved forward — a card you completely blanked on still advanced to a longer interval. Reviews are now graded **Again · Hard · Good · Easy**, and **Again** genuinely shortens the next interval and records a lapse.
- Mastering a glossary term in a lesson quiz now **files a review card automatically** (deduplicated), so the queue fills itself instead of waiting for you to type cards by hand.
- Cards can carry an answer on the back — tap **Show** to reveal it before you grade yourself.
- Your existing cards were migrated automatically. Nothing was lost: each card’s old step became its starting stability.

## v1.4.0 — Aug 2026

- Vocabulary now **counts**: mastering a term in a lesson quiz tracks it, feeds your streak, and contributes to overall readiness. See **Terms mastered** on the Progress tab, with ✓ marks in the glossary.
- Lesson quizzes gained a **direction toggle** — **Both**, Term→definition, or Definition→term — so you practice both recognizing and naming terms. Distractors now prefer the same domain to stay challenging.

## v1.3.2 — Aug 2026

- Each lesson now has a **definition quiz** — multiple-choice questions built from that lesson’s key terms, so you can test your recall right after reading.

## v1.3.1 — Aug 2026

- Expanded the glossary with common acronyms — **DDoS, GDPR, HIPAA, PCI-DSS, TLS, PKI, IAM, SOC, RPKI, DNSSEC** and more (~95 terms).
- Every lesson now ends with a **Terms to know** list of its key terms.
- Glossary terms are auto-highlighted in the **domain objectives** too — but not in quizzes, where you should already know them.

## v1.3.0 — Aug 2026

- New **Glossary** tab — a searchable dictionary of ~60 cybersecurity terms, each with a definition, why it matters, its CC domain, and an example.
- Terms are now **auto-highlighted in lessons**: hover for a quick definition, tap to open the full term page. Term pages cross-link to each other.

## v1.2.1 — Aug 2026

- Reliability: the app now always loads the newest version when you’re online (network-first service worker), so updates appear without clearing anything.

## v1.2.0 — Aug 2026

- New **Outline Currency** check on the Cert Map — see the exact exam edition AEGIS is aligned to, get flagged when a certification publishes a newer outline, and open the official source in one tap.
- Heads-up baked in: the **ISC2 CC outline refreshes Sept 1, 2026** (deeper AI coverage) — AEGIS surfaces it automatically.
- Refreshed certification editions (CISSP Apr 2024, Security+ SY0-701, CEH v13, CySA+ CS0-003, and more).

## v1.1.0 — Aug 2026

- AEGIS is now an **installable app** (PWA) — add it to your home screen and it runs full-screen and offline.
- **Per-domain quizzes** with a real 80% pass gate, plus a larger question bank.
- **In-app lessons** for every Beginner objective and all of Domain 1 — concept, diagram, and worked example.
- New **Subnet & CIDR trainer** with real IPv4 math, bringing the Range to 7 trainers.
- Domain 4 expanded across **Beginner → Advanced** networking, plus a full certification map.
- This changelog screen, plus version tracking.

## v1.0.0 — Jul 2026

- Initial release: the five ISC2 CC domains on a **learn → drill → prove** loop.
- Six hands-on browser trainers and the **Code of Ethics** gate for offensive tools.
- Progress tracking with streaks and a spaced-repetition review queue.
