# The vendor-employee social signal

Both models carry a weight for a post by a vendor employee — `tibo` (@thsottiaux) in Model A, `dev`
(@ClaudeDevs) in Model B. Neither has ever fired, because §2 kept them unreachable.

This directory makes them reachable **through the official X API**, and stores what it sees.

**It is log-only. It does not move any published number.** That is a deliberate decision, not an
unfinished wire-up — see below.

---

## Why it is log-only

`tibo` carries **w = 1.45 — the highest weight in either model**. At full strength and zero age it
multiplies λ by about 4.3. It is also a hand-set prior that has never once been tested against an
outcome, because nothing has ever been able to set it above zero.

So switching it straight into the rendered forecast would put **the largest lever on the page** under
the control of an unvalidated weight, driven by a term matcher over someone's tweets. The forecast
would get louder and less trustworthy at the same time, on a site whose entire pitch is that its
numbers can be checked.

The signal is therefore collected so that it can eventually be **fitted** — which is what Phase 6 is
for, and which needs a labelled sample that does not exist yet. Collecting it is how that sample
starts existing.

Enforced in code: `resolveSocialSignal(..., { publicSurface: true })` refuses **every** provider and
returns no signal. A future caller has to change that function and read the reason, rather than pass a
different flag. A test asserts it, and a second test asserts that nothing in `site/`, `models/`,
`scripts/`, `status/` or `usage/` imports this directory.

## Why the official API and not scraping

x.com serves a login wall to unauthenticated clients. Getting past it means borrowing a logged-in
session or defeating bot detection — the first breaches the terms and the second is not something this
project will build at any price.

Both existing trackers use the API, and one says so outright: codexreset.org — *"Every hour, the X API
checks public posts and replies from approved accounts."*

## Cost, which shapes the design

X **closed the flat $200/mo Basic tier to new signups in February 2026** and retired the free tier.
New developers are pay-per-use, around **$0.005 per post read**, capped at 2M reads/month.

That makes the polling strategy the difference between a few dollars a month and a few hundred, so it
is fixed in `x-api.ts` rather than left to a caller:

| decision | why |
|---|---|
| `since_id` on every call | a poll returns only posts newer than the last seen, so a quiet hour reads nothing and costs nothing |
| `max_results=5` | the signal decays with a 10h half-life; a backlog of old posts has no value worth paying for |
| numeric user id cached | it never changes, and a user read costs twice a post read |
| `exclude=retweets` | a retweet is not the account speaking |

`capabilities.metered` is `true` so a scheduler cannot pretend otherwise.

## Setup

**Creating the developer account and holding the token is the operator's job, not an agent's.**

1. Create an X developer account and generate a **bearer token** (read access to user timelines).
2. Put it in your environment. Never in the repo:
   ```bash
   export QRI_X_BEARER_TOKEN='...'
   ```
3. Poll:
   ```bash
   npm run social:poll
   ```

Without the token it makes **no request and spends nothing** — that is the default state:

```
@thsottiaux: … NO CREDENTIAL — inert.
  skipped x-api-v2: QRI_X_BEARER_TOKEN is not set — no request was made and nothing was spent
```

The token is read into a private field, used in one `Authorization` header, and never logged,
printed, stored, or included in an error message. A test asserts it appears in none of the reading, the
stored line, or `describe()`.

### Other commands

```bash
npm run social:poll -- --dry-run
```
Resolves providers and prints what it would store. Writes nothing, advances no cursor.

```bash
npm run social:poll -- --explain
```
Prints the classifier's full term list and scoring. Costs nothing, makes no request.

```bash
npm run social:poll -- --show
```
Prints what has been collected.

### Scheduling

Hourly matches what the trackers do and suits a 10h half-life. Nothing here schedules itself — the
2026-07-12 automation freeze applies, so wiring a timer is an explicit operator action.

## The classifier is the weakest link, and it says so

`classify.ts` is a **term matcher**, not a model of intent. It has never been validated, and it will be
wrong in both directions: a deliberate vaguepost ("something nice tomorrow") scores near zero, and an
unrelated post using "limits" scores above it. That is the same shape of defect as the 2026-07-26 audit
— a general statement read as an event-specific one — so the design concedes it:

- the term list is **data**, printable with `--explain`
- **every match is returned**, so no consumer can quote a score without its working
- strength is a **stated function** of matches, because there is no sample to learn a weight from
- a **hint-only post is capped at 25**, since the vaguepost register predicts *something* and is
  uninformative about *what*
- a lower-group term that is a substring of a matched higher-group term **does not count twice** —
  `usage limit` sits inside `resetting usage limits`, and counting both inflated every explicit reset
  statement by +20

## What gets stored

`~/.quota-reset-index/social.jsonl`, outside the repository — override with `QRI_SOCIAL_LOG`.

```json
{"observed_at":"...","handle":"thsottiaux","post_id":"2078...","strength_pct":60,
 "age_hours":12.4,"matched":["resetting usage limits"],"provenance":"official-api",...}
```

⚠️ **Post text is deliberately not stored.** X's terms restrict redisplay of post content, and this
project publishes what it holds. The id keeps the record auditable — anyone can open the post — without
this repository becoming a republisher of someone else's writing. The id also lets the timestamp be
re-derived by arithmetic (`lib/snowflake.mjs`) rather than taken on trust, which is the same technique
that caught a tracker row labelled "Jul 21" whose cited id decodes to Jul 25.

## And the thing this cannot fix

A signal from X tells you what an employee said. It does not tell you a reset landed — the ledger's
own rules refuse a future-tense promise as evidence, and **two candidate events were already refuted
for exactly that**: *"We will reset rate limits today!"* with nothing showing it happened.

So this makes the project faster at knowing where to look. It does not lower the bar for what becomes
a record.
