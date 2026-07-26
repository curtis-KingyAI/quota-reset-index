# MIGRATION PLAN v2 — verified

**Status: DRAFT, awaiting operator signature. NOTHING TOUCHED.**
Supersedes MIGRATION-PLAN-01. v1's proposals went through one adversarial pass before any record
moved, per operator instruction 2026-07-26.

---

## Running the verification was the right call, and here is the number that proves it

| | count |
|---|---|
| Proposals in v1 | 41 |
| **Confirmed — flag right, value right** | **20** |
| Flag right, **proposed value wrong** | 10 |
| **Flag wrong — the original value was fine** | **11** |
| **Would have been written incorrectly** | **21 of 41 (51%)** |

Had v1 been signed as drafted, **21 of 41 changes would have gone into the ledger wrong** — 11 of them
"correcting" values that were already right, and 10 replacing a real defect with a different
unsupported claim. That second category is the dangerous one: it launders a defect into a
correction and leaves the record *looking* audited.

### Why 11 flags failed

Nine of the eleven are the same mistake, and the fixed `scope.partial` predicate is what exposed it.
The sweep repeatedly read `partial: false` as needing positive evidence of universality. Under the
predicate, **FALSE is a claim about the evidence** — the absence of any account-restriction statement
is exactly what licenses it. Demanding proof of universality inverts the field. Pinning the predicate
before verifying, rather than after, is what caught this.

---

## ⚠️ TWO STRUCTURAL DEFECTS THE VERIFIERS FOUND UNPROMPTED

Neither was in scope. Both are worse than anything in the field-level list, and **both must be
resolved before any supersession**, because superseding around them entrenches them.

### 1. `cx-2026-07-17-01` and `cx-2026-07-18-01` are the SAME EVENT

Both trace to X post `2078320950488297917`. Decoded offline — verified independently by me:

    2078320950488297917  ->  2026-07-18T03:28:22Z  =  2026-07-17 20:28 US-Pacific

`minimaxir` dates in **Pacific** and labels it "July 17". `codexreset.org` dates in **UTC** and
files it under "Jul 18". Two ledger records, one announcement.

The convention is now proven across all ten cited post IDs — every minimaxir label maps to its UTC
decode at exactly UTC-7. **This also retrospectively confirms the 07-10/07-11 split is correct**:
those are two genuinely distinct post IDs (`…700120` at 07-10T17:59Z and `…274448` at 07-11T05:54Z),
which is why minimaxir calls them "July 10" and "July 10 (again)" — both are July 10 in Pacific.
The ledger keys by UTC. That is the right choice and should be stated explicitly somewhere public.

**Decision needed:** merge the two records (one supersedes the other), or keep both and link them
`same_announcement_as`. I recommend **merge** — they are not two events.

### 2. `cx-2026-07-21-01`'s locator is broken, and the record may not stand up

The tracker row labelled "Jul 21, 17:47 UTC" cites post `2081096447718723984`. Decoded:

    2081096447718723984  ->  2026-07-25T19:17:12Z

Four days later than its own label — and the tracker lists that same ID **again** under its own
"Jul 25" row. The Jul 21 anchor is a mislabelled duplicate of a July 25 post.

Under the now-adopted §2 the tracker was only ever admissible as a **locator**, and here it fails
even at that. That leaves `cx-2026-07-21-01` resting on **unite.ai alone** — which is the single URL
in the whole ledger that returns 403 to a plain client.

**Decision needed:** re-anchor the record on an admissible source, or supersede it to
`confidence: "reported"` with the tracker citation struck. I recommend **re-anchor, and if that
fails, supersede downward**. Do not leave it as-is.

---

## Accepted changes: 30 across 20 records

### `cc-2026-05-13-01`

Current: trigger `courtesy`, windows `[weekly]`, plans `[Pro, Max, Team, legacy seat-based Enterprise]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `trigger` | `competitive_response` | `attested` | Flag confirmed on full re-read: the article contains no courtesy, goodwill, thank-you, apology, incident or outage language anywhere. 'Courtesy' is a reader's gloss on the loyalty maxim, and the maxim is second-person and class-level, so the sweep's diagnosis  |

### `cc-2026-06-02-01`

Current: trigger `incident_compensation`, windows `[]`, plans `[Pro, Max]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_partial` | `true` | `attested` | Both the flag and the replacement are correct, and Rule A resolves the schema question the sweep flagged as its 'only escape'. The predicate is TRUE iff an admissible source states the grant reached only some of the accounts otherwise inside scope.plans — 'a h |

### `cc-2026-07-09-01`

Current: trigger `unknown`, windows `[5h, weekly]`, plans `[all users (Pro, Max, Team, seat-based Enterprise)]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_plans` | `["all users"]` | `attested` | Flag confirmed and the replacement is exactly the sourced wording. I checked all four of this record's evidence URLs and none enumerates plan tiers for the July 9 reset. implicator quotes the announcement as 'We've reset 5-hour and weekly rate limits for all u |

### `cc-2026-07-13-01`

Current: trigger `courtesy`, windows `[weekly]`, plans `[Pro, Max, Team, legacy seat-based Enterprise]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `trigger` | `unknown` | `attested` | Verified against the source: helpnetsecurity gives no reason, motive, or cause for the extension. I probed specifically for goodwill/thank/courtesy/apology/compensation/demand/capacity/feedback/popularity and the fetch returned an explicit negative — 'No reaso |

### `cx-2026-04-01-01`

Current: trigger `capacity`, windows `[weekly]`, plans `[all paid]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `trigger` | `unknown` | `attested` | Flag confirmed on the strongest possible footing: the source does not merely omit a cause, it affirmatively disclaims one. Tibo's post reads 'Our Codex dashboards are showing increased rate of users hitting rate limits and since we don't fully understand why I |
| `scope_windows` | `[]` | `attested` | Flag confirmed. No post in the thread ties a window to the reset. The originating post says only 'March 27 and April 1st we have had CODEX Credits reset', and Tibo says 'resetting the usage limits for all plans' — plans are named, windows are not. I checked ev |
| `scope_plans` | `["all plans"]` | `attested` | Flag is right and the replacement is the asserted wording. The forum thread carries a first-party, event-specific statement from Tibo (Codex lead), quoted by VeitB at 8:28pm on 1 April in the thread about that very reset: he names the decision and its scope in |

### `cx-2026-04-28-01`

Current: trigger `courtesy`, windows `[5h]`, plans `[Plus, Pro, Business, Enterprise]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_windows` | **UNESTABLISHED** | `unestablished` | The flag is solidly confirmed — I reproduced the sweep's negative result independently across all four sources. Forum thread 1379921: on full-thread fetch, 'No mentions of "5-hour," "5h," "hourly," or "weekly" exist in the thread' and 'No post specifies which  |
| `scope_plans` | `["all paid plans"]` | `attested` | Both halves hold, and the source itself adjudicates the flag. On targeted re-query aitopic confirmed the enumeration belongs to a different claim: the sentence 'now available to users across Plus, Pro, Business, and Enterprise tiers' — in aitopic's own words — |
| `scope_partial` | `true` | `attested` | Flag and replacement both hold under the fixed predicate. I fetched issue #20395 and it is real (closed, opened 2026-04-30 by jjoanna2-debug, titled 'Clarify Codex rate-limit reset behavior and make reset scope visible in Usage UI', reporter on Plus, macOS). T |

### `cx-2026-05-23-01`

Current: trigger `incident_compensation`, windows `[weekly]`, plans `[all]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_windows` | `[]` | `attested` | The flag is correct: I read thread 1381065 in full and the May 23 post (VeitB relaying Tibo, 12:53pm; Tibo's post 8:14pm) says only '...we have now reset usage limits for all accounts. Enjoy the weekend.' No window is named anywhere in the thread — my fetch re |

### `cx-2026-06-04-01`

Current: trigger `incident_compensation`, windows `[weekly]`, plans `[paid subscribers (OpenAI staff wording), ChatGPT Pro, ChatGPT Plus]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_plans` | `["paid subscribers (OpenAI staff wording)", "ChatGPT Pro"]` | `attested` | Both the flag and the replacement are right, and the replacement is correctly conservative on each member. 'paid subscribers (OpenAI staff wording)' is directly staff-asserted: Mark G. in thread 1382610 says 'The Codex team performed a manual reset for paid su |
| `scope_partial` | `true` | `attested` | TRUE is correct under the fixed predicate. Issue #27027 does not merely report one unhappy user; it states a differential across accounts — one account inside scope did not receive the grant while others did, evidenced by divergent reset dates ('My weekly rese |

### `cx-2026-06-12-01`

Current: trigger `launch`, windows `[weekly]`, plans `[Go, Plus, Pro, Business]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_windows` | **UNESTABLISHED** | `unestablished` | Flag and replacement both confirmed. The community thread's single 'weekly' sentence is unambiguously past-tense and describes the superseded ad-hoc gift-reset regime that this feature replaced — the passage's whole rhetorical structure is old-system versus ne |

### `cx-2026-06-28-01`

Current: trigger `incident_compensation`, windows `[weekly, 5h]`, plans `[all paid]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_windows` | **UNESTABLISHED** | `unestablished` | The flag is right and the sweep's reading of the 5-hour mention is exactly right — 'budgets set aside for 5 hours of coding being consumed by only a few prompts' is a description of the SYMPTOM users reported, not of what the reset restored. The status page is |

### `cx-2026-07-09-01`

Current: trigger `launch`, windows `[weekly]`, plans `[all paid plans]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `trigger` | **UNESTABLISHED** | `unestablished` | Flag confirmed on all three sources. minimaxir lists July 9 as a bare dated line item with a post link and no per-date cause; its 'far more frequently' sentence is a two-vendor cadence observation, not causation for any single reset. explainx is worse for the  |
| `scope_plans` | **UNESTABLISHED** | `unestablished` | Flag and replacement both hold. I checked all three cited sources verbatim and none states plan coverage for a July 9 Codex reset. minimaxir's only class-level line is modal and generic — 'These model providers CAN reset the weekly quota for all users' — a sta |

### `cx-2026-07-10-01`

Current: trigger `launch`, windows `[weekly]`, plans `[all paid plans]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_plans` | `["paid tiers"]` | `attested` | The flag's CONCLUSION is right but its stated REASON is false, and the replacement overcorrects. The sweep asserts no source names tier coverage for this reset. That is falsified by explainx's fable-5 piece, whose 'Side-by-side — reset mechanics' table gives a |

### `cx-2026-07-11-01`

Current: trigger `launch`, windows `[weekly]`, plans `[all paid plans]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_plans` | `["paid tiers"]` | `attested` | Flag's conclusion right, its reason wrong, replacement overcorrects — and here the contradiction is sharper than on the twin, because the source that refutes the sweep IS this record's own first-listed evidence. The sweep says 'No source states tier coverage f |

### `cx-2026-07-12-01`

Current: trigger `incident_compensation`, windows `[weekly]`, plans `[Codex and ChatGPT Work paid accounts (specific plan tiers not stated in any fetched source)]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `trigger` | **UNESTABLISHED** | `unestablished` | The flag is correct and I confirmed it by fetching. minimaxir's ONLY sentence touching this event is a bare dated mention with no cause: 'OpenAI gave quota resets [July 12] and [July 13] which can be manually used at any time but expire within 30 days.' The 'c |
| `scope_windows` | **UNESTABLISHED** | `unestablished` | The flag is right, and the evidence against 'weekly' is stronger than the sweep realised. minimaxir separates the two categories explicitly and by date: he enumerates the direct weekly-quota resets as six events — 'In the past two weeks, OpenAI has directly re |
| `scope_plans` | `["Codex — no admissible source states plan tiers, paid/free status, or ChatGPT Work covera` | `attested` | The flag is right — the 'paid' qualifier is unsourced for this grant, and the field's own parenthetical already concedes the tiers are unstated. But the replacement keeps 'Codex and ChatGPT Work', and that half of the value has no admissible event-specific sou |

### `cx-2026-07-12-02`

Current: trigger `milestone`, windows `[weekly, 5h]`, plans `[Plus, Business, Pro]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_windows` | `["weekly"]` | `attested` | Flag and replacement both hold. Every fetched source describes the 5-hour window as LIFTED, not refilled: nerdschalk carries both the announcement text ('Temporarily removing the 5 hour usage limit restriction for all Plus, Business and Pro plans') and its own |
| `trigger` | `demand_surge (GPT-5.6 Sol traffic surge, per nerdschalk/eesel/explainx); 6M active users r` | `attested` | Both halves hold. The flag is right: no source asserts the 6M figure as the cause. nerdschalk presents it as coincident timing observed by third parties — 'Community developers noted the timing lined up with Codex crossing roughly six million users' — and bigg |

### `cx-2026-07-14-01`

Current: trigger `milestone`, windows `[weekly]`, plans `[paid tiers — announced as "for all"; Plus/Pro/Business (Go also reported)]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_plans` | `announced as "for all" — Codex and ChatGPT Work; no source enumerates plan tiers as recipi` | `attested` | The flag is confirmed by the very source the enumeration was drawn from. explainx reproduces the announcement as 'We have reached 8M active users across Codex and ChatGPT Work. We are once again resetting the usage limits for all,' and on targeted re-query con |

### `cx-2026-07-15-01`

Current: trigger `milestone`, windows `[weekly]`, plans `[paid tiers — Codex + ChatGPT Work users; Pro confirmed by a first-hand report]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_plans` | **UNESTABLISHED** | `unestablished` | The flag is right — 'paid tiers' is back-projected from the adjacent 10M entry and no source draws a paid/free line for this event. But the replacement fails Rule B, and this is the case-2 trap. The proposed value's load-bearing element is the announced scope, |

### `cx-2026-07-17-01`

Current: trigger `courtesy`, windows `[weekly]`, plans `[all paid users of Codex and ChatGPT Work]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `trigger` | **UNESTABLISHED** | `unestablished` | The conclusion is right and the value is right, but the sweep's central reasoning is FACTUALLY WRONG and the ledger should not act on it as stated. The sweep says the 'Oops... I did it again' wording belongs to 'a different event, one day later, which this bat |
| `scope_plans` | `["paid users of Codex and ChatGPT Work"]` | `attested` | The flag's stated rationale is factually wrong, but a smaller real defect survives — and the proposed remedy would destroy a well-sourced fact. NOT a back-projection. minimaxir's 'July 17' hyperlink points to X post 2078320950488297917. Decoded offline, (20783 |

### `cx-2026-07-18-01`

Current: trigger `unknown`, windows `[weekly]`, plans `[all paid]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `trigger` | `unknown (ledger token for no cause stated by any admissible source); additionally strike t` | `attested` | Both halves of the proposal are right, and the ground is firmer than the sweep realised. trigger='unknown' is correct. note.com describes this exact announcement and supplies no cause — the post's content is a lighthearted 'I did it again', a statement that li |

### `cx-2026-07-21-01`

Current: trigger `milestone`, windows `[weekly]`, plans `[all paid]`, partial `false`

| field | final value | `field_support` | why |
|---|---|---|---|
| `scope_windows` | **UNESTABLISHED** | `unestablished` | The flag is right and the empty value is right — but two strands of the sweep's reasoning are wrong and must not be carried into the ledger, because each would license a future error. The conclusion holds. unite.ai is the only admissible (non-mirror) source on |

---

## Rejected — do NOT change these 11 fields

The original values are correct. Listed so the same flags are not re-raised by a future audit.

| record | field | keep | why the flag failed |
|---|---|---|---|
| `cc-2026-07-18-01` | `scope_partial` | `false` | The flag is wrong under Rule A, and it is wrong in a way that matters: the sweep's stated reasoning is verbatim the reading Rule A overturns. The sweep argues 'Neither July 18 source asserts that ever |
| `cx-2026-07-15-01` | `scope_partial` | `false` | The current value false is correct and must stand. The sweep's argument is 'No source states of the 9M reset that it reached every account... false is an inherited default rather than a sourced fact'  |
| `cc-2026-03-13-01` | `scope_partial` | `false` | The sweep's own CAVEAT is now resolved against it by the fixed predicate. Everything the sweep cites is a restriction on WHEN the doubling applied (peak-hours carve-out on weekdays, all-day at weekend |
| `cc-2026-05-15-01` | `scope_plans` | `["Pro","Max","Team","Enterpris` | The flag's central premise is falsified by the record's own first evidence URL. The sweep asserts 'no source applies that narrowing to the May 15 reset' and blames back-projection from verdent. But pa |
| `cx-2026-05-16-01` | `scope_partial` | `false` | The flag is wrong, and it is wrong for exactly the reason Rule A was fixed to settle. The sweep's own words are 'scope_partial=false rests entirely on the announcement being unqualified — i.e. on sile |
| `cx-2026-07-09-01` | `scope_partial` | `false` | The flag applies the OLD reading of 'partial' and is invalid under the now-fixed predicate. Rule A: FALSE means no admissible source states an account-level restriction; it is a claim about the eviden |
| `cx-2026-07-10-01` | `scope_partial` | `false` | Same defect as its sibling: the flag is built on the superseded reading of 'partial'. Under fixed Rule A, FALSE asserts only that no admissible source states an account-level restriction — so the swee |
| `cx-2026-07-11-01` | `scope_partial` | `false` | Third instance of the same superseded reading. Under fixed Rule A the sweep's premise — 'No source quantifies this reset at all' — is the very condition that makes FALSE correct. Its observation that  |
| `cx-2026-07-17-01` | `scope_partial` | `false` | Under the now-fixed predicate, false is exactly correct and needs no positive support. Rule A: scope_partial is TRUE iff an admissible source states the grant reached only SOME of the accounts otherwi |
| `cx-2026-07-18-01` | `scope_windows` | `["weekly"]` | 'weekly' is asserted of this exact event by an admissible, explicitly-not-a-mirror source. The flag is a string-matching artifact. minimaxir: 'In the past two weeks, OpenAI has directly reset the Code |
| `cx-2026-07-12-01` | `scope_partial` | `false` | The original value false is correct and must stand. Under the now-fixed predicate, false means 'no admissible source states an account-level restriction' — it is a claim about the evidence, not an ass |

---

## Execution, once signed

1. Resolve the two structural defects above. **They come first** — superseding the duplicate pair
   independently would bake a one-event-two-records error into the permanent history.
2. Write 30 field changes as superseding records across 20 records. Each new record carries
   `field_support` on every enrichment field, so the provenance is explicit from here on.
3. Fields resolving to UNESTABLISHED use the new states: `trigger: "unknown"`, arrays `[]`,
   `scope.partial: null` — each with `field_support: "unestablished"`. The validator enforces
   that pairing, so a record cannot claim a value and disclaim it at once.
4. Old records get `superseded_by`; nothing is edited in place, nothing is deleted.
5. Rebuild `public/`, run the suite, single commit.

Ledger goes from 29 to approximately 49 records.

**Nothing above happens without your signature.**
