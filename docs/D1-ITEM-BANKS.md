# AEGIS Phase 1 — Domain 1 item banks & thresholds

**Post-audit, round 7.** All six modules pass the three-way probe (schema · semantics V1–V13 · live scoring): **211 checks, 0 failures**. Item banks cleared a blind adversarial audit: **62/62 four-way unanimous** across the key, two independent cooperative classifiers and one hostile answerer, none of whom saw the key. Zero SPLIT and zero CONSENSUS-AGAINST-KEY in every round.

Items marked ⚑ were flagged by both cooperative classifiers and kept under a *verified* override — the module reading decides the case, and the tool checks the quote is really there. They are the dogfood watch-list.

**Threshold rules.** Sorting / selection / ordering: `min_correct = item_count − 1` (one slip forgiven). `FREE_RECALL`: `n − 2` — producing from memory tolerates more misses than picking from a list. `d1_4` is the documented exception at perfect order.

---

## d1_0 — The CIA Triad

*objective in index.html:* CIA triad: confidentiality, integrity, availability

| | |
|---|---|
| module id | `isc2.cc.d1.cia-triad` |
| prerequisites | — *(DAG root)* |
| reading | 234 words (cap 1200) |
| gate | `CLASSIFY` · class B · `bucket_assignment` |
| **pass_threshold** | **5 of 6** (83%) |
| gate budget | 90s |

**Prequestion.** Before reading: a ransomware attack encrypts a hospital's records so staff cannot open them. Which property has been attacked?

**Gate prompt.** Sort each incident under the leg of the CIA triad it primarily attacks.

**Hints** (strategy-only — each costs 1.0 q, never blocks passage)

- Name the property the attacker destroyed, not the technology they used. The same technology shows up as a control on one side and a weapon on the other.
- If two legs seem to fit, ask which loss the victim notices first, and which one they could still be suffering without knowing.

**Item bank**

- **Confidentiality**
  - Customer database exfiltrated and posted online
  - Attacker reads unencrypted traffic on public Wi-Fi
- **Integrity**
  - Payroll figures silently altered in the database
  - Firmware replaced with a tampered build
- **Availability**
  - Ransomware encrypts the file server ⚑
  - Botnet floods the public website with traffic

**Analog / synthesis** (SPATIAL). On paper, draw the triad as a triangle and label the three vertices from memory. Against each vertex write one attack that breaks it and one control that protects it — six items total. Do not consult the lesson.

**Calibration question.** Which vertex did you fill in last, and did you write a control there that actually protects a different leg?

**Drills**

| tier | type | threshold | prompt |
|---|---|---|---|
| RECOGNITION | `CLOZE` | 2/3 | Complete: Hashing a file to prove it was not changed protects ______. Redundant servers protect ______. E… |
| APPLICATION | `CONSTRUCT_SET` | 3/4 | A hospital must keep patient records reachable through any disruption — outage, attack or accident. Selec… |
| GENERATIVE | `FREE_RECALL` | 4/6 | Without notes: name the three legs of the CIA triad, give one attack and one control for each, and explai… |

---

## d1_1 — Authentication, Non-repudiation & Privacy

*objective in index.html:* Authentication, non-repudiation, and privacy

| | |
|---|---|
| module id | `isc2.cc.d1.authn-nonrep-privacy` |
| prerequisites | `isc2.cc.d1.cia-triad` |
| reading | 337 words (cap 1200) |
| gate | `CLASSIFY` · class B · `bucket_assignment` |
| **pass_threshold** | **5 of 6** (83%) |
| gate budget | 100s |

**Prequestion.** Before reading: a system logs you in with a password, then a second password. Is that multi-factor authentication?

**Gate prompt.** Sort each measure under the property it primarily provides.

**Hints** (strategy-only — each costs 1.0 q, never blocks passage)

- Ask what each measure exists *for*: establishing who someone is, making an action undeniable afterwards, or holding less data in the first place.
- Several of these produce a side effect that belongs to a different bucket. Sort by the reason the measure was put there, not by everything it happens to help with.

**Item bank**

- **Authentication**
  - Requiring a password plus a one-time code from the user's phone
  - Unlocking a workstation with a registered fingerprint
- **Non-repudiation**
  - Digitally signing an approved payment so it traces to one named employee
  - Keeping a tamper-evident audit log of who changed each record
- **Privacy**
  - Collecting only the data fields the service actually needs
  - Honouring a customer's request to erase what you hold about them

**Analog / synthesis** (COMPARATIVE). Away from the screen, pick one account you use every day. On paper, write down every factor it currently asks you for and label each one know / have / are. Then answer in writing: is it genuinely multi-factor, or the same factor twice? What evidence would exist if someone else used it — could you prove it was not you? And what personal data does it hold that it does not need?

**Calibration question.** Before checking: did you count a security question or a memorable date as a separate factor from your password — and if so, what does a single phishing page capture?

**Drills**

| tier | type | threshold | prompt |
|---|---|---|---|
| RECOGNITION | `CLOZE` | 2/3 | Complete: A password is something you ______. A hardware token is something you ______. A fingerprint is … |
| APPLICATION | `CLASSIFY` | 5/6 | For each sign-in step, decide which factor category it draws on. Ask what an attacker would have to get h… |
| GENERATIVE | `FREE_RECALL` | 6/8 | Without notes: name the three authentication factor categories with an example of each; explain the diffe… |

---

## d1_2 — Control Types: Technical, Administrative, Physical

*objective in index.html:* Control types: technical, administrative (managerial), physical

| | |
|---|---|
| module id | `isc2.cc.d1.control-types` |
| prerequisites | `isc2.cc.d1.cia-triad` |
| reading | 309 words (cap 1200) |
| gate | `CLASSIFY` · class B · `bucket_assignment` |
| **pass_threshold** | **5 of 6** (83%) |
| gate budget | 100s |

**Prequestion.** Before reading: a CCTV camera in the server room. Is it a physical control or a detective one?

**Gate prompt.** Sort each control by its TYPE — how it does its job. Ignore when it acts; that is its function, not its type.

**Hints** (strategy-only — each costs 1.0 q, never blocks passage)

- Ask what actually does the enforcing: a machine, a rule that people follow, or a barrier in the physical world.
- A control can be preventive or detective and still be any of the three types. Type and function are separate questions — answer the one being asked.

**Item bank**

- **Technical**
  - A firewall filtering inbound traffic by rule
  - Full-disk encryption on every laptop
- **Administrative**
  - An acceptable-use policy signed by every employee
  - Background checks run before a new hire starts
- **Physical**
  - A perimeter fence around the data centre
  - A locked door on the server room

**Analog / synthesis** (REDUCTIVE). Away from the screen, pick one room or system you can actually see — your home office, a car, a bike lock, a shared flat. On paper, list every safeguard protecting it and label each one technical, administrative or physical. Then find the gap: which of the three types has no entry at all, and what would you add to fill it?

**Calibration question.** Before checking: did you label anything by *when* it acts (preventive, detective) instead of by *how* it works — and which of the three types did you find yourself with nothing to write against?

**Drills**

| tier | type | threshold | prompt |
|---|---|---|---|
| RECOGNITION | `CLOZE` | 2/3 | Complete: A control enforced by technology is ______. A control that is a rule people follow is ______. A… |
| APPLICATION | `CONSTRUCT_SET` | 3/4 | A new branch office is opening. Select every safeguard on the plan that is an ADMINISTRATIVE control. |
| GENERATIVE | `FREE_RECALL` | 5/7 | Without notes: name the three control types with two examples of each; explain how a control's type diffe… |

---

## d1_3 — The ISC2 Code of Ethics

*objective in index.html:* The ISC2 Code of Ethics

| | |
|---|---|
| module id | `isc2.cc.d1.code-of-ethics` |
| prerequisites | `isc2.cc.d1.cia-triad` |
| reading | 486 words (cap 1200) |
| gate | `CLASSIFY` · class B · `bucket_assignment` |
| **pass_threshold** | **7 of 8** (88%) |
| gate budget | 150s |

**Prequestion.** Before reading: your employer asks you to stay quiet about a flaw that puts the public at mild risk. Whose interest wins?

**Gate prompt.** Each situation is most directly about one canon's subject matter: public safety and the infrastructure (I), your own honesty and legality (II), what you owe the client who hired you (III), or the standing of the profession (IV). Sort them. Note that ranking settles conflicts of *duty* — it is not how you classify what a situation is about.

**Hints** (strategy-only — each costs 1.0 q, never blocks passage)

- Ask who is primarily being protected: the public, your own integrity, the client who hired you, or the profession itself.
- More than one canon can be true of the same act. Ask which one the situation is fundamentally *about*, not which others it also touches.

**Item bank**

- **Canon I — protect society and the infrastructure**
  - A vendor ignores your reports of a medical-device firmware flaw while patients remain at risk, and you keep pressing for a fix
  - You report a vulnerability you found in a city's emergency dispatch system
- **Canon II — act honourably, honestly, justly, responsibly and legally**
  - You refuse to scan a network you have no written authorisation to test
  - You decline to exaggerate a threat in a sales pitch to frighten a prospect into buying ⚑
- **Canon III — provide diligent and competent service to principals**
  - You tell a client up front that a specialised cloud engagement is beyond what you are qualified to deliver
  - You turn down a second client whose work would create a conflict of interest with your current engagement
- **Canon IV — advance and protect the profession**
  - You report a peer who is selling leaked ISC2 exam questions to candidates
  - You spend an afternoon each month mentoring junior analysts with no billable work attached

**Analog / synthesis** (COMPARATIVE). Away from the screen, take a case where two canons genuinely pull against each other. Use this one, or your own: a client leans on you to overstate their security posture in an audit report — that is your own honesty (II) against what you owe the principal who hired you (III), and because third parties will rely on that report, arguably public trust (I) as well. On paper: name every canon in play, state what each demands, decide which wins and why, and write the sentence you would actually say to the client. Do not consult the lesson.

**Calibration question.** Before checking: did you resolve the conflict by the canons' priority order, or by which choice was less uncomfortable — and would your answer change if the public risk were severe rather than mild?

**Drills**

| tier | type | threshold | prompt |
|---|---|---|---|
| RECOGNITION | `CLOZE` | 3/4 | Complete the canon each phrase belongs to, by number (I, II, III or IV): protect society and the infrastr… |
| APPLICATION | `ORDER_SEQUENCE` | 6/6 | Put the four canons in the order ISC2 gives them — highest priority first. When two conflict, the earlier… |
| GENERATIVE | `FREE_RECALL` | 5/7 | Without notes: state all four canons in priority order; explain what the ordering is for and give a case … |

---

## d1_4 — The Risk Management Lifecycle

*objective in index.html:* Risk management lifecycle: identify → assess → treat

| | |
|---|---|
| module id | `isc2.cc.d1.risk-lifecycle` |
| prerequisites | `isc2.cc.d1.cia-triad` |
| reading | 441 words (cap 1200) |
| gate | `ORDER_SEQUENCE` · class B · `kendall_tau` |
| **pass_threshold** | **10 of 10** (100%) |
| gate budget | 75s |

**Prequestion.** Before reading: your company buys cyber-insurance that covers the cost of a breach. Has the *likelihood* of a breach gone down?

**Gate prompt.** A new risk has just been raised: an internet-facing server is running unpatched software. Put the five steps of handling it in the order you would actually perform them.

**Hints** (strategy-only — each costs 1.0 q, never blocks passage)

- You cannot rank a risk before you have judged how likely it is and what it would cost.
- Choosing a treatment is not the last step — something always remains afterwards, and it needs a named owner.

**Correct order**

  1. Identify the asset, the threats to it, and the vulnerabilities they could exploit
  2. Assess likelihood x impact and rank it against the other risks
  3. Choose a treatment: mitigate, transfer, avoid or accept
  4. Apply the control and verify it actually works
  5. Document the residual risk and have it formally accepted

**Analog / synthesis** (SEQUENTIAL). Away from the screen, pick one real risk in your own life — a laptop with no backup, a reused password, an unlocked side door. On paper, run it through all five steps: name the asset, the threat, the vulnerability; judge likelihood and impact; pick one of the four treatments and say why; then write the residual risk that is left over and who accepts it. One page, no notes.

**Calibration question.** Before checking: at which step did you first have to guess rather than recall — and was your treatment a genuine mitigation, or did you write down 'accept' because you did not want to change anything?

**Drills**

| tier | type | threshold | prompt |
|---|---|---|---|
| RECOGNITION | `CLOZE` | 2/3 | Complete: An unpatched web server is a ______. The ransomware crew who would exploit it is a ______. How … |
| APPLICATION | `CLASSIFY` | 5/6 | Sort each decision under the risk treatment it represents. |
| GENERATIVE | `FREE_RECALL` | 6/8 | Without notes: define threat, vulnerability and risk and say how they differ; name all four treatments; e… |

---

## d1_5 — Governance: Policies, Standards, Procedures & Laws

*objective in index.html:* Governance: policies, procedures, standards, regulations, and laws

| | |
|---|---|
| module id | `isc2.cc.d1.governance` |
| prerequisites | `isc2.cc.d1.cia-triad` |
| reading | 341 words (cap 1200) |
| gate | `CLASSIFY` · class B · `bucket_assignment` |
| **pass_threshold** | **7 of 8** (88%) |
| gate budget | 150s |

**Prequestion.** Before reading: "Data at rest must be encrypted with AES-256." Is that a policy?

**Gate prompt.** Sort each document or statement into the governance layer it belongs to.

**Hints** (strategy-only — each costs 1.0 q, never blocks passage)

- Work down in order: is it imposed on you from outside, is it optional, and does it state an intention, a specific requirement, or a sequence of actions?
- Force and specificity are two separate axes. Something can be mandatory and vague, or detailed and optional — the pair of answers picks the layer.

**Item bank**

- **Policy**
  - The organisation will protect the confidentiality of all customer data
  - Every system must have a named owner who is accountable for its security
- **Standard**
  - Data at rest must be encrypted with AES-256
  - All production servers must run the approved hardened OS image
- **Procedure**
  - Step 1: open the admin console. Step 2: select Enrol device. Step 3: scan the QR code
  - To report a suspected phishing email, click Report, then forward it to the security inbox
- **Guideline**
  - Where practical, prefer a passphrase of four or more words
- **Law or regulation**
  - HIPAA's requirements for safeguarding protected health information

**Analog / synthesis** (GENERATIVE). Away from the screen, pick one security rule you personally follow — locking your screen, using a password manager, not plugging in found USB sticks. On paper, write the full stack for it yourself: the one-sentence policy it serves, a standard that makes it specific and measurable, a procedure someone could follow without asking you a question, and a guideline that would help but that you would not enforce. Four documents, your own words.

**Calibration question.** Before checking: which of the four did you find hardest to write without sliding into one of the others — and did your 'policy' accidentally name a specific tool?

**Drills**

| tier | type | threshold | prompt |
|---|---|---|---|
| RECOGNITION | `CLOZE` | 3/4 | Complete: High-level mandatory intent from leadership is a ______. A specific mandatory requirement namin… |
| APPLICATION | `ORDER_SEQUENCE` | 6/6 | Order these from the broadest and most binding down to the most specific internal document. |
| GENERATIVE | `FREE_RECALL` | 5/7 | Without notes: name the four internal governance documents from broadest to most specific, with an exampl… |

