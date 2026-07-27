# Status — 2026-07-27 (UTC)

**The site is LIVE at <https://ledger.kingy.ai>, indexable, and serving the committed build.**

Dates in this file are UTC, like every date in this project. The local clock in the working timezone
is seven hours behind, which has already produced one wrong correction — see `docs/COMPARISON.md`.

---

## What changed since the previous revision of this file

The previous revision said *"Everything in the spec is complete or explicitly deferred. No buildable
work remains,"* and listed three open operator decisions. **Two of the three are now closed, and
almost every figure in it was stale.** Recorded here rather than quietly overwritten, because a
start-here document that is wrong is worse than none:

| it said | actually |
|---|---|
| 89 tests | **175** |
| `archive_url` populated: **0** | **85 of 86** evidence items · **61 of 62** unique URLs |
| Phase 5 "built, not deployed" | **deployed and live**, custom domain resolving |
| "CORS is specified but unverified" | **verified** against the live origin, 2026-07-27 |
| decision 1 — host and subdomain "blocks publishing entirely" | **closed.** Cloudflare Pages, `ledger.kingy.ai` |
| decision 2 — link rot, "0 of 86 have an archive_url" | **substantially closed.** 1 of 62 URLs uncaptured |

The one decision still genuinely open is the third, and it is the strategic one.

---

## The open decision: operate, or declare it a snapshot

**Owner: operator.** Leaving it open is itself a choice, and the bad one — the site silently becomes
a snapshot while presenting as live.

The site now **labels itself honestly either way**, which it did not before: every page carries
*"Covers March–July 2026"* in the masthead, the hero states the ledger's as-of instant, and the Codex
figure is re-reckoned against the reader's clock on load rather than being a frozen build-time number.
So the dishonest middle state has been closed off. The strategic question has not.

Phase 6 (calibration) needs roughly **40 labelled events per vendor**:

| vendor | current records | reset-bearing |
|---|---|---|
| codex | 19 | 19 |
| claude-code | **9** | **4** |

Claude Code is the binding constraint. At two or three events a month, **calibration is on the order
of a year away, not a quarter** — so the uncalibrated banner is not a temporary state, it is the state.

What has changed is that two collection paths now exist and neither needs a decision to keep running:

- **`capture/`** — a status line on the operator's own seat logs quota observations and a detector
  files candidates for human promotion. Installed 2026-07-27. It never writes to `ledger/`.
- **`social/`** — the @thsottiaux and @ClaudeDevs signal via the official X API, **log-only** and inert
  until `QRI_X_BEARER_TOKEN` is set.

Neither lowers the bar for what becomes a record. Both shorten the gap between an event happening and
someone knowing to look for it, which is the actual bottleneck on growing the corpus.

---

## Phase state

| phase | state | note |
|---|---|---|
| 0 — repo & audit | ✅ complete | Found two spec premises false: `status.anthropic.com` redirects; OpenAI is not on Atlassian Statuspage. |
| 1 — the ledger | ✅ complete | 47 records, 28 current. 6 candidate events refuted before entry. |
| 2 — the sentinel | ⛔ **closed, not blocked** | Four reasons; see `PHASE-2-CLOSED.md`. Its reopening condition (b) — "each user runs it locally against their own seat" — is what `capture/` now is. §4 of that document still binds: telemetry never establishes a vendor grant. |
| 3 — status ingestion | ✅ built, **not scheduled** | No scheduler. The 2026-07-12 automation freeze means wiring one is an explicit operator action. |
| 4 — model port | ✅ complete | Verified identical to the prototype across 29 numbers. Found §7.2's Claude Code column to be wrong. |
| 5 — public surface | ✅ **deployed and live** | Four pages, CORS verified, sitemap, canonical URLs, schema.org Dataset. |
| 6 — calibration | ⏸ blocked on data | See the open decision above. |

## The ledger

| | |
|---|---|
| Records | 47 total · **28 current** · 19 superseded |
| Vendors | codex 19 current (34 total) · claude-code 9 current (13 total) |
| Span | 2026-03-13 → 2026-07-21 |
| Confidence | confirmed 3 · probable 14 · reported 11 |
| Effects (current) | global_reset 20 · limit_increase 5 · banked_reset 3 · limit_removal 1 |
| Evidence | **86 items** on current records, across **62 unique URLs** |
| Archived | **85 of 86 items (98.8%)** · **61 of 62 URLs (98.4%)** |
| `field_support` | attested 19 · unestablished 13 · inferred 4 · **9 records carry none** (they predate the field) |
| Tests | **175** |
| Commits | 34 |

⚠️ **Two archive figures, both correct, and they are not interchangeable.** 24 evidence items cite a
URL another record also cites, so "85 of 86" counts *items* and "61 of 62" counts *distinct URLs*.
`README.md` publishes the item figure; `/compare` publishes the URL figure. Say which you mean. One
session marked the other's number as an error over exactly this.

---

## Live-site facts, verified 2026-07-27 rather than assumed

- All of `/`, `/compare`, `/forecast`, `/methodology`, `/ledger.json`, `/ledger.csv` return **200**.
- `public/index.html` is **byte-identical** to what the origin serves.
- Both data endpoints return `access-control-allow-origin: *` and
  `cache-control: public, max-age=3600, stale-while-revalidate=86400`, matching `HEADER_RULES` exactly.
  So `public/_headers` is working as designed on Cloudflare Pages.
- ⚠️ **An `OPTIONS` preflight returns 405** (with the ACAO header present). Harmless for the actual
  use case — a plain cross-origin `GET` with no custom headers is not preflighted — but a client
  sending a custom request header would be blocked. The correct claim is "CORS-open for simple GET",
  not "full CORS".

## Smaller open items

- **The `/compare` staleness gate cannot fire if the ledger goes dormant** — a documented limitation
  rather than a defect. It measures drift between `CHECKED_ON` and the ledger's own `AS_OF`, which is
  what keeps the build deterministic; but a ledger that stops being updated freezes `AS_OF`, so the gate
  would never trip however old the comparison got. **Mitigated by the page stating its own check date
  twice in prose** ("fetched and read on 2026-07-27"), so a reader can judge staleness without trusting
  the gate. Closing it properly would need a wall-clock read, which §4.4 forbids.
- **1 evidence URL remains uncaptured**: `note.com/kitworks/n/n70bb4a29db37`.
- **`/usage` probe cost — unmeasured.** Protocol at `experiments/usage-probe-cost.md`. Nothing depends
  on the answer.
- **`cx-2026-07-21-01` is still the weakest date in the ledger.** Its only admissible source describes
  resets across the milestone *series*, not on that date. Flagged in-record.
- **§11.3 ownership.** `docs/RUNBOOK.md` exists; who owns *running* it follows from the open decision.

---

## What would invalidate this ledger

Stated plainly so it can be checked rather than assumed. Any one of these breaks it.

1. **The evidence stops resolving.** Much reduced but not eliminated: 98% of URLs have a dated capture,
   so the claim is now "as of that date, this source said this". The 1 uncaptured URL and any host that
   refuses archiving remain exposed.
2. **A record is edited rather than superseded.** Enforced by a pre-commit hook *and* by CI against
   full history, so `--no-verify` no longer defeats it. A direct push to a branch CI does not run on
   would.
3. **An `inferred` or `unestablished` field is quietly promoted to `attested`** without a new source.
   That is the 2026-07-26 defect returning, and it is invisible in the rendered output.
4. **A mirror is allowed to carry substance.** Trackers are convenient and well-formatted, which is
   exactly why the rule needs applying when it is inconvenient.
5. **The UTC keying slips.** One event was already recorded twice, a different pair was nearly merged
   wrongly, and on 2026-07-27 a *correction* was itself made from the local clock and had to be
   withdrawn. Every contested date needs the post-id decode.
6. **Someone batch-corrects without verifying.** 21 of 41 proposed corrections were wrong when checked
   individually. A confident sweep is not evidence.
7. **A forecast number is rendered without the calibration banner.** Enforced at build time, in the
   deploy preflight, and in tests.
8. **Telemetry is treated as confirmation.** `capture/` produces candidates, never records. If an
   observation ever reaches `evidence[]`, the ledger is asserting a vendor grant on the strength of one
   account's quota moving — which no channel can establish.

Items 2, 3, 4, 7 and 8 are enforced by code. Items 1, 5 and 6 depend on the person doing the work
following `docs/RUNBOOK.md`.

---

## ⚠️ Two sessions worked this repo on 2026-07-27. Read this before assuming a file is yours.

Commits `c5643ab` through `4443865` were produced by two Claude sessions running concurrently against
one working tree. It worked out, but only just, and the near-misses are the lesson:

- **A duplicate implementation was written twice.** Both sessions independently built ledger-derived
  forecast state; one had to be reverted. Check `git log` before starting, not after.
- **A whole-file `Write` was caught only by a staleness guard.** It would have discarded the other
  session's uncommitted work. Prefer targeted `Edit`, whose exact-match failure is the safety net.
- **`git add -A` swept another session's uncommitted edits into a commit** under the wrong message and
  author (`2eefafe`). Stage explicit paths when more than one session may be live.
- **Lane ownership was assigned by the operator and it is what made this tractable.** One session owned
  `site/`, the other owned `capture/` and `social/`. Tests enforce that boundary in both directions.
