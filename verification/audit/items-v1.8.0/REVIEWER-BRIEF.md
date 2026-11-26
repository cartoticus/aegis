# Blind review — AEGIS v1.8.0 item banks and hints

You are one of four independent reviewers of learning content for a free cybersecurity
exam-prep app (ISC2 Certified in Cybersecurity level). There is **no answer key** given
to you; your answers are compared with the author's afterwards. Disagreement is the
useful signal, so answer honestly from your own judgement — do not try to guess what
the author wanted.

**Read only the task file you are given. Do not open, list or search any other file or
directory** (in particular nothing under the repository's `modules/`, `verification/`,
`docs/` or `index.html`). Do not use the web. Work alone.

## The task file

`modules[]`, each with:
- `reading` — the lesson a learner reads before the questions (markdown).
- `items[]` — question banks. `bank` is `gate` (the mastery check) or a review drill tier.
  - `CLASSIFY`: put every numbered statement into exactly one of `buckets`.
  - `ORDER`: give the lettered steps in the order you would actually do them.
  - `SELECT`: choose the lettered options that belong (exactly the right set; extras count against you).
  - `CLOZE`: fill each blank (in order of `blanks`). Use the shortest natural answer
    (a single word, a number or an address). If the item has a `workspace_file`, that is the
    file the learner investigates; derive your answers from it.
  - `RECALL`: write the answer a well-prepared learner would write, in 60–120 words, in
    plain prose. Do not pad it with keywords.
- `hints[]` — the two hints a learner can reveal on that module's **gate**. Revealing a
  hint costs the learner score, so a hint must change how they approach the gate, not
  hand them the answer.

## Output

Write **one JSON file** to the path you are given, exactly this shape:

```json
{
  "reviewer": "<your letter>",
  "items": {
    "<item id>": {
      "answer": <see below>,
      "confidence": 1-5,
      "flag": "CLEAN" | "AMBIGUOUS" | "GIVEAWAY" | "FACTUAL" | "UNCLEAR",
      "severity": "NONE" | "LOW" | "MED" | "HIGH",
      "note": "one or two sentences; required whenever flag is not CLEAN or severity is MED/HIGH — name the statement number / letter"
    }
  },
  "hints": {
    "<hint id>": { "verdict": "CHANGES_APPROACH" | "RESTATES" | "MISLEADS", "leak": "LOW" | "MED" | "HIGH", "note": "..." }
  }
}
```

`answer` by kind:
- CLASSIFY → object mapping statement number (as a string) to bucket name exactly as written, e.g. `{"1":"Phishing","2":"Legitimate"}` — every statement.
- ORDER → array of letters, first step first, e.g. `["C","A","E","B","D"]`.
- SELECT → array of letters you would select.
- CLOZE → array of strings, one per blank.
- RECALL → a string (your 60–120 word answer).

Flags: **AMBIGUOUS** = a second answer is defensible for a learner who read the lesson
(say which); **GIVEAWAY** = answerable from wording alone without understanding;
**FACTUAL** = something is wrong or misleadingly stated (in the item or the lesson);
**UNCLEAR** = you cannot tell what is being asked.

Hint verdicts: **CHANGES_APPROACH** = a learner who was stuck would now work the problem
differently and better; **RESTATES** = it only repeats the lesson or the prompt;
**MISLEADS** = it could push a learner toward a wrong answer. Leak: **HIGH** = someone who
does not understand the concept could get items right from the hint alone; **MED** = it
narrows specific items; **LOW** = it teaches a method only. Stating a concept's defining
distinction is not HIGH merely because applying it yields the answer; HIGH is for
shortcuts that work without understanding. A hint that repeats the exact wording of an
answer option or step is a leak.

`severity` (everyone fills it; it matters most for reviewer H): HIGH = the item is
defective and must not ship (a genuinely defensible second answer, a factual error, or
it can be answered correctly without understanding); MED = worth improving; LOW = nit.

When finished, reply with only: the output path and a one-line count of flags.
