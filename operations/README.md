# operations/ — the record of looking

`sweeps.jsonl` is an append-only log of **when someone checked for events, and what happened** —
including, especially, when the answer was "nothing admissible".

## Why this is committed when `capture/` and `social/` are not

Those two hold personal telemetry: one seat's quota over time, one account's posts. This holds the
audit trail for *"is anyone still maintaining this ledger"*, which is a claim the project makes
publicly. A site that says **"Last reviewed 3 days ago"** should be able to show its working.

## What a sweep is not

**It is not an event.** No vendor scope, no confidence grade, no `evidence[]`, no ledger-shaped id, and
`scripts/sweep.mjs` cannot write to `ledger/`. A sweep asserts that somebody *looked*; only a ledger
record asserts that something *happened*. A test pins that boundary.

## The four outcomes, and why the distinction matters

- `read` — read, and it addresses the period. A clean negative is a real finding.
- `no-coverage` — read, but silent on the period.
- `blocked` — **could not be read at all** (403, 402, login wall). Not evidence of absence.
- `inadmissible` — read, but §2 forbids its use. Mirrors carrying substance land here.

Collapsing `blocked` into `no-coverage` is the failure this vocabulary exists to prevent: it turns
"we couldn't check" into "there was nothing", which is how a real event becomes a silent gap.

## Use it

```bash
npm run sweep                       # what has been swept, and how stale we are
npm run sweep -- --check            # exit non-zero when overdue (past 21 days)
npm run sweep -- --record f.json    # append a sweep
```

The loop, the source list and the admissibility rules are in
[`docs/OPERATING.md`](../docs/OPERATING.md).
