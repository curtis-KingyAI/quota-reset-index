# Operating this ledger

**Decision, 2026-07-27 (operator): OPERATE it.** Not a snapshot. Events get recorded as they happen,
the corpus grows, and calibration eventually unblocks.

This file is the loop. [`RUNBOOK.md`](RUNBOOK.md) is how to write a record once you have one; this is
**when to look, where, and what to do when you find nothing** — which is most of the time, and is the
part that was never written down.

---

## What the decision actually commits to

Not "keep it perfect". Two things:

1. **Look at least every 21 days**, and record that you looked.
2. **Let the site tell the truth if you stop.**

The second is the important one, and it is why this file exists rather than just a calendar reminder.
`STATUS.md` named the failure mode before the decision was taken: *a stale index that looks live is
strictly worse than either option chosen deliberately.* **Choosing to operate does not remove that
risk — it creates it.** So the honesty is built into the page rather than promised here.

## The freshness signal, and why the thresholds are what they are

Every page shows *"Last reviewed …"*, computed **in the reader's browser against their own clock**, so
it cannot go quietly stale the way a build-time string would. It escalates by itself:

| age of last review | what the reader sees |
|---|---|
| under 21 days | quiet grey line: *"Last reviewed 3 days ago."* |
| **21 days** | warning: longer than the longest gap between Codex resets on record |
| **45 days** | strong warning: *"may no longer be maintained. Treat it as a snapshot."* |

**Both thresholds are measured, not chosen.** From the current corpus:

| vendor | resets | median gap | longest gap ever observed |
|---|---|---|---|
| codex | 19 | 2.9 d | **20 d** |
| claude-code | 4 | 22 d | **37 d** |

21 sits just past Codex's observed maximum, so it can never fire on a quiet period the vendors have
actually produced. 45 clears both maxima with margin. A test asserts both still exceed the real
maxima, and a second test **re-derives the maxima from the ledger** — so if the corpus grows and the
gaps change, the build tells you to re-justify the thresholds instead of letting them rot.

⚠️ The Claude Code figure rests on **three gaps**. Treat it as indicative.

## Cadence

**Weekly is the target; 21 days is the hard limit.** Codex's median gap is under three days, so a
weekly sweep catches essentially everything while it is still fresh enough to source. The 21-day
threshold is the point at which the site starts warning readers, not the goal.

```bash
npm run sweep -- --check
```

Exits non-zero when overdue, so it can back a reminder.

### The scheduled reminder — registered, not rogue

**Created 2026-07-27 on explicit operator instruction.** The 2026-07-12 automation freeze means wiring
a timer is an operator decision, never an agent's own initiative; this one was asked for. Recorded here
so a later audit can identify it rather than flag it as unexplained automation.

| | |
|---|---|
| routine | **Quota Reset Index — weekly sweep** |
| id | `trig_01NWrCc74W8qXJcimeDQtrb3` |
| schedule | `0 16 * * 1` — Mondays 16:00 UTC = **09:00 America/Vancouver** |
| runs | a **cloud** session, `claude-sonnet-5` |
| repo checkout | **none.** No GitHub authorization is required or held |
| reads | `https://ledger.kingy.ai/ledger.json` and `raw.githubusercontent.com/…/operations/sweeps.jsonl` |
| tools | `Bash`, `WebFetch`, `WebSearch` |
| manage | <https://claude.ai/code/routines/trig_01NWrCc74W8qXJcimeDQtrb3> |

It does the read-only research pass above and **reports**. It is forbidden from writing to `ledger/`,
recording a sweep, or committing — it has no repository, no credentials, and no `Write` or `Edit` tool.
A human rules on every candidate and runs `--record` themselves.

#### ⚠️ It has NO checkout, and that was a deliberate correction

The first version cloned the repo. Its very first run was rejected outright:

```
HTTP 400  github_repo_access_denied
"GitHub repository access check failed — re-authorize GitHub in settings"
```

**Do not "fix" this by adding the git source back.** The account has no GitHub App installed and no
OAuth app authorized, so the clone cannot succeed, and the failure happens *before the session starts*
— meaning it would have failed silently every Monday with nothing to notice. Granting a GitHub App
standing repository access purely to power a reminder is a poor trade when the same data is already
public.

So it reads the **published** endpoints instead, which needs no authorization at all. Both were
verified unauthenticated before the switch. There is a pleasing consequence: the reminder now consumes
this project's own CORS-open data endpoint exactly as any third party would, so if `/ledger.json` ever
breaks, the reminder breaks too and you find out.

**What that costs, and how it is compensated.** Without a checkout it cannot run
`npm run sweep -- --check`, so it recomputes `lastReviewed` and the 21/45-day status itself. The prompt
therefore requires it to **print all three values and the subtraction** rather than assert a verdict —
the arithmetic is checkable in the report instead of trusted. The Snowflake decode is inlined in the
prompt for the same reason, since `lib/snowflake.mjs` is not there and id-decoding is the discipline
that catches the trackers mislabelling their own rows.

⚠️ **It reads what is PUSHED, not your laptop.** Sweep locally without pushing and it will still nag
you — correctly, since an unpushed sweep is not part of the public audit trail.

⚠️ **It cannot delete itself and neither can an agent.** Disable or remove it at the link above.

## Ownership — §11.3

**The operator owns running this.** An agent may run a sweep when asked, and doing so is a good use of
one: the discipline is mechanical and the admissibility rules are written down. What an agent must not
do is *decide* to schedule it, or promote a candidate without a human ruling.

---

## The sweep

### 1. Where to look, in order

| source | good for | do NOT use it for |
|---|---|---|
| [status.openai.com/history](https://status.openai.com/history) | incidents that would motivate a compensation reset; **negative findings** | the reset itself — a status page records outages, not grants |
| [status.anthropic.com](https://status.anthropic.com) | same, Anthropic side | same |
| `community.openai.com` | **first-hand dated reports** — the most-cited source here, 14 of 86 | second-hand relays of an X post |
| press (`unite.ai`, `the-decoder.com`, `minimaxir.com`, …) | event-specific substance | `confirmed` — press relaying an X post is `press`, never a vendor post |
| `capture/` (`npm run capture:detect`) | a tripwire that *your own* quota moved | any claim that a vendor granted anything |
| `social/` (`npm run social:poll -- --show`) | the @thsottiaux / @ClaudeDevs signal, if a token is set | it is **log-only** and feeds no published number |
| reset trackers (`codexreset.org`, `codex-resets.com`, `codexresets.com`) | **locating** a post: that one exists, which id, roughly when | **substance — prohibited.** They are mirrors |

**The mirror rule is the one that will tempt you.** A tracker will render a reset announcement in
clean prose with a date beside it. Under [RUNBOOK §2](RUNBOOK.md) that is *substance from a mirror* and
inadmissible, however plainly it reads and however many trackers agree — they copy the same upstream,
so agreement is one source counted twice.

What a mirror *can* give you is a **post id**, and an id decodes to its own creation instant by
arithmetic:

```bash
node -e "import('./lib/snowflake.mjs').then(m=>console.log(m.decodePostId('2081096447718723984')))"
```

That is not testimony and does not require trusting whoever showed it to you. **Use it on every
contested date** — trackers here have mislabelled their own rows repeatedly.

### 2. Record the sweep, whatever you found

Write a JSON file and hand it over:

```bash
npm run sweep -- --record /tmp/sweep.json
```

```json
{
  "swept_at": "2026-08-03T09:00:00Z",
  "by": "curtis",
  "vendors": ["codex", "claude-code"],
  "period_from": "2026-07-27",
  "sources": [
    { "url": "https://status.openai.com/history", "outcome": "read", "note": "no incidents in the window" },
    { "url": "https://jawlah.co/en/59491", "outcome": "blocked", "note": "403 again — try a browser" }
  ],
  "records_added": 0,
  "candidates": 0,
  "notes": "what you concluded, and why"
}
```

`swept_at` must be **UTC and Z-suffixed** — the validator enforces it, because this project has got
that wrong twice, once in the ledger and once in a *correction* to a comparison page.

**The four outcomes carry real weight. Do not collapse them:**

- `read` — you read it and it addresses the period. A clean negative here is a genuine finding.
- `no-coverage` — you read it, it says nothing about the period.
- `blocked` — **you could not read it at all** (403, 402, login wall). This is *not* evidence of
  absence, and recording it as one is how a real event becomes a silent gap.
- `inadmissible` — you read it, and §2 forbids using it. Mirrors carrying substance land here.

A sweep is **not an event.** It carries no vendor scope, no confidence grade and no `evidence[]`, and
nothing in `scripts/sweep.mjs` can write to `ledger/`. It is provenance for the *process*; the ledger
is provenance for the *claims*.

### 3. If you found something

Go to [`RUNBOOK.md`](RUNBOOK.md) and follow it properly — establish the UTC date first, then ask the
§3 question for every enrichment field. Then `npm run build`, so the site reflects it.

### 4. If you found nothing

You are still finished. Record the sweep. **That is the whole point:** without it, "nobody looked" and
"nothing happened" are the same shape, and the claim to be operated is unfalsifiable.

---

## Open leads

### ⚠️ A probable unrecorded Codex reset on 2026-07-25

Found on the first sweep and **deliberately not recorded.** A @thsottiaux post — id
`2081096447718723984`, decoding to **2026-07-25T19:17:12Z** — is reported by trackers as: *"We have
reset usage limits for all Codex and ChatGPT Work users. Last night around 2am to 4am we suffered an
almost global outage."*

The substance is mirror-only, so under §2 there is no record. Every non-mirror avenue was tried:

| source | outcome |
|---|---|
| the X post itself | **HTTP 402** — unreadable |
| `jawlah.co/en/59491` ("OpenAI fixes bug that drained Codex usage limits") | **HTTP 403** — unreadable, and looks like it carries exactly the needed substance |
| `explainx.ai` | last updated 07-24; nothing after 07-21 |
| `community.openai.com` (the non-banked-reset thread) | its 07-25 post discusses *earlier* resets; no outage mentioned |
| `status.openai.com/history` | **no incident between 02:00 and 04:00 UTC on 07-25** — the vendor's own page does not corroborate the outage the mirror describes |

**To close it, someone needs to open `jawlah.co/en/59491` in a browser**, or find any non-mirror source
that states the reset of that date. If nothing does, it stays unrecorded — which is the correct
outcome, not a gap to be papered over.

**And note the loose end it exposes.** Migration 02 correctly *struck* post `2081096447718723984` from
`cx-2026-07-21-02` because it decodes four days later. The strike was right. **Nobody then recorded the
07-25 event it belongs to** — so a correct correction left a real event on the floor. Worth checking
for the same shape elsewhere: a struck citation is a signal that an event exists somewhere else.

### The trackers mislabel their own rows

Verified again on 2026-07-27. `codexreset.org`'s *"Jul 21 · 17:47 UTC"* row cites
`2080859954421047341`, which decodes to **2026-07-25T03:37:28Z**. Its *"Jul 25 · 03:37"* row cites the
post that decodes to 19:17. **Decode every id; never trust a tracker's displayed time.**
