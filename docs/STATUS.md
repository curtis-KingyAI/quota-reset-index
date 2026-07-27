# Status — 2026-07-26

Everything in the spec is complete or explicitly deferred. **No buildable work remains.**
What is left is three decisions, all of which are the operator's.

---

## The three decisions

### 1. Host and subdomain — blocks publishing entirely

**Owner: operator.** Open since Phase 0; never answered. Spec §11.1 assigns the DNS change to the
operator, not the agent.

The site is built, preflighted and publishable. `npm run deploy` exits 0. It cannot ship because
there is nowhere to ship it to.

**The constraint recorded in Phase 0:** kingy.ai's DNS was believed to sit behind a managed Cloudflare tenancy
with no dashboard access, so a `*.kingy.ai` subdomain may not be self-serve. That is worth
establishing before choosing, not after.

**Second-order consequence:** the host determines whether the §8 CORS requirement is actually met.
`public/_headers` is read by Cloudflare Pages and Netlify **only**, and is inert on GitHub Pages, S3
and nginx. Until a host exists, **CORS is specified but unverified**, and the preflight cannot test
it — it needs a real cross-origin request against the real origin.

*Cost of deferring:* the project's stated success condition ("if we ship only the ledger, the project
succeeded") remains unmet, indefinitely.

---

### 2. Link rot — the largest unaddressed risk, and it decays daily

**Owner: operator (it is new work beyond the spec).**

**0 of 86 evidence URLs on current records have an `archive_url`.** One (`unite.ai`) already refuses
plain clients. Another (`memeburn.com`) 403s and had to be excluded from a record for that reason.

The ledger's entire value proposition is that every claim resolves to a source a reader can check.
A ledger of dead links is not a weaker ledger — it is an assertion with a footnote shaped like
evidence. Much of the corpus is third-party AI-news aggregators, which are exactly the sites that
disappear, reorganise their URLs, or go behind interstitials.

This risk is not static. It compounds with every day the archiving does not happen, and it cannot be
retroactively fixed once a page is gone.

*Options:* (a) archive all 86 now via Wayback and populate `archive_url`; (b) archive only the
load-bearing single-source citations; (c) accept the risk explicitly and say so on the site.

---

### 3. Operate, or declare it a snapshot

**Owner: operator.** This is the strategic one, and leaving it open is itself a choice — the bad one.

Phase 6 (calibration) needs roughly **40 labelled events per vendor**. Current holdings:

| vendor | current records |
|---|---|
| codex | 19 |
| claude-code | **9** |

Claude Code is the binding constraint and accrues at perhaps two or three events a month. **That puts
calibration on the order of a year away, not a quarter.** The uncalibrated banner is therefore not a
temporary state — it is the state, for a long time.

So either:
- **Operate it.** Someone records events as they happen, using `docs/RUNBOOK.md`. The ledger stays
  live, the corpus grows, calibration eventually unblocks.
- **Declare it a snapshot.** Publish it as a dated record of March–July 2026, labelled as such, and
  stop. Legitimate and honest.

*Cost of deferring:* it silently becomes the second while still presenting as the first — a stale
index that looks live. That is strictly worse than either option chosen deliberately.

---

## Phase state

| phase | state | note |
|---|---|---|
| 0 — repo & audit | ✅ complete | Found two spec premises false: `status.anthropic.com` redirects; OpenAI is not on Atlassian Statuspage. |
| 1 — the ledger | ✅ complete | 47 records, 28 current. 6 candidate events refuted before entry. |
| 2 — the sentinel | ⛔ **closed, not blocked** | Four independent reasons; see `PHASE-2-CLOSED.md`. Nothing will unblock it in its specified form. |
| 3 — status ingestion | ✅ complete | Built and tested; **not scheduled** — no host, no scheduler. |
| 4 — model port | ✅ complete | Verified identical to the prototype across 29 numbers. Found §7.2's Claude Code column to be wrong. |
| 5 — public surface | ✅ **built, not deployed** | Preflight passes. `--publish` refuses by design. |
| 6 — calibration | ⏸ deferred by §9 | Blocked on data. See decision 3. |

## Ledger

| | |
|---|---|
| Records | 47 total · **28 current** · 19 superseded |
| Vendors | codex 19 · claude-code 9 |
| Span | 2026-03-13 → 2026-07-21 |
| Confidence | confirmed 3 · probable 14 · reported 11 |
| Evidence items | 86 across current records |
| `field_support` | attested 19 · inferred 4 · unestablished 13 · **9 records carry none** (they predate the field) |
| `archive_url` populated | **0** |
| Tests | 89 passing |

## Smaller open items

- **`/usage` probe cost — unmeasured.** The claim that observation is free was withdrawn: it rested
  on a cost figure the same document establishes is unreliable. Protocol ready at
  `experiments/usage-probe-cost.md`; the operator runs it. Nothing currently depends on the answer.
- **The serialisation feature request** to Anthropic is drafted in `PHASE-2-CLOSED.md` and explicitly
  off the critical path — design as though it never lands.
- **`cx-2026-07-21-01` is the weakest date in the ledger.** Its only admissible source describes
  resets across the milestone *series*, not on that date. Flagged in-record. Re-anchor if a dated
  non-mirror source appears.
- **§11.3 ownership.** The runbook now exists at `docs/RUNBOOK.md`. Who owns *running* it is
  undecided, and follows from decision 3.

---

## What would invalidate this ledger

Stated plainly so it can be checked rather than assumed. Any one of these breaks it.

1. **The evidence stops resolving.** See decision 2. This is the most likely failure and the least
   dramatic — nothing breaks, the citations simply stop meaning anything.
2. **A record is edited rather than superseded.** The append-only guarantee is the trust argument.
   It is enforced by a pre-commit hook, which means it is enforced *only where the hook runs* — a
   commit made with `--no-verify`, or from a clone where `npm run hooks:install` was never run, is
   unprotected. The git history would show it; nothing would prevent it.
3. **An `inferred` or `unestablished` field is quietly promoted to `attested`** without a new source.
   That is the 2026-07-26 defect returning, and it is invisible in the rendered output.
4. **A mirror is allowed to carry substance.** Trackers are convenient and well-formatted, which is
   exactly why the rule needs to be applied when it is inconvenient.
5. **The UTC keying slips.** Sources date these events in Pacific. One event was already recorded
   twice, and a different pair was nearly merged wrongly. Every contested date needs the post-id
   decode.
6. **Someone batch-corrects without verifying.** 21 of 41 proposed corrections were wrong when
   checked individually. A confident sweep is not evidence.
7. **A forecast number is rendered without the calibration banner.** Enforced at build time and in
   the deploy preflight, but a hand-edited page or a new surface could bypass both.

Items 2, 3, 4 and 7 are enforced by code. Items 1, 5 and 6 depend on the person doing the work
following `docs/RUNBOOK.md`.
