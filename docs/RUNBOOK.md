# Runbook — adding a record

For a human, without an agent. If you follow this, the ledger stays trustworthy.
If you skip the parts that feel pedantic, it stops being worth citing — the pedantic parts are the
ones that failed in the 2026-07-26 audit.

**The rule underneath every rule here:** the ledger records *what is sourceable*, not what is
probably true. Those come apart more often than you would expect, and every defect found so far came
from closing that gap with an inference.

---

## 0. Before you start

```bash
npm run validate     # ledger must be clean before you add to it
npm run hooks:install  # once per clone — without it, nothing is enforced
```

If `validate` fails, fix that first. Never add a record to a broken ledger.

---

## 1. Intake — what to capture, in what order

Order matters. Doing it in this order stops you forming a view before you have the evidence, which is
how enrichment fields get over-claimed.

**1. Capture the sources first. Do not write anything into a record yet.**
For each source: the URL, the publication date, and a short verbatim quote of the sentence that
carries the claim. Verbatim — not your summary of it. If you cannot quote it, you do not have it.

**2. Establish the date, in UTC.** See §5. Do this before anything else, because the record's id
depends on it and the id is permanent.

**3. Only now, fill in the fields** — and for each one ask the §3 question before typing a value.

**4. Write the record** at `ledger/<vendor>/<id>.json`. Copy the shape from an existing record.
`npm run validate` will tell you what is missing, by file and field.

**5. Rebuild and commit.**
```bash
npm run build && npm test && git add -A && git commit
```
The pre-commit hook validates the staged content and enforces append-only. If it rejects the commit,
read the message — it names the file and the field.

### When a source is behind a 403

This will happen; several sources in this ledger 403 to a plain client while loading fine in a
browser. Bot-blocking is not a dead link, but you must not cite what you have not read.

- **Read it in a browser.** If it loads, it is live — quote it and cite it normally. **This works far
  more often than it looks like it will, and it is the cheapest move available.** On 2026-07-27 it
  rescued two sources in one day: `jawlah.co` (403) upgraded a record by supersession, and
  `x.com/thsottiaux/status/…` (402) turned an unrecordable rumour into a `confirmed` record after
  FOUR sweeps had logged it as blocked.
- **A login wall is not necessarily a dead end.** x.com renders only a login prompt in the page body,
  but serves the full post text in its own `<title>` and `og:description` to unauthenticated clients.
  That is the platform publishing the text, so it is a read of the source. Check the page metadata
  before concluding a walled source is unreadable.
- **If it will not load anywhere, do not cite it.** A search-result snippet is not a source. This
  cost the ledger a real citation once: `memeburn.com` appeared to carry an event-specific claim for
  the 2026-07-21 reset, returned 403, and was therefore excluded — which is why that record is the
  weakest date in the ledger. That was the correct call and should be made the same way next time.
- **Record the attempt** in `notes`, so the next person does not repeat the search.
- If a source is important and fragile, archive it: `npm run archive -- --save`. **61 of 64 evidence
  URLs now carry a capture** (the "0 of 86" that used to stand here is long superseded). Verify
  periodically with `npm run archive:verify` — 1 capture in 62 has genuinely rotted, and a single
  HTTP 404 from Wayback is NOT evidence of that; it takes two.

---

## 2. Evidence rules — the checklist

Run this against every source before it becomes an `evidence` entry.

### Is it a mirror?

A **mirror** is any site substantially made of republished X posts — reset trackers especially
(`codexreset.org`, `codex-resets.com`, `codex-reset.com`). Judge the *site*, not the topic.

- ✅ A mirror may be a **LOCATOR**: that a post exists, which post, and when.
- ❌ A mirror may **NEVER carry SUBSTANCE**: what was said, promised, changed, or how many accounts
  were covered. **A population count is substance.**
- ❌ **A record may never rest on a mirror alone.** Strike every mirror citation; if nothing is left,
  the record does not exist.
- Mirror-sourced entries take `type: "user_report"`, never `vendor_post`.

**Mirrors are correlated by construction** — they copy the same upstream — so two mirrors agreeing is
not corroboration. It is one source counted twice.

> `minimaxir.com` is **not** a mirror. It is an independent technical blog that happens to cite post
> ids. Do not misclassify it; six records depend on it.

**The test:** *if this mirror were fabricating, what would change?* If the answer is "the timestamp
would move, and I can check it by decoding the id" — locator, fine. If the answer is "I would no
longer know what happened" — substance, prohibited.

### Confidence grade

| grade | requires |
|---|---|
| `confirmed` | a **vendor post** or **status page** states it. Nothing else earns this. |
| `probable` | multiple independent, consistent sources. Mirrors do not count as independent. |
| `reported` | a single source. |

A press article relaying an X post is **press**, not a vendor post. It never earns `confirmed`.

> **RULED 2026-07-27 (operator): an identified vendor employee's own post IS a vendor post**, and
> earns `confirmed`. Settled on `cx-2026-07-25-01`, the first record here to cite x.com — @thsottiaux,
> OpenAI's named Codex engineering lead, announcing in the first person plural: *"We have reset usage
> limits for all Codex and ChatGPT Work users."*
>
> The argument that decided it: the line above only means anything if the ORIGINAL post is a vendor
> post — otherwise there is nothing for the relay to be distinguished from.
>
> **Three conditions, all required.** Miss any one and it is not a vendor post:
> 1. **Read from the platform itself**, never from a tracker or an article. A mirror's copy of a
>    vendor post is still a mirror.
> 2. **The author is identified and speaks for the vendor** — a named employee using "we" about their
>    employer's action. An anonymous account, or an employee speculating about their own company, is
>    a `user_report`.
> 3. **The post asserts the event**, not a plan. *"We will reset limits today"* is a promise; two
>    candidate records were already refuted for exactly that.
>
> ⚠️ The counter-argument is recorded rather than dismissed: this is a personal account, not a
> corporate one such as @OpenAI, and no corporate channel corroborated it. The operator weighed that
> and ruled for `confirmed`. If a future case turns on the distinction, that is the axis to argue.

> `telemetry` was struck from the confirming set on 2026-07-26. Telemetry can show that an account's
> quota changed; it cannot show that the vendor *granted* anything. It would confirm a proposition
> this ledger does not record.

### Post-id decode

X post ids encode their own creation time. Decoding one is **arithmetic, not testimony** — it does
not require trusting whoever showed you the id.

```js
const utc = new Date(Number((BigInt(postId) >> 22n) + 1288834974657n));
```

Use it whenever a date is contested. It settled the two largest structural defects found here.

⚠️ **The decode gives you *when the post was made*, not when the reset landed.** If the post says
"resetting in the next hour", the announcement is exact and the effect is not — use `precision:
"hour"` and say so in `notes`. Two records were refuted for exactly this: a future-tense promise
("We will reset rate limits today!") with nothing showing it ever happened.

---

## 3. `field_support` — the discipline that matters most

**This exists because of the failure that produced the 2026-07-26 audit**, and understanding that
failure is the whole point of this section.

> **The failure mode:** a source says something general about how quota resets work — *"providers can
> reset the weekly quota, often gifted as compensation when something breaks"* — and that general
> statement gets written into a specific record as its cause. The record then asserts, of one dated
> event, something no source ever said about that event.
>
> That single sentence in `minimaxir.com` produced a `trigger: "incident_compensation"` on a date
> with **no incident at all**. When swept for, the same shape appeared in **24 of 29 records**.

For each of `trigger`, `scope.windows`, `scope.plans`, `scope.partial`, ask one question:

> **Does a source say this *about this event*, or does it say it in general and leave me to apply it?**

| answer | value | mark |
|---|---|---|
| A source states it of this specific event | the value | `attested` |
| It follows from a general statement, or from a nearby event, but nobody said it *here* | the value | `inferred` |
| Nothing addresses it | empty — `unknown` / `[]` / `null` | `unestablished` |

**"It's obviously true" is not `attested`.** A true claim resting on a general statement is still the
defect. `inferred` is not a failure grade — it is an honest one, and it keeps a useful value
recordable without letting it pass as an assertion.

The validator enforces the pairing: `unestablished` on a populated field is rejected, and `attested`
on an empty one is rejected. You cannot claim a value and disclaim it at once.

> 9 current records carry **no** `field_support` at all. They predate the field. Absent means
> "provenance was never recorded" — not "attested".

---

## 4. Append-only — how to correct something

**Never edit a committed record. Never delete one.** The git history is the audit trail; a ledger
whose records can be quietly rewritten proves nothing.

To correct record `X`:

1. Create a **new record** `Y` — same date, next sequence number — with the corrected values, a
   `field_support` entry for every enrichment field, and a `notes` that says what changed and why.
2. Set `X.superseded_by = "Y"`. That is the **only** field you may change on a sealed record.
3. Commit both together.

Both records stay in the ledger and both stay on the public page. The chain is visible in both
directions by design — that is the trust argument, not clutter.

### What the hook will reject

| you did | it says |
|---|---|
| changed any sealed non-null field except `superseded_by` | `SEALED FIELD MODIFIED` |
| deleted a record file | `DELETION REJECTED` |
| renamed one | `RENAME REJECTED` (the filename carries the id) |
| tried to make a sealed record `provisional` again | `UNSEALING REJECTED` |
| added a new field to a sealed record | ⚠️ **warns, does not block** — permitted by the rule but material; it belongs in an approved migration |

There is no escape hatch and no `--force`. If a record is wrong, supersede it.

---

## 5. Two rules that decide edge cases

### `scope.partial` — the predicate

Fixed so it is not re-argued per record.

- **`true`** — an *admissible* source states the grant reached only **some of the accounts** otherwise
  in scope: a headcount, a percentage, a named cohort, a staged rollout.
- **`false`** — an admissible source supports universal coverage.
- **`null`** — unestablished; no source addresses coverage either way.

**`false` is a claim about the evidence, not an assertion that the grant was universal.** Absence of a
restriction is what licenses `false`. Demanding proof of universality inverts the field — that
mistake accounted for **9 of 11 wrongly-flagged fields** in the audit.

Two carve-outs, both from real cases:
- A restriction on **when** a benefit applied (off-peak hours only) is **not** partial.
- A restriction on **which window** was reset is **not** partial. Only account coverage counts.
- If the only source for a restriction is a mirror, `partial` stays `false`/`null` even where the
  restriction is probably real. The field tracks what is sourceable; `scope.notes` carries the rest.

### UTC keying

**The ledger keys by UTC. Always.** A record's id date is its `effective_at` date in UTC, and the
validator enforces the match.

This is not cosmetic. Widely-cited sources date these events in **US Pacific**, which puts many of
them on the previous day:

- `minimaxir.com` dates in Pacific. `codexreset.org` dates in UTC. Every one of the ten post ids
  cross-checked here maps at exactly **UTC-7**.
- Post `2078320950488297917` = `2026-07-18T03:28:22Z` = *2026-07-17 20:28 Pacific*. It was recorded
  **twice**, once under each convention, before the merge caught it.
- The reverse case: `cx-2026-07-10-01` and `cx-2026-07-11-01` are two **genuinely different** posts
  that are *both* "July 10" in Pacific. UTC is what keeps them apart.

When a date is contested, decode the post id and use the UTC result. Record both the id and the
decode in `notes`.

---

## 6. What not to do

Every item below is a mistake that was actually made here.

- **Do not fill a field because it is required.** That is the root cause of the audit. A required
  boolean cannot say "I don't know" — that is why `scope.partial` now accepts `null`.
- **Do not read a general statement as an event-specific one.** See §3. It is the single most common
  defect and it is invisible once written.
- **Do not treat an announcement as an effect.** "We will reset limits today" is a promise. Two
  records were refuted because nothing showed the reset landed.
- **Do not cite a search snippet.** If you did not open it, you do not have it.
- **Do not let a mirror carry substance**, however plainly it renders it, and however many mirrors
  agree.
- **Do not trust a tracker's own labels.** One tracker row labelled "Jul 21" cited a post that
  decodes to **July 25**, and listed the same id again under its own July 25 row.
- **Do not assume a same-day pair is a duplicate.** Two Codex announcements 3h29m apart on
  2026-07-12 were different events with different effects. Decode both ids before merging.
- **Do not assume a cross-day pair is distinct.** The converse bit too — see §5.
- **Do not "complete" a deliberately empty field.** An empty array is often a finding, not an
  omission. Check `field_support` before filling anything.
- **Do not batch-correct.** When 41 corrections were proposed at once and then verified, **21 were
  wrong** — 11 "fixed" values that were already right. Verify each one against its sources.
