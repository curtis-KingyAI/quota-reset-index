# How this compares to the existing trackers

**Checked 2026-07-27 by fetching both sites.** Re-check before republishing: these are live products and
every row below is a claim about someone else's work, which means it has to be true on the day it is
shown or it is exactly the kind of over-claim this project audits itself for.

The two comparators are the reset trackers already cited in this ledger — as **locators only**, never
for substance (`docs/RUNBOOK.md` §2):

- **[codexreset.org](https://codexreset.org)** — "Codex Reset Monitor"
- **[codex-resets.com](https://codex-resets.com)** — built by [@wong2__](https://x.com/wong2__)

---

## ⚠️ Three rows of the first draft were wrong. They are corrected here.

The draft comparison said **"Historical record: none"** for them. That is false and trivially
falsifiable by opening either site:

| site | historical entries | span |
|---|---|---|
| codexreset.org | **11** confirmed resets | rolling 30 days (2026-06-29 → 2026-07-25) |
| codex-resets.com | **37** past resets | ~6 months, back to 1 January |
| **this project** | **47 records** (28 current, 19 superseded) | 2026-03-13 → 2026-07-21 |

codex-resets.com's span is **longer than ours**. Publishing "none" would have been a plain factual
error on the one axis where we claim superiority, and it would have been caught in a minute.

The draft also implied they have no forecast. **codexreset.org does publish one** — "the 24h and 48h
next-reset estimates update after confirmed resets and new evidence", off an "empirical 24h and 48h
reset-cadence baseline". So "we forecast, they don't" is not the difference either.

And it implied their sources are unlinked. They are linked: codexreset.org says "Every public source
remains linked from the timeline"; codex-resets.com links each entry with "View on X →".

**The real difference is not existence, coverage or linking. It is auditability.** That is a narrower
claim and it is the one that survives contact with their sites.

---

## The comparison, as it actually stands

| | codexreset.org | codex-resets.com | this project |
|---|---|---|---|
| Codex events | ✓ 11, rolling 30d | ✓ 37, ~6 months | ✓ 38 records (19 current) |
| **Anthropic Claude Code** | **✗** | **✗** | **✓ 9 records, honestly labelled** |
| Sources linked per entry | ✓ | ✓ | ✓ 86 on current records |
| **Archived copies of sources** | **✗** | **✗** | **✓ 85 of 86 (98.8%) Wayback-captured** |
| **Confidence graded** | ✗ | ✗ | ✓ confirmed / probable / reported, with stated criteria |
| **Per-field provenance** | ✗ | ✗ | ✓ `attested` / `inferred` / `unestablished` |
| **Corrections visible** | ✗ | ✗ | ✓ 19 superseded records, both halves of every chain on the page |
| **Machine-readable export** | **✗** | **✗** | **✓ JSON + CSV, CORS-open, CC BY 4.0** |
| Schema | ✗ | ✗ | ✓ published JSON Schema, validated in CI |
| Live X/status signal | ✓ hourly X API + OpenAI Status | ✓ classified @thsottiaux tweets | ✗ — see below |
| Forecast | ✓ 24h/48h cadence baseline | ✗ (interval stats only) | ✓ two models, **labelled uncalibrated** |
| Methodology published | ✗ | ✗ | ✓ every weight and half-life, generated from the code |

### Their data sources, in their own words

- codexreset.org: *"Every hour, the X API checks public posts and replies from approved accounts"*,
  plus *"OpenAI Status"*.
- codex-resets.com: *"Data from @thsottiaux's tweets, classified by a robot that takes this very
  seriously. Not affiliated with OpenAI."*

Both are therefore **mirrors** under this ledger's own definition, and that has a consequence we
cannot wave away: we may cite them to establish *that a post exists and when*, never *what it said*.
Their classification of a tweet cannot become our signal, however good it is. If we want the
@thsottiaux term, we need our own access to the source.

### Where they are ahead of us

Stated plainly, because a comparison that only flatters the author is marketing:

1. **They are live and we are not.** Both react within the hour. Our ledger is hand-curated and its
   most recent record is 2026-07-21.
2. **codex-resets.com covers a longer span** — back to January, against our March.
3. **They are simpler.** One page, one number, no schema to learn.

### The claim that survives

Not "more events" and not "faster". This:

> Every one of these 47 records can be checked, and when one was wrong you can see that it was wrong
> and what replaced it. Neither tracker has a correction history, so an error there leaves no trace —
> and errors happen: across four reads of codexreset.org during the 2026-07-26 migration, its own
> metadata paired the "10M!" milestone to Jul 21 twice and to Jul 18 twice, and one row labelled
> "Jul 21" cited a post whose id decodes to Jul 25. Both findings are recorded in
> `docs/MIGRATION-PLAN-01.md` and `docs/MIGRATION-PLAN-02.md`, against ourselves as much as against them.

Plus the two things nobody else does at all: **Claude Code coverage**, and **a download**.

---

## Before this goes on the site

- [ ] Re-fetch both sites and re-date this file. Their entry counts move.
- [ ] Decide whether to name them. Naming invites a rebuttal, which is healthy, but every row then has
      to be defensible on the day — and the two rows about *their* accuracy should link to our own
      migration docs so the reader can check the criticism rather than take it.
- [ ] Do not repeat the draft's "Historical record: none". It is false.
- [ ] Keep "Where they are ahead of us". A comparison table with no losing rows reads as a pitch, and
      this site's entire argument is that it can be checked.
