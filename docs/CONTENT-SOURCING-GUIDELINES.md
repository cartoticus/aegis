# AEGIS Content Sourcing & Originality Guidelines

**Version:** 1.0.0
**Applies to:** every `*.arc-module.json` authored for AEGIS, by a human, an agent, or hybrid.
**Companion file:** `sources-registry.json` (the approved-source database this document governs).

---

## 1. Purpose

AEGIS teaches cybersecurity concepts that map to ISC2 and CompTIA certification domains. It does not, and must never, reproduce ISC2's or CompTIA's copyrighted text — their exam outlines, CBK material, or official courseware — to do it. This document is the process that keeps every module on the right side of that line *before* it reaches ARC, so originality is designed in rather than checked for after the fact.

Two things are always true and never in tension:

- **You may align to a certification domain.** Stating "this module covers ISC2 CC Domain 1: Security Principles" is a factual claim, not a copyright or trademark problem.
- **You may not source content from that certification body's copyrighted material.** The domain you're teaching toward and the material you teach *from* are different things, and this document is entirely about the second one.

---

## 2. The core rule: concept vs. expression

Copyright protects ISC2's and CompTIA's specific wording, sentence structure, and document layout. It does not protect the underlying facts — the CIA triad, the five CC domains, risk management steps, defense in depth. Nobody owns the concept. What can't happen is lifting *their sentence* to teach *the concept*.

**Bad (mirrors structure, just swaps words):**
> Source: "Confidentiality ensures that information is not disclosed to unauthorized individuals."
> Module: "Confidentiality ensures information isn't disclosed to unauthorized people."

That's the same claim, same clause order, same scaffolding — a thesaurus pass, not a rewrite. It's still infringement-adjacent even with zero exact words copied.

**Good (built from the concept out, own example):**
> "Confidentiality is about *who's allowed to read it*. A hospital's patient records are confidential — a hash check on those records is a different property (integrity) from encrypting them at rest (confidentiality). If an attacker steals a database dump but the fields are encrypted, confidentiality held even though the breach happened."

Same concept, an original worked example, no sentence-level mirroring. This is also just better teaching material — concrete scenarios outperform restated definitions.

---

## 3. Approved sources, by tier

Entries live in `sources-registry.json`, each with a stable ID (e.g. `nist-sp800-30r1`) that a module's `provenance.sources` array references. Use this tiering to decide what a source is good for.

### Tier A — Public domain / government (safest, cite freely)
NIST Special Publications, NIST Cybersecurity Framework, NIST AI RMF, CISA advisories and guidance, US-CERT. US federal government works are public domain in the US — no permission needed, though good practice still means paraphrasing rather than copy-pasting, since AEGIS teaches concepts rather than reproducing government prose.

### Tier B — Open-license industry standards (cite with attribution)
OWASP (Top 10, GenAI LLM Top 10 — Creative Commons licensed), MITRE ATT&CK / ATLAS (free to use with attribution under MITRE's terms), IETF RFCs (freely available; IETF has its own reproduction rules — paraphrase, don't republish the RFC text). CIS Controls are usable under CIS's own license but carry attribution and non-commercial conditions — check the current CIS license before quoting even briefly, and prefer paraphrase.

### Tier C — Vendor documentation (use for factual/technical accuracy, paraphrase always)
AWS, Azure, GCP, and other vendor security documentation for how a specific control or service actually works. These are copyrighted vendor works — fine to learn from and cite as a source, never to reproduce.

### Restricted — do not source content from these
- **ISC2**: CBK, official courseware, exam outlines/objectives PDFs, ISC2.org article text. (You may still *name* the domain you're aligning to — see §1.)
- **CompTIA**: exam objectives documents, official courseware, CertMaster content.
- **ISO/IEC standards** (e.g. 27001, 27002): these are sold, paywalled documents — not open, regardless of how often they're cited elsewhere. Reference the *existence* and *purpose* of a standard ("ISO 27001 is a certifiable ISMS standard") without paraphrasing its clause text, since you likely don't have a copy to paraphrase from legitimately anyway.
- **Any third-party "exam dump," braindump, or leaked-question site.** Beyond copyright, CompTIA explicitly ties use of these to certification revocation for the *learner* — AEGIS content must never risk that for someone using it to prep.
- **Other prep-company material** (Udemy courses, Boson, other paid CC/Security+ prep products) — same reasoning as ISC2/CompTIA: their expression of the concept isn't yours to use.

---

## 4. Triangulation requirement

For `CONCEPT`-profile modules (per `arc-module_schema.json`), cite **two or more independent Tier A/B sources** where the topic reasonably allows it. A module built from a single source tends to inherit that source's structure even when paraphrased carefully — triangulating forces synthesis instead of restatement.

`SKILL`-profile modules (e.g. subnetting math) and narrowly factual items (a port number, an RFC-defined field) can reasonably cite one authoritative source — there's no "independent" way to restate that TCP uses port 443 for HTTPS.

---

## 5. Author's paraphrase self-check

Run this before a module is considered draft-complete:

1. **Close the source tab.** Write the explanation from what you understand, not what's on screen. If you need the source open to write the sentence, you're at risk of mirroring it.
2. **Read your draft next to the source.** Same sentence count? Same clause order? Same list structure? If yes, rewrite — restructure the explanation around your own logic, not theirs.
3. **Check the worked example is yours.** A scenario invented for the module (a hospital, a payment processor, a specific fictional company) is strong evidence of originality that a restated definition never is.
4. **Confirm no single source did all the work.** For CONCEPT modules, `provenance.sources` should have ≥2 entries unless the topic genuinely doesn't support it.
5. **Grep for the restricted list.** Nothing in `content.reading_markdown`, gate prompts, or drill explanations should trace back to an ISC2/CompTIA/ISO document or a prep-company product.

---

## 6. Logging provenance

Every module's `provenance` object should record what informed it, using IDs from `sources-registry.json` — not pasted URLs, not pasted text:

```json
"provenance": {
  "authored_by": "hybrid",
  "generator_id": "arc-aegis-migration/4.3.0",
  "reviewed_by": null,
  "reviewed_at": null,
  "sources": ["nist-sp800-30r1", "owasp-top10-2021"]
}
```

`sources` is an **optional, additive** field — it doesn't break existing modules or `arc-module_schema.json` validation (the schema's `provenance` object has no `additionalProperties: false` restriction, so this is a safe extension). Modules authored before this guideline existed can be backfilled opportunistically rather than blocking on it.

---

## 7. Where this plugs into existing QA

This document governs *authoring*. It doesn't replace your seven-round blind cooperative-plus-hostile content QA — it feeds it a cleaner input. Two small, cheap additions worth considering when you next touch `run-conformance.mjs`:

- A structural check: does `provenance.sources` exist and have ≥1 entry (warn, don't fail, for the initial rollout while older modules get backfilled).
- A registry-integrity check: does every ID in every module's `provenance.sources` resolve to a real entry in `sources-registry.json` (catches typos and orphaned references the same way `§12.10` already catches unresolvable links).

Both are additive to the existing suite, not a new one — consistent with how `§12.9` (version consistency) already lives alongside the semantic-rule checks.

---

## 8. Attribution and disclaimer (app-level, not per-module)

This document governs content authoring. The app-level trademark disclaimer — *"AEGIS is an independent study tool and is not affiliated with, endorsed by, or sponsored by ISC2® or CompTIA®"* — belongs once, in the README/footer, not repeated per module. Keep the two concerns separate: this doc keeps *content* original; the disclaimer keeps *branding* honest.

---

## Changelog

- **1.0.0** — Initial version. Establishes tiered source list, triangulation requirement, paraphrase self-check, and the `provenance.sources` schema extension.
