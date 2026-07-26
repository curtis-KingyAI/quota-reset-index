# MIGRATION PLAN — one event, awaiting operator signature

**Status: DRAFT. NOTHING HAS BEEN TOUCHED. No sealed record moves until this is signed.**

Operator instruction, 2026-07-26:

> MIGRATION — one event, not four. Bundle §2 reclassifications, both defect corrections, and the
> effects[] change into a single migration with a written plan I approve BEFORE anything is touched,
> each record's change individually justified inside it.

---

## Scale, stated first because it changes the decision

You asked me to sweep for one class of error. It is not a handful of records.

| | count |
|---|---|
| Records checked | 29 |
| **Clean on all four audited fields** | **5** |
| Carrying at least one `generic` or `unsupported` field | **24** |

Field-level verdicts across all 29 records:

| field | supported | generic | unsupported |
|---|---|---|---|
| `trigger` | 21 | 7 | 1 |
| `scope_windows` | 20 | 6 | 3 |
| `scope_plans` | 17 | 7 | 5 |
| `scope_partial` | 17 | 3 | 9 |

**This is not a two-record correction.** The `incident_compensation` defect you spotted is the
visible instance of a failure mode present in 24 of 29 records. Correcting only the two you
already knew about would leave the ledger looking audited while 22 records carry the same defect.

Clean records, for the avoidance of doubt: `cc-2026-04-23-01`, `cc-2026-05-06-01`, `cx-2026-04-08-01`, `cx-2026-07-13-01`, `cx-2026-07-16-01`.

---

## The three decisions this plan needs from you

**D1 — scope of the correction.** Options:
  - (a) Correct only the two known defects. Fast, dishonest, leaves 22 known-bad records.
  - (b) Correct every `unsupported` field, leave `generic` ones with a note. Middle.
  - (c) Correct every `generic` and `unsupported` field. Complete, and the largest.
  My recommendation is **(c)**, because the sweep is already done and a second pass costs more than
  finishing this one. But it is ~41 field changes across 24 records.

**D2 — mechanism.** Records are sealed. Every correction is a **superseding record**, so option (c)
costs 24 new records and the ledger roughly doubles to ~53. The alternative is a
one-time amendment allowing in-place correction of fields proven unsupported, logged in the git
history — which weakens the append-only guarantee that is the ledger's whole trust argument.
**I recommend supersede, not amend**, and accepting the size.

**D3 — `effects[]` backfill.** Adding `effects` to a sealed record adds a field rather than
modifying one, so the append-only rule permits it and the hook now warns loudly rather than blocking.
That is a technicality, not a licence. Backfilling `effects` is a material change to sealed records
and needs explicit sign-off here.

---

## ⚠️ COUPLING: the two rulings you flagged are not independent, and it runs deeper than stated

You wrote:

> the two-event argument for 6M vs cx-2026-07-12-01 rested on different causes. If
> incident_compensation is unsupported, that argument collapses. Re-test the two-event hypothesis
> on timestamps alone.

**Re-tested. The two-event conclusion survives, but not everything built on it does.**

On timestamps and IDs alone, stripped of any causal claim:

| Evidence | Admissible? | Source |
|---|---|---|
| Two distinct post IDs exist for 2026-07-12 | yes | `nerdschalk` cites 2076365965915467978; `minimaxir` hyperlinks 2076418567143408112 |
| They decode 3h29m apart (17:59:57Z / 21:28:59Z) | yes — arithmetic, not testimony | verified independently by me and by the research agent |
| A third ID decodes to 07-13T18:29:31Z | yes | same |

That holds with no reference to cause. **The two-event finding stands.**

**But a second coupling you did not name, and it bites harder.** The evidence that the 21:28Z grant
reached only **500k users** — the entire basis for the `scope.partial` correction — is verbatim from
the **codex-reset.com feed**, a mirror. Under the §2 amendment you asked me to draft, *a mirror may
never carry substance*. A population count is substance.

So the two rulings are coupled through §2, not through cause:

- If §2 is adopted as drafted, the 500k figure is **inadmissible**, and under the `scope.partial`
  predicate below, `partial` stays **false** — because the predicate tracks what is *sourceable*,
  not what is probably true. The correction you approved in principle would not survive its own rule.
- `explainx` (non-mirror) also mentions 500k, but dates the rollout to 07-13, contradicting the
  decode. So the non-mirror source for the figure disagrees with the timestamp evidence.

**This needs your ruling before the migration runs, and it is genuinely finely balanced.**

---

## The `scope.partial` predicate, now fixed in the schema

Written into `schema/reset-event.schema.json` so it is not re-litigated per record:

> **TRUE** iff an admissible source states the grant reached only *some* of the accounts otherwise
> inside `scope.plans`/`scope.windows` — a headcount, a percentage, a named cohort, a staged rollout.
> **FALSE** means no admissible source states such a restriction. FALSE is a claim about the
> **evidence**, not a positive assertion that the grant was universal.

One sweep agent independently flagged that this field's semantics were undefined and that its
findings might be void without them — so this was pinned just in time. **It changes one of the
sweep's own recommendations**: `cc-2026-03-13-01` was flagged `partial: true` because the doubling
applied only during off-peak hours. That is a restriction on *when*, not on *which accounts*, so
under the predicate it stays **false**. Listed below as a rejected suggestion, not an accepted one.

---

## Per-record changes

Each entry below is one record, with every proposed field change and the sweep's justification.

### `cc-2026-03-13-01`

Current: kind `limit_increase`, trigger `courtesy`, confidence `probable`, windows `[5h]`, plans `[Free, Pro, Max, Team]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_partial` | **unsupported** | true | Nothing in either source asserts this applied to the full window; both affirmatively state the opposite. The doubling was restricted to off-peak weekday hours (all-day only at weekends), which is a partial application of scope, and the record's own scope_notes documents that restriction while the fi |

> Both URLs loaded. trigger/windows/plans are all directly asserted of this event by XDA and corroborated by explainx — no generic-mechanism promotion. The one problem is scope_partial=false, which contradicts what both sources actually describe. Note also the record's own admission of a disputed end date (Mar 27 vs Mar 28); confirmed real — XDA says through March 27, explainx says the promo ended March 28. Not one of my four fields, but unresolved.

### `cc-2026-05-13-01`

Current: kind `limit_increase`, trigger `courtesy`, confidence `reported`, windows `[weekly]`, plans `[Pro, Max, Team, legacy seat-based Enterprise]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **generic** | capacity or competitive_response (article asserts competitive defence of this event; courtesy is not asserted) | This is a statement about what vendors in general do with spare capacity and why — a class-level maxim in the second person, not an assertion that Anthropic did this as a courtesy. Reading 'deepen platform loyalty' as this event's motive is the exact promotion this sweep is hunting. Two further prob |

> Single source (apidog), loaded. Windows/plans/partial are cleanly event-specific. The trigger is the defect: the only goodwill-flavoured material in the article is a class-level maxim about vendor behaviour, and the one motive the article does assert of this event is competitive defence — a different trigger. Separately, the record's own warning that the date is soft is confirmed: the article says only 'effective immediately' and supplies no May 13 date, so effective_at rests on unfetched search snippets. Confidence 'reported' with one third-party source is appropriately cautious.

### `cc-2026-05-15-01`

Current: kind `global_reset`, trigger `courtesy`, confidence `probable`, windows `[5h, weekly]`, plans `[Pro, Max, Team, Enterprise (seat-based)]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_plans` | **generic** | ["Pro","Max","Team","Enterprise"] — drop the '(seat-based)' narrowing | The four plan NAMES are asserted of this reset and are fine. The defect is the '(seat-based)' qualifier attached to Enterprise: no source applies that narrowing to the May 15 reset. 'Seat-based Enterprise' is the vendor's wording for the May 6 doubling and the May 13 weekly bump, and verdent uses it |

> Both URLs loaded and corroborate each other on the reset itself. trigger/windows/partial are solid. The one carry-over is the '(seat-based)' narrowing on Enterprise, which belongs to the May 6 and May 13 bump records and is contradicted here by 'regardless of tier'. Also worth noting: the pasqualepillitteri article does contain a class-level line about Anthropic being able to afford the occasional operational reset — the courtesy trigger does NOT rest on it, but it is the sentence most likely to be mistaken for the cause on a re-read, so it is worth recording that it was checked and set aside.

### `cc-2026-06-02-01`

Current: kind `global_reset`, trigger `incident_compensation`, confidence `reported`, windows `[]`, plans `[Pro, Max]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_partial` | **unsupported** | true | The field says false but the source asserts the opposite three times: 'for impacted users', 'affected Pro and Max subscribers', and 'compensate users affected by the bug rather than normal usage'. The record's OWN scope_notes agree — 'scoped to IMPACTED Pro and Max subscribers, not all users' — so t |

> One evidence URL, loaded fine. Verdict on the headline field is the opposite of what the sweep expected: 'incident_compensation' here is genuinely event-asserted, unlike the 2026-07-12 record that prompted this sweep. The real defect on this record is scope_partial:false, which contradicts both the source and the record's own scope_notes. Sourcing quality remains thin (single trade publication, motive attributed to no named source) but that is a separate concern from claim-to-source fit.

### `cc-2026-07-09-01`

Current: kind `global_reset`, trigger `unknown`, confidence `probable`, windows `[5h, weekly]`, plans `[all users (Pro, Max, Team, seat-based Enterprise)]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_plans` | **generic** | all users | The 'all users' half is supported verbatim. The parenthetical enumeration is NOT — it is back-projected from a different event described in the same article. implicator's only sentence naming those tiers is about the Claude Code +50% weekly promo: 'temporarily 50% higher for Pro, Max, Team and legac |

> All four URLs loaded. Two things the sweep surfaced that are not the assigned failure mode but affect this record's integrity. (1) EVIDENCE-TO-EVENT MISMATCH: three of the four URLs are primarily about the JULY 16 reset, not July 9. implicator's headline event is July 16 and it reaches July 9 in one clause; explainx's only July 9 reference is a subordinate phrase, 'the third visible Claude limit intervention in July after the July 9 reset'; builderwithin explicitly dates the reset it covers to July 16 and refers to an earlier one on July 10. Only ababnews (published 07/09) is contemporaneous w

### `cc-2026-07-13-01`

Current: kind `limit_increase`, trigger `courtesy`, confidence `reported`, windows `[weekly]`, plans `[Pro, Max, Team, legacy seat-based Enterprise]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **generic** | unknown | The article gives no reason for the extension. I checked the body text specifically for goodwill / thank / courtesy / apolog / compensat / demand / capacity / feedback — none appear. 'courtesy' therefore rests entirely on the class-level fact that the thing being extended is a promotional offer, plu |

> Single URL, loaded fine, and unusually well-specified for this batch — three of four fields carry explicit event-level assertions. The one defect is trigger:'courtesy', which no sentence supports. Separately, outside the four judged fields: scope_notes claims the promo 'was due to lapse July 13 at 6PM PDT'. That end date is NOT in this article — it states no original end date, only the new one. Whatever supports the 6PM PDT figure is uncited here.

### `cc-2026-07-18-01`

Current: kind `limit_increase`, trigger `unknown`, confidence `reported`, windows `[weekly]`, plans `[Pro, Max, Team, seat-based Enterprise]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_partial` | **generic** | false (unchanged) — add https://www.helpnetsecurity.com/2026/07/13/claude-code-weekly-limits-promotion-extended/ as evidence | Mild, benign instance of the pattern. Neither July 18 source asserts that every user on the covered tiers gets the boost. digitalapplied names the tiers and simply imposes no restriction — absence of a restriction is not an assertion of universality. The actual basis for false is the promo's general |

> Both URLs loaded. progressiverobot is close to unusable as evidence: it names no plan tiers, no exclusions, and leaves the August 19 year ambiguous, while supplying the one generic causal phrase in the batch. Effectively this record rests on digitalapplied alone. Also outside the judged fields: scope_notes says the announcement came from @ClaudeDevs and that both sources report that post rather than being the post — accurate, and per the standing constraint the X post itself was not and must not be fetched, so the ledger's characterisation is the correct level of hedge.

### `cx-2026-04-01-01`

Current: kind `global_reset`, trigger `capacity`, confidence `reported`, windows `[weekly]`, plans `[all paid]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **generic** | unknown (or a new 'precautionary'/'discretionary' value) | The source affirmatively DISCLAIMS a known cause. Tibo's statement gives a decision procedure (precautionary, in response to a spike in rate-limit hits) and explicitly no mechanism. 'capacity' supplies the mechanism anyway, and the only thing behind it is the class-level association between rate lim |
| `scope_windows` | **unsupported** | [] (empty, as in cc-2026-06-02-01) | Nothing in the thread states which window was reset. The originating post says 'CODEX Credits reset' with no window named; Tibo says 'resetting the usage limits' with no window named. I searched the thread for weekly / 5-hour / hourly: the 5-hour window appears only in POST-reset complaints about ho |
| `scope_plans` | **generic** | all plans | Low severity. The source asserts 'all plans' of this event; the record narrows it to 'all paid'. The 'paid' qualifier comes from general product knowledge about Codex requiring a paid subscription, not from any sentence. Thread participants happen to name Plus, Pro and Business as the plans they hol |

> Single URL, loaded fine. Weakest record in the batch on claim-to-source fit: two of four fields drift from the source, and both drift in the direction of more specificity than the source offers — a mechanism for an explicitly-unknown cause, and a window the source never names. Evidence-type caveat the record already flags and that this check confirms: the Tibo statement is a relay. It originated on X and reaches the ledger only as a forum participant's restatement, and per the standing constraint the X post cannot be fetched to verify wording. So even the quoted trigger sentence is second-hand

### `cx-2026-04-28-01`

Current: kind `global_reset`, trigger `courtesy`, confidence `probable`, windows `[5h]`, plans `[Plus, Pro, Business, Enterprise]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_windows` | **generic** | [] — with scope_notes restated as: weekly was reported NOT reset for at least one Plus account; which window(s) were reset is unestablished. | The scope_notes asserts "the only window with positive evidence of actually being reset is the 5-hour rolling window". I could not find that positive evidence. I read the full forum thread (all 8 posts) — the strings "5-hour", "5h" and "hourly" do not appear anywhere in it. Issue #20395 states only  |
| `scope_plans` | **generic** | ["all paid"] — matching the announcement's own unenumerated wording. | Textbook instance of the adjacent-claim shape. The reset itself is never tiered in any source — it is only ever "ALL paid plans" (announcement) or "all paid subscription plans" (aitopic). The four-tier enumeration Plus/Pro/Business/Enterprise appears in exactly one sentence in the corpus, and that s |
| `scope_partial` | **unsupported** | true | Not merely unsupported — contradicted by the record's own evidence. The record's cited GitHub issue reports OpenAI Support saying the reset was conditional, applying "by quota interval, account state, usage timing, or backend eligibility" rather than uniformly, and that "no correction would be made  |

> All four evidence URLs loaded. Two structural points. (1) This record is the clearest demonstration in the batch that an unqualified vendor announcement ("ALL paid plans") is not evidence of non-partiality on this site — Support walked it back. That precedent should govern how scope_partial is defaulted on cx-2026-05-16-01 too. (2) knightli.com, cited here and on cx-2026-05-16-01, carries a class-level sentence structurally identical to the minimaxir one that triggered this sweep: "A sudden Codex usage limit reset is usually not just 'free quota from nowhere.' It may come from incident compens

### `cx-2026-05-16-01`

Current: kind `global_reset`, trigger `incident_compensation`, confidence `probable`, windows `[]`, plans `[]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_partial` | **unsupported** | Leave false only if the schema treats it as a default rather than a claim; otherwise mark unknown and note that completeness was never addressed. | Nothing in any cited source addresses whether this reset reached everyone or every quota type. scope_partial=false rests entirely on the announcement being unqualified — i.e. on silence read as completeness. The April 28 record in this same batch is proof that inference fails on this vendor: an anno |

> status.openai.com/history and both community threads loaded. The date question the scope_notes flags as ±1 day is not something I can close without the X post, which is out of bounds; the Discourse relay timestamp (2026-05-16 10:25Z) and knightli's 05-17 publication are consistent with 05-16, and the status-page incidents on 05-13/05-14 fit the "last ~48 hours" phrasing. IMPORTANT for this record specifically: knightli.com is cited as evidence and contains "It may come from incident compensation, launch promotion, growth activity, or a backend policy update" — a class-level menu of reset cause

### `cx-2026-05-23-01`

Current: kind `global_reset`, trigger `incident_compensation`, confidence `reported`, windows `[weekly]`, plans `[all]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_windows` | **unsupported** | [] — or, if the drain evidence is admitted as evidence of what was refilled, ["5h","weekly"] with a note. Not ["weekly"] alone. | The sole evidence URL says "usage limits" with no window named anywhere in the post. Nothing supports "weekly" specifically. Worse, the companion thread — cited on cx-2026-05-16-01 but not on this record — shows the underlying drain hit BOTH windows: one user reports the "5-hour limit completely dra |

> Single evidence URL, loaded. Two bookkeeping discrepancies I noticed while verifying, outside the four graded fields but relevant to the record's provenance. (1) scope_notes says "Posted by Tibo (Codex team lead) at 8:14 PM"; in the cited thread the May 23 post is made by forum staff member VeitB relaying Tibo, and the Discourse timestamp reads 20:18, not 20:14. Tibo is the author of the quoted words but not of the cited post — worth stating that way since the URL is the provenance. (2) This record leans on one URL for everything; the sibling drain thread (community.openai.com/t/.../1380649) i

### `cx-2026-06-04-01`

Current: kind `global_reset`, trigger `incident_compensation`, confidence `confirmed`, windows `[weekly]`, plans `[paid subscribers (OpenAI staff wording), ChatGPT Pro, ChatGPT Plus]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_plans` | **unsupported** | ["paid subscribers (OpenAI staff wording)", "ChatGPT Pro"] — drop ChatGPT Plus, and add a scope_note that at least one Plus account is reported not to have received it. | The list mixes one supported and one contradicted member. "paid subscribers" is staff-asserted and correct. "ChatGPT Pro" is supported — the forum OP is on Pro at $100/month and did receive the reset. "ChatGPT Plus" is the problem: the only Plus-specific evidence in the entire record asserts the opp |
| `scope_partial` | **unsupported** | true | Contradicted by the record's own evidence. No cited source asserts the reset reached everyone; the staff quote states a population ("for paid subscribers") and a mechanic ("a fresh allocation, replacing the previous quota period") but never completeness. Meanwhile a cited GitHub issue exists specifi |

> All three evidence URLs loaded, plus status.openai.com/history as corroboration. Two scope_notes assertions I could not verify against the cited pages and would flag for correction. (1) scope_notes says the reset was explicitly "not a normal scheduled quota renewal" and presents it in quotation marks as staff wording — that phrase does not appear in the OpenAI_Support statement, which explains the early refill and date change without characterising it that way. It is a fair paraphrase but should not be quoted. (2) scope_notes says "The community and the openai/codex GitHub tracker both refer t

### `cx-2026-06-12-01`

Current: kind `banked_reset`, trigger `launch`, confidence `probable`, windows `[weekly]`, plans `[Go, Plus, Pro, Business]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_windows` | **generic** | leave scope_windows unset, or mark it as inferred rather than attested | THE TARGET DEFECT. Neither source says which window the BANKED reset restores. XDA describes Codex's two-tier limit structure as a general mechanism (5-hour short-term plus a weekly cap) and then says only 'Your usage goes back to 0' — silent on tier. The one 'weekly' sentence in the community threa |

> Both evidence URLs loaded. Strongest-sourced record in the batch: date, plans, expiry and referral window are all event-specific and double-sourced. The single defect is scope_windows, and it is the classic shape — a description of the mechanism Codex USED to have ('used to reset the weekly limits for all Codex users') promoted into a property of the new feature. Worth noting the direction of risk: XDA's only concrete window detail is about the FIVE-HOUR window, so if anything the generic material points away from 'weekly'.

### `cx-2026-06-28-01`

Current: kind `global_reset`, trigger `incident_compensation`, confidence `reported`, windows `[weekly, 5h]`, plans `[all paid]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_windows` | **generic** | ["weekly"] at most, or unset — drop "5h" | THE TARGET DEFECT, on the '5h' element especially. The source says 'usage-limit resets' without decomposing into windows. Its only mention of the 5-hour tier is descriptive background about how Codex budgets work ('budgets set aside for 5 hours of coding') — a class-level description of the limit st |

> Both evidence URLs loaded. The record's scope_notes warning is ACCURATE and should be preserved: the status page records no compensation whatsoever. But the warning slightly undersells the record — the press source does make a genuine event-specific compensation claim, so 'incident_compensation' here is NOT the same error as the 2026-07-12 known instance. This is a one-source claim, not a generic-to-specific promotion. Only scope_windows fails, and specifically its '5h' element.

### `cx-2026-07-09-01`

Current: kind `global_reset`, trigger `launch`, confidence `reported`, windows `[weekly]`, plans `[all paid plans]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **generic** | unset the trigger, or mark it inferred-from-cadence | THE TARGET DEFECT, round-up-pattern shape. This is a statement about a PATTERN across two vendors and many resets — 'far more frequently' — not a causal claim about the July 9 reset. minimaxir lists July 9 as a bare line item in 'OpenAI has directly reset the Codex weekly quota six times: July 9, Ju |
| `scope_plans` | **unsupported** | unset scope_plans | Nothing in any of the three sources supports it — this is weaker than generic, there is no class-level statement to lean on either. minimaxir speaks only from a single subscriber's vantage ('$20/mo Codex plan', later '$100/mo plan') and never states tier coverage for any of the six resets. ababnews  |
| `scope_partial` | **unsupported** | unset scope_partial | No source characterises the July 9 reset as full versus partial. The only quantified refill language in the corpus ('weekly 100%') belongs to July 12 in explainx's timeline — a DIFFERENT, nearby event. Asserting false here is back-projection of a neighbouring event's property, one of the enumerated  |

> All three evidence URLs loaded. This is the weakest record in the batch and the closest sibling of the known 2026-07-12 instance. Structural problem beyond the individual fields: TWO of three evidence URLs do not assert a July 9 reset at all, so the entire record rests on one comma-separated line item in a minimaxir list. That line item supports exactly one thing — that a weekly-quota reset occurred on July 9 — and every other field has been furnished from surrounding generic or neighbouring-event material. The scope_notes' claim that the trigger is 'the GPT-5.6 Sol / ChatGPT Work GA' is not a

### `cx-2026-07-10-01`

Current: kind `global_reset`, trigger `launch`, confidence `probable`, windows `[weekly]`, plans `[all paid plans]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_plans` | **unsupported** | unset scope_plans | None of the four sources names tier coverage for this reset. Tibo's own wording is 'across Codex and ChatGPT Work' — PRODUCTS, not plans; that is the sentence most likely to have been misread into 'all paid plans', since 'across' reads as breadth. the-decoder names no tiers; lapaasvoice refers vague |
| `scope_partial` | **unsupported** | unset scope_partial | explainx is explicit that 'July 10 specifics are not quantified'; its '100% refill' / 'weekly 100%' language belongs to July 12. No other source addresses full versus partial for July 10. Setting false imports a nearby event's measured property onto this one. |

> All four evidence URLs loaded. Better sourced than cx-2026-07-09-01: the reset itself is directly quoted from the announcer and independently carried by minimaxir, the-decoder, lapaasvoice and explainx. The two defects are the same pair as elsewhere in the batch — scope_plans and scope_partial — both furnished rather than attested. Note the two press sources disagree on MOTIVE (celebration versus damage control) while agreeing on occasion; the scope_notes assert both at once and should probably attribute each to its source rather than merging them.

### `cx-2026-07-11-01`

Current: kind `global_reset`, trigger `launch`, confidence `probable`, windows `[weekly]`, plans `[all paid plans]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_plans` | **unsupported** | unset scope_plans | Identical failure to its twin record. No source states tier coverage for either member of the pair; lapaasvoice offers only 'eligible users' / 'developers' / 'enterprise users', explainx's fable-5 piece carries no 'all paid plans' phrasing, and the announcement names products ('across Codex and Chat |
| `scope_partial` | **unsupported** | unset scope_partial | No source quantifies this reset at all. explainx's fable-5 timeline jumps straight from the July 10 announcement to the July 12 cap removal without characterising the second reset; the '100%' figures elsewhere in the corpus belong to July 12. Back-projected from a neighbouring event. |

> All four evidence URLs loaded. SEPARATE DEFECT WORTH RAISING, outside the four assigned fields: no cited source places any reset on July 11. minimaxir renders the second reset as 'July 10 (again)'; explainx's fable-5 timeline runs July 10 -> July 12 with no July 11 entry; the-decoder says 'twice in one day'; lapaasvoice says 'twice within 24 hours'. All four locate this event on July 10. The record's effective_at of 2026-07-11 rests on its own UTC conversion of a 05:54Z landing time, which the scope_notes explain transparently and which is sound reasoning — but it is the record's inference, no

### `cx-2026-07-12-01` — also cites an X-scraping tracker (§2 in scope)

Current: kind `banked_reset`, trigger `incident_compensation`, confidence `probable`, windows `[weekly]`, plans `[Codex and ChatGPT Work paid accounts (specific plan tiers not stated in any fetched source)]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **generic** | unstated — or 'feature_launch'/'milestone' if the codex-resets banked entry ('Added a banked reset to 500k users... Just released the ability to use a banked reset from web and mobile') is confirmed to be this event | Textbook instance of the target defect. This sentence is a claim about what resets ARE FOR as a class ("These model providers can... often gifted") — a capability statement, not an event report. minimaxir names July 12 only as a bare date: he writes that OpenAI gave quota resets on July 12 and 13 an |
| `scope_windows` | **generic** | weekly (low confidence) — flag as inferred from the class description of banked resets, not asserted of this grant | The 'weekly' window rests on the same class-level sentence that produced the bad trigger — it describes what providers can reset in general. No fetched source states of the 12 July BANKED grant specifically which window it replenishes; codex-resets.com's banked announcement text names no window, and |
| `scope_plans` | **generic** | Codex and ChatGPT Work accounts — plan tiers and paid/free status not stated in any fetched source | The field's own parenthetical concedes no source states the tiers, yet it still asserts 'paid accounts'. Nothing event-specific supports the paid qualifier: the candidate banked entry reads 'Added a banked reset to 500k users of ChatGPT Work and Codex' with no paid restriction, and minimaxir's class |
| `scope_partial` | **unsupported** | true, or null pending confirmation of which tracker entry is the 12 July banked grant | Nothing in the evidence asserts this grant reached the whole population, so scope_partial:false has no basis — and the single closest candidate text points the other way: a bounded 500k-user subset, which would make scope_partial TRUE. Contrast the 7M grant, which IS explicitly universal ('a banked  |

> This is the known instance, and the fetches confirm the operator's diagnosis exactly. NOT ONE of the five evidence URLs asserts an incident, outage, or glitch on 2026-07-12. Every event-specific source gives a DIFFERENT reason: explainx.ai attributes the day's announcement to a demand surge ("The last 48 hours of Codex and ChatGPT Work have been intense!"), nerdschalk/biggo/digitaltrends attribute it to the GPT-5.6 Sol launch and the co-stated 6M user figure, and community.openai.com thread 1386667 speculates the opposite direction ("It might be a side effect of OpenAI temporarily lifting the 

### `cx-2026-07-12-02`

Current: kind `global_reset`, trigger `milestone`, confidence `probable`, windows `[weekly, 5h]`, plans `[Plus, Business, Pro]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **generic** | demand_surge (GPT-5.6 Sol traffic) — with the 6M figure recorded as co-stated context, not as trigger | The 6M figure appears in the announcement but no source asserts it as the CAUSE. nerdschalk is explicit that Codex 'crossing roughly six million users' merely coincided with the timing and that no milestone was formally named as the trigger; biggo notes active users 'have reached 6 million' in the s |
| `scope_windows` | **unsupported** | ["weekly"] — with the 5-hour cap recorded separately as a removal, not a reset window | 'weekly' is supported — explainx states the weekly quota was 'Reset to 100%' for this event. But '5h' is not: every source describes the 5-hour window as REMOVED, not reset (nerdschalk 'Temporarily removing'; digitaltrends and biggo 'temporarily removed'; eesel 'the 5-hour rolling window was removed |

> The plan-tier scope here is genuinely well sourced — four independent outlets quote the same tier list — so this record is much stronger than cx-2026-07-12-01. The two problems are the trigger (a co-stated number read as a cause) and the inclusion of '5h' in scope_windows (a REMOVAL recorded as a RESET). Note that the record's own scope_notes correctly says the 5-hour cap was 'temporarily removed' while 'the weekly cap stayed in force' — so scope_windows contradicts its own notes.

### `cx-2026-07-14-01` — also cites an X-scraping tracker (§2 in scope)

Current: kind `global_reset`, trigger `milestone`, confidence `probable`, windows `[weekly]`, plans `[paid tiers — announced as "for all"; Plus/Pro/Business (Go also reported)]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_plans` | **generic** | all Codex and ChatGPT Work accounts — announced as "for all"; plan tiers not enumerated in any fetched source | The 'for all' half is verbatim and fine. The tier enumeration is not asserted of this event by any source, and explainx — the source it appears drawn from — says something else entirely in both sentences that name those plans: 'Sol stays in Go, Plus, and Pro' is about MODEL ACCESS, and 'weekly quota |

> Trigger, window and partial-flag are all solidly event-sourced; the single defect is the plan-tier enumeration. Two secondary observations. (1) The record's REASONING for scope_windows — that the 5-hour window is out of scope because the cap had already been removed on 07-12 — is an inference, but the weekly conclusion is independently supported by GitHub issue 33344, so the field survives on better evidence than its own rationale. Worth noting because codex-resets.com's summary view labels the 8M row '5h rate limit lifted' rather than weekly, i.e. the tracker's own metadata is internally inco

### `cx-2026-07-15-01` — also cites an X-scraping tracker (§2 in scope)

Current: kind `global_reset`, trigger `milestone`, confidence `probable`, windows `[weekly]`, plans `[paid tiers — Codex + ChatGPT Work users; Pro confirmed by a first-hand report]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_plans` | **generic** | all Codex and ChatGPT Work users (announced scope); Pro observed first-hand — paid/free boundary not stated by any source | The announcement says 'our Codex and ChatGPT Work users' with NO paid qualifier, and codex-resets.com's own scope field for the 9M entry reads 'all', not 'paid'. The 'paid tiers' framing appears back-projected from the adjacent 10M entry, which is the one that says 'New day, new usage reset for paid |
| `scope_partial` | **generic** | null or unknown — no source asserts universal application for this event; contemporaneous non-receipt reports across Pro and Business | This phrasing is broad but does not assert universality the way the 8M announcement's 'for all' or the 7M grant's 'everyone's account' do — and those are the neighbouring events the false flag appears inherited from. No source states of the 9M reset that it reached every account. Community thread 13 |

> Trigger and window are well sourced from the announcement text; the two scope fields are where inheritance from neighbouring events shows. A material conflict the record should capture: community thread 1387097 attributes the reset users were chasing on July 15-16 to 'Codex reaching 8 million users' — i.e. a source disagrees about which milestone this event belongs to. That thread also supplies the cleanest banked-vs-immediate evidence: OpenAI's own clarification there distinguishes 'global or hard resets' (immediate, do not appear as saved credits) from 'saved or banked resets' (appear as ava

### `cx-2026-07-17-01` — also cites an X-scraping tracker (§2 in scope)

Current: kind `global_reset`, trigger `courtesy`, confidence `probable`, windows `[weekly]`, plans `[all paid users of Codex and ChatGPT Work]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **unsupported** | unknown | This is the wording the record's own scope_notes leans on to justify "courtesy", but codexreset.org prints it as the reason for the Jul 18 03:28 UTC row — a different event, one day later, which this batch already has as its own record. No source states any reason for a July 17 reset: minimaxir list |
| `scope_plans` | **unsupported** | [] (empty — no source states plan coverage for this date) | Textbook back-projection. This string is lifted verbatim from the codexreset.org Jul 18 03:28 UTC row ("reset usage limits for all paid users for Codex and ChatGPT Work") and re-dated to July 17. No source says anything about plan coverage for a July 17 event; minimaxir names only the author's own t |
| `scope_partial` | **generic** | false, but flagged unevidenced (no source states magnitude for this date) | Nothing describes the July 17 reset's magnitude — minimaxir supplies only the date. scope_partial=false can only be resting on minimaxir's class-level description of what these resets are ("These model providers can reset the weekly quota for all users..."), which is the very sentence family that pr |

> This is the batch's clearest instance of the sweep's failure mode, in its back-projection form. The whole record is built by borrowing the Jul 18 03:28 UTC announcement. Neither reset tracker has ANY July 17 entry: I asked codexreset.org directly and its timeline runs Jul 16 04:14 -> Jul 18 03:28 -> Jul 21 17:47 -> Jul 25 19:17; codex-resets.com likewise shows no July 17 row. The event's ONLY attestation is minimaxir naming "July 17" in a bare list of dates with an X link I did not fetch. Two evidence URLs add nothing event-specific: the HN item (id 48963465, 429 on the web path, retrieved via

### `cx-2026-07-18-01` — also cites an X-scraping tracker (§2 in scope)

Current: kind `global_reset`, trigger `unknown`, confidence `reported`, windows `[weekly]`, plans `[all paid]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `trigger` | **generic** | Keep trigger=unknown; strike the 9M-milestone sentence from scope_notes | The field value "unknown" asserts nothing, but scope_notes says the event is "Tied to the 9-million combined-active-user milestone" and grounds it in Altman "promising a reset every million users up to 10M". That promise is a class-level cadence rule; using it to assign this event a cause is cadence |
| `scope_windows` | **generic** | _(none offered)_ | I checked the Jul 18 03:28 UTC row specifically for window language: it contains no "weekly", no "100%", and no 5-hour reference — only an unqualified "reset usage limits". minimaxir's six-reset weekly list does not include July 18. So "weekly" is inherited from the class fact that Codex global rese |

> The trigger field itself is honest ("unknown"), but the milestone attribution is smuggled into scope_notes, so the record still carries the claim. Two separate problems there: the 9M tie is on the wrong date (codexreset.org puts "9M active users hard reset" on Jul 16 04:14, and biggo dates the 9M announcement to July 16 — this batch's own 07-16 record already claims it), and the justification offered is a cadence rule rather than an observation. Also note a fetch-reliability caveat that affects this record and 07-21: across four reads of codexreset.org the small extraction model paired reason 

### `cx-2026-07-21-01` — also cites an X-scraping tracker (§2 in scope)

Current: kind `global_reset`, trigger `milestone`, confidence `reported`, windows `[weekly]`, plans `[all paid]`, partial `false`.

| field | verdict | proposed | justification |
|---|---|---|---|
| `scope_windows` | **generic** | _(none offered)_ | Round-up-pattern form of the defect. "As each milestone landed" is a statement across many events, and the record's single event inherits its properties. Worse for the weekly claim specifically: unite.ai's only window-level detail points the other way — it names "the five-hour rate cap off for Plus, |

> trigger survives mainly because unite.ai independently dates the milestone; the window claim does not. Reliability caveat carried over from 07-18: across four reads codexreset.org paired "10M!" to Jul 21 in two and to Jul 18 in two, and in two reads labelled the Jul 21 17:47 row "Global Codex compensation reset" rather than a milestone reset. There is a live alternative reading in which Jul 21 is an outage-compensation entry — though the tracker also carries a distinct outage row at Jul 25 19:17 ("Last night around 2am to 4am we suffered an almost global outage"), which is the better home for 

---

## Rejected suggestions

| record | field | sweep said | rejected because |
|---|---|---|---|
| `cc-2026-03-13-01` | `scope_partial` | `true` | The restriction is temporal (off-peak hours), not per-account. Under the fixed predicate, `partial` tracks account coverage only. Stays `false`; the time restriction is already in `scope.notes`. |

## Execution order, once signed

1. Apply the §2 amendment text (no records touched).
2. Rule on the 500k admissibility coupling above.
3. Generate superseding records for every accepted field change, each carrying a `links` entry of
   relation `supersedes`… **note: that relation does not exist yet.** The current enum is
   `conflicts_with` / `same_announcement_as` / `related_to`, and `superseded_by` is a scalar on the
   old record. This is sufficient — the old record's `superseded_by` is the link — but flagging it so
   the mechanism is agreed rather than assumed.
4. Backfill `effects[]` on the records where a second primitive is evidenced (D3).
5. Rebuild `public/`, run the suite, single commit.

**Nothing above happens without your signature on this document.**
