# Experiment: does `/usage` consume the quota it reports?

**For the operator to run. Do not infer the answer from anything else in this repo.**

## Why the previous claim was withdrawn

The coverage report argued observation is free, citing `total_cost_usd 0` from `claude -p "/usage"`.
That argument does not stand, and the operator caught it: the same report also establishes that
Claude Code's cost figures are **computed locally at list rates** and are, in Anthropic's own words,
not relevant for billing on a Max/Pro seat. You cannot prove zero quota consumption with a number
you have already declared unreliable for that purpose.

**The only valid instrument is the quota meter itself.** This experiment reads that meter directly.

## The design, and the three traps it is built around

**Trap 1 — the 60-minute cache.** `costs.md` states `/usage` shows "the last usage bars it loaded on
this machine within the past 60 minutes" when the live request fails. If any reading is served from
that cache, repeated reads are not repeated *measurements* and the whole experiment reads as "no
change" regardless of the truth. **Every reading below must be a forced refresh** (press `r` in the
panel) and must be recorded as fresh or cached.

**Trap 2 — no positive control.** "The number did not move" is consistent with *probing is free* and
with *the meter is too coarse to show it*. Without a control that makes the number move, the result
is uninterpretable. Step 4 supplies one.

**Trap 3 — a shared pool.** Plan usage is shared across all Claude Code surfaces (CLI, desktop app,
VS Code extension, and claude.ai). Any of them active during the run contaminates the reading. The
run must be otherwise quiescent.

Secondary trap: the 5-hour window can roll over mid-run. **Read the WEEKLY figure as primary** and
record the 5-hour figure alongside it so a rollover is visible rather than silent.

## Protocol

Budget ~30 minutes. Nothing here writes to this repo.

**Step 0 — quiesce.** Close the desktop app, any VS Code window with the extension active, and any
claude.ai tab. Confirm no other machine is signed in on the same seat.

**Step 1 — baseline.** Open `/usage`, press `r` to force a refresh, and record:

| | weekly % used | 5-hour % used | fresh or cached? | wall clock (UTC) |
|---|---|---|---|---|
| baseline | | | | |

**Step 2 — probe burst.** Run 50 probes with no model turns between them:

```bash
for i in $(seq 1 50); do claude -p "/usage" >/dev/null 2>&1; done
```

50 is chosen so a small per-probe cost is visible rather than lost in rounding: if a probe cost even
0.1% of the weekly allowance, the burst moves the meter ~5 points. If probes are free, it moves 0.

**Step 3 — post-burst reading.** Reopen `/usage`, press `r`, record the same three values.

**Step 4 — positive control.** Now spend quota deliberately, in a way you would notice:

```bash
claude -p "Write a 400-word explanation of how a Hawkes process differs from a Poisson process."
```

Reopen `/usage`, press `r`, record again.

**Step 5 — control burst (optional, strengthens the result).** Repeat step 4 four more times, then
read again. This calibrates *how much* one ordinary turn moves the meter, which tells you the
instrument's resolution and therefore what step 3 could have detected.

## Recording sheet

| Reading | weekly % | 5h % | fresh/cached | UTC |
|---|---|---|---|---|
| 1. baseline | | | | |
| 2. after 50 probes | | | | |
| 3. after 1 control turn | | | | |
| 4. after 5 control turns | | | | |

## How to read the result

| Observation | Conclusion |
|---|---|
| 1→2 unchanged **and** 2→3 moved | **Probes are free.** The instrument demonstrably detects a real turn, and 50 probes did not register. This is the result that would restore the withdrawn claim. |
| 1→2 unchanged **and** 2→3 also unchanged | **Inconclusive — the instrument is too coarse.** Do not conclude probes are free. Increase the control burst until the meter moves, then re-run. |
| 1→2 moved | **Probes are NOT free.** Divide the delta by 50 for the per-probe cost. The sentinel design changes materially and the escalation ask is back on the critical path. |
| any reading served from cache | **Void that reading and repeat it.** A cached bar is not a measurement. |

## What this experiment does NOT settle

Even a clean "probes are free" result leaves two things untouched, and neither is measurable here:

1. **Whether consuming `/usage` output programmatically is supported.** That is a documentation and
   terms question, not a cost question — being free does not make it sanctioned. See the separate
   finding on whether the *command* or the *endpoint* is documented.
2. **Attribution.** Nothing in `/usage` says *why* a window reset. A vendor-wide grant and a
   scheduled rollover are indistinguishable from inside one account, at any probe frequency.

## If you would rather not run it

Then the honest state of the record is: **unmeasured**, and the coverage report must continue to say
so. That is a perfectly acceptable outcome — it is strictly better than the withdrawn claim.
