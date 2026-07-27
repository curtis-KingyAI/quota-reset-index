# Instrumented capture — one seat, own machine

A Claude Code status line that shows your quota and records what it saw, plus a detector that turns
those observations into **candidates for a human to check**.

It never writes to `ledger/`. Nothing published depends on it. Both of those are enforced by tests,
not by intention.

---

## What this can and cannot establish

**It can** tell you, on the day, that this account's quota moved when no rolling window was due to
roll. That is worth having: the alternative is finding out a fortnight later from a tracker whose own
timestamps have been wrong before.

**It cannot** establish that Anthropic *granted* anything. `docs/PHASE-2-CLOSED.md` §4 still stands
and better data does not weaken it:

> No channel — supported or not — distinguishes a vendor-wide grant from a scheduled rollover.
> Telemetry can establish "my quota changed", never "the vendor granted a reset".

One seat also cannot establish `scope.plans` or `scope.partial`. So a candidate is a **prompt to go
looking for a vendor post**, and `confidence` is graded from that external source alone. `telemetry`
was struck from the confirming set on 2026-07-26 for exactly this reason.

**And it covers one vendor.** Codex quota state is not observable from outside — that is why Model A
is a Hawkes process over reset history in the first place. So this makes the Claude Code side of the
project better-evidenced than the Codex side. The gap is structural, not a backlog item, and must
never be presented as coverage of both.

## Why this is permitted where the Phase 2 sentinel was not

The sentinel was an account instrumented **on the site's behalf**, which end users would have
depended on. The prohibition it ran into — third-party products may not offer claude.ai login *or
rate limits* — is about supplying a subscription's quota state to other people through a product.

This is the case `PHASE-2-CLOSED.md` itself names as the way back in: *"each user runs it locally
against their own seat with their own credentials."* One operator, own seat, own machine, a
documented interface, output served to nobody. No credential is read — Claude Code hands the numbers
to a script you configured, which is the mechanism working as designed.

That argument holds only while nothing published depends on it, so
`capture.test.mjs` greps `site/`, `models/`, `scripts/`, `lib/`, `status/` and `usage/` and fails if
any of them import this directory.

---

## Install

Nothing is installed until you do this. Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/quota-reset-index/capture/statusline.mjs",
    "padding": 2
  }
}
```

Then try it without touching your settings at all:

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":8},"rate_limits":{"five_hour":{"used_percentage":23.5,"resets_at":1838425600},"seven_day":{"used_percentage":41.2,"resets_at":1838857600}}}' | node ~/quota-reset-index/capture/statusline.mjs
```

It prints one line, like `Opus · 5h 24% (2h14m) · wk 41% (5d) · ctx 8%`.

**`rate_limits` appears only for Claude.ai subscribers (Pro/Max), and only after the first API
response in a session.** Before that the bar shows `quota —`. That is the documented contract, not a
fault, and an absent window is never recorded as 0%.

## Read what it has collected

```bash
npm run capture:detect
```

```bash
npm run capture:detect -- --verbose
```

`--verbose` also lists the pairs it considered and rejected, with reasons. A detector nobody can
audit is one nobody should trust.

```bash
npm run capture:detect -- --write
```

Writes `capture/candidates/*.json`. Existing files are never overwritten, so a candidate you have
already annotated or dismissed will not be regenerated underneath you.

---

## How detection works

A rolling window empties by itself. That is the confounder, and `resets_at` is what defeats it — the
contract defines it as the epoch second at which the current window rolls:

| shape | reading |
|---|---|
| usage drops **at or after** `prev.resets_at` | ordinary rollover — ignored |
| usage drops **before** it, while the window still stood | candidate |

Thresholds live at the top of `detect.mjs`: a **15pp** drop (inherited from the Phase 2 spec) and
**120s** of slack around the boundary. The slack errs towards "rollover", because a missed candidate
costs one look at the evidence, while a false one trains you to ignore the detector.

This is sharper than the rule Phase 2 specified, which watched for a ≥15pp drop "across samples in
which the account issued no requests" — a condition the status line cannot evidence, and one an
ordinary rollover satisfies trivially.

## The observation log

Defaults to `~/.quota-reset-index/observations.jsonl`, **outside the repository on purpose**: these
lines are one person's account usage over time. Override with `QRI_OBS_LOG`.

One JSON object per line, appended with a single `O_APPEND` write kept under 512 bytes — Claude Code
cancels an in-flight status line when a new update triggers, and several sessions may run at once, so
there is no read-modify-write anywhere and a killed writer leaves nothing to repair. A reader that
meets a torn final line skips it.

A line is written only when something material moved — a window boundary changed, usage moved by
≥0.5pp — or every 300s regardless, so a quiet session still leaves a trail. A drop always counts as
material, so the filter can never swallow the one event it exists to catch. There is a test for that.

## Promoting a candidate

By hand, via [`docs/RUNBOOK.md`](../docs/RUNBOOK.md). The checklist travels inside each candidate
file. The short version:

1. Find a vendor post or status-page entry dated to that instant **in UTC**. Without one there is no
   record.
2. Decode the post id if a source dates it in Pacific (RUNBOOK §5). Several widely-cited sources do.
3. Leave `scope.*` unestablished unless a source addresses it. One seat says nothing about coverage.
4. Grade confidence from the external source only. **The candidate file is not evidence and must not
   appear in `evidence[]`.**
5. If nothing external corroborates it, discard it and record the attempt in the notes.
