# Status — 2026-07-27 (UTC)

**The site is LIVE at <https://ledger.kingy.ai>, indexable, and serving the committed build.**

Dates in this file are UTC, like every date in this project. The local clock in the working timezone
is seven hours behind, which has already produced one wrong correction — see `docs/COMPARISON.md`.

---

## What changed since the previous revision of this file

The previous revision said *"Everything in the spec is complete or explicitly deferred. No buildable
work remains,"* and listed three open operator decisions. **All three are now closed, and almost
every figure in it was stale.** Recorded here rather than quietly overwritten, because a
start-here document that is wrong is worse than none:

| it said | actually |
|---|---|
| 89 tests | **175** |
| `archive_url` populated: **0** | **85 of 86** evidence items · **61 of 62** unique URLs |
| Phase 5 "built, not deployed" | **deployed and live**, custom domain resolving |
| "CORS is specified but unverified" | **verified** against the live origin, 2026-07-27 |
| decision 1 — host and subdomain "blocks publishing entirely" | **closed.** Cloudflare Pages, `ledger.kingy.ai` |
| decision 2 — link rot, "0 of 86 have an archive_url" | **substantially closed.** 1 of 62 URLs uncaptured |

**All three are now closed** — the third was decided on 2026-07-27; see below.

---

## ✅ DECIDED 2026-07-27: OPERATE IT

**The operator chose to operate rather than declare a snapshot.** All three decisions this file
carried are now closed. The loop is written down in [`OPERATING.md`](OPERATING.md); §11.3 ownership
follows from the decision and sits with the operator.

**What was built to make the decision honest rather than aspirational**, because choosing to operate
does not remove the "stale index that looks live" risk — it *creates* it:

- **A freshness signal that escalates by itself.** Every page shows "Last reviewed …", computed in the
  reader's browser against their own clock, warning at **21 days** and saying "may no longer be
  maintained" at **45**. Both thresholds are *measured*: 21 sits just past the longest gap between
  Codex resets in the record (20 d), so it cannot fire on a quiet period the vendors have actually
  produced. Two tests hold it — one that the thresholds exceed the observed maxima, one that
  re-derives those maxima from the ledger, so growth forces a re-justification instead of rot.
- **A sweep log** (`operations/sweeps.jsonl`, `npm run sweep`). The schema could say "an event
  happened" but had no way to say "we looked and found nothing admissible", so **"nobody checked" and
  "nothing occurred" were indistinguishable** — which made the claim to be operated unfalsifiable. Its
  four outcomes keep `blocked` (403, login wall) separate from `no-coverage`, because collapsing them
  turns "we couldn't check" into "there was nothing".

**The first sweep ran the same day and found a real gap it could not close.** A probable Codex reset on
**2026-07-25** — post `2081096447718723984`, decoding to 19:17:12Z — is attested only by mirrors, so
under §2 no record was written. Five non-mirror avenues failed, including OpenAI's own status page
showing *no incident* in the 02:00–04:00 window the mirror describes. Logged with all five attempts so
the next sweep does not repeat them; the lead is in `OPERATING.md`.

That sweep also exposed a loose end worth generalising: migration 02 correctly **struck** that post
from `cx-2026-07-21-02` for being four days mis-dated, and then nobody recorded the 07-25 event it
belonged to. **A struck citation is a signal that an event exists somewhere else.**

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
| 1 — the ledger | ✅ complete | 48 records, 28 current. 6 candidate events refuted before entry. |
| 2 — the sentinel | ⛔ **closed, not blocked** | Four reasons; see `PHASE-2-CLOSED.md`. Its reopening condition (b) — "each user runs it locally against their own seat" — is what `capture/` now is. §4 of that document still binds: telemetry never establishes a vendor grant. |
| 3 — status ingestion | ✅ built, **not scheduled** | No scheduler. The 2026-07-12 automation freeze means wiring one is an explicit operator action. |
| 4 — model port | ✅ complete | Verified identical to the prototype across 29 numbers. Found §7.2's Claude Code column to be wrong. |
| 5 — public surface | ✅ **deployed and live** | Four pages, CORS verified, sitemap, canonical URLs, schema.org Dataset. |
| 6 — calibration | ⏸ blocked on data | ~40 labelled events per vendor needed; claude-code has 4 reset-bearing. Now being operated toward — see OPERATING.md. |

## The ledger

| | |
|---|---|
| Records | 48 total · **28 current** · 20 superseded |
| Vendors | codex 19 current (35 total) · claude-code 9 current (13 total) |
| Span | 2026-03-13 → 2026-07-21 |
| Confidence | confirmed 3 · probable 15 · reported 10 |
| Effects (current) | global_reset 20 · limit_increase 5 · banked_reset 4 · limit_removal 1 |
| Evidence | **86 items** on current records, across **62 unique URLs** |
| Archived | **85 of 86 items (98.8%)** · **61 of 62 URLs (98.4%)** |
| `field_support` | attested 19 · unestablished 13 · inferred 4 · **9 records carry none** (they predate the field) |
| Tests | **200** |
| Commits | 41 |

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
- **⚠️ 65 truncated prose fields across ~44 of the 48 records — unrecoverable.** Surveyed 2026-07-27.
  The lengths cluster unmistakably: `scope.notes` at **699–700**, `notes` at **975–1200** with many
  landing on exactly **1200**. Whatever authored the Phase 1 and migration-02 records capped its own
  prose at write time, silently.

  This is worse than untidy, because the truncated text is usually the **justification**.
  `cx-2026-06-28-02` records that its confidence was downgraded after failing one of five adversarial
  vectors, and is cut off during vector 1 — so *which one failed is unrecoverable*.

  **The content is genuinely gone, not merely misplaced.** It was truncated before it ever reached
  disk: the predecessor `cx-2026-06-28-01` carries the same sentence cut at the same point, and no
  commit in history holds a fuller version. Reconstructing it would be fabrication dressed as recovered
  evidence, so **the 65 stay exactly as they are** — sealed, and now themselves part of the audit trail.
  `docs/MIGRATION-PLAN-01.md` holds a separate, fuller verdict for the 06-28 record; it is the closest
  thing to a recovery and it is not the same text.

  **A guard now stops the 66th.** `lib/truncation.mjs` rejects any *newly added* record whose `notes`
  or `scope.notes` ends mid-thought, enforced in the pre-commit hook. It applies to additions only, by
  design: the existing 65 are sealed and unrepairable, and a check that can never be satisfied is one
  that gets deleted.
- **1 evidence URL remains uncaptured**: `note.com/kitworks/n/n70bb4a29db37`.
- **`/usage` probe cost — unmeasured.** Protocol at `experiments/usage-probe-cost.md`. Nothing depends
  on the answer.
- **`cx-2026-07-21-01` is still the weakest date in the ledger.** Its only admissible source describes
  resets across the milestone *series*, not on that date. Flagged in-record.
- **§11.3 ownership — CLOSED.** The operator owns running the loop; `docs/OPERATING.md` records it.

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
9. **A record cannot be re-audited from itself.** Already true of 65 fields across ~44 records, whose
   prose was truncated at write time — including, in at least one case, the reasoning that justified a
   confidence grade. Records are checkable only while they carry their own working; a ledger of
   conclusions with the arguments cut off is asking to be believed rather than checked. Guarded for new
   records, permanent for the existing ones.

Items 2, 3, 4, 7, 8 and 9 are enforced by code — 9 only for newly added records; the existing 65 are
sealed and beyond repair. Items 1, 5 and 6 depend on the person doing the work following
`docs/RUNBOOK.md`.

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
