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

### The weekly reminder — a local launchd job, since 2026-07-27

**Registered here so a later audit can identify it rather than flag it as unexplained automation.**
Created on explicit operator instruction; the 2026-07-12 freeze makes wiring a timer an operator
decision, never an agent's own initiative.

| | |
|---|---|
| label | `com.kingy.quota-reset-index.weekly` |
| plist | `~/Library/LaunchAgents/com.kingy.quota-reset-index.weekly.plist` |
| runs | `scripts/weekly-check.sh` — in this repo, so it is version-controlled |
| schedule | **Mondays 09:00 LOCAL** (launchd calendar intervals are local, unlike the UTC cron it replaces) |
| log | `~/Library/Application Support/QuotaResetIndex/weekly-check.log` |

```bash
scripts/weekly-check.sh --status   # recent runs — is it alive?
scripts/weekly-check.sh --test     # force a notification, prove it can reach you
launchctl list | grep quota-reset  # is it loaded?
```

**It notifies rather than logs**, because the thing it replaces failed precisely by writing where
nobody could read. A macOS banner appears when the sweep is overdue. A healthy week is logged and
**deliberately not** notified — a weekly "all fine" banner is noise, and noise gets muted, after which
the overdue one is muted too.

⚠️ **A BROKEN RUN NOTIFIES TOO.** Missing repo, missing node, npm failure: all produce a *"check
BROKEN"* banner rather than a silent non-zero exit. That is the whole lesson of the routine it
replaced — a scheduled job whose failure is indistinguishable from good news is worse than no job.
Verified by pointing it at a nonexistent repo and watching it report.

Verified end to end rather than assumed: run by hand ✅, run under `launchctl start` with launchd's own
minimal environment ✅ (the classic trap is a job that works by hand and fails on schedule because
`node` is not on launchd's PATH — the plist sets it explicitly), notification path ✅ **— and confirmed RECEIVED by the operator, not merely sent.** That distinction is
the whole reason the previous routine was scrapped: it dispatched reports successfully every week into
a surface no human could open, and "the send succeeded" was mistaken for "the message arrived". A
delivery mechanism is only verified when someone confirms they saw it. Failure path ✅.

⚠️ **It only fires while you are logged in**, and a Mac asleep at 09:00 Monday misses that week. The
site's freshness signal is the backstop and is independent of all of this — see the top of this file.

### ⛔ The scheduled reminder — BUILT, THEN DISABLED 2026-07-27. It was write-only.

**Do not re-enable it without first checking that its output can be read.** That is the whole lesson
and it is why this section is long.

| | |
|---|---|
| routine | Quota Reset Index — weekly sweep |
| id | `trig_01NWrCc74W8qXJcimeDQtrb3` |
| status | **`enabled: false`** as of 2026-07-27 |
| schedule (when enabled) | `0 16 * * 1` — Mondays 16:00 UTC = 09:00 America/Vancouver |
| manage | <https://claude.ai/code/routines/trig_01NWrCc74W8qXJcimeDQtrb3> — ⚠️ this URL does not load, see below |

**Why it was disabled.** Claude Code on the web is **disabled by this account's org admin**. Both
`claude.ai/code` and the routines URL redirect to `/code/disabled` — *"Web · Preview · Disabled by org
admin."* The routine fired correctly (`last_fired_at 2026-07-27T16:03:14Z`, a genuine scheduled run),
did the research, and wrote its report into a surface **nobody can open — not the operator, not an
agent.** It burned tokens weekly to produce nothing anyone could read.

**How it survived three rounds of checking.** Worth recording, because the mistake is subtle and
repeatable:

- An agent cannot read a cloud session — `RemoteTrigger` returns config only, the local session tools
  answer *"not found"*, and the session URL 403s unauthenticated. All true, all verified.
- From that I concluded "browser-only, therefore the operator's job" and told them four times to go
  read it — **without ever checking that the surface was reachable by anyone.** I tested my own access
  and generalised from it.
- `persist_session` was flipped to `true` specifically so runs would be readable afterwards, and the
  `persistent_session_id` duly appeared. It persists them into an inaccessible UI.

It is the exact failure this project keeps finding — **a process whose failure is indistinguishable
from its success** — built while documenting the pattern, and then written up here as if it worked.

**What would make it viable again**, in order of preference:

1. **Enable Claude Code web** (kingy.ai is the operator's org, so this may be self-serve). Everything
   already built then works, and the 16:03Z report becomes readable.
2. **A local scheduled job** running `npm run sweep -- --check`, whose output lands in a terminal
   someone actually sees. Less capable — no research pass — but not write-only.
3. Nothing. See below; the loss is smaller than it looks.

**The cadence in the meantime is manual**, and this matters less than it might:

```bash
npm run sweep -- --check
```

⚠️ **The reminder was never what made the site honest.** The freshness signal is computed in the
reader's browser and escalates on its own whether or not anything reminds anyone — see the top of this
file. The routine saved the operator remembering; losing it costs convenience, not integrity.

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
