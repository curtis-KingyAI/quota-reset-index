# Sentinel coverage gap — supported channels vs. what the detection rule needs

> ## ⚠️ PROVISIONAL — this document is not settled
>
> The operator's ruling, 2026-07-26: *"Your skeptic found 15 defects in the first synthesis. That
> doesn't make the second one clean, it makes this workstream high-defect. Mark the corrected
> picture provisional."*
>
> That is correct and this document inherits it. One adversarial pass found **7 missed surfaces and
> 8 overclaims** in the first synthesis — a defect rate that says nothing about the second pass being
> clean, only that this subject matter is error-prone. Treat every claim below as a lead.
>
> **Two claims are withdrawn outright since first writing:**
> 1. **"Observation is free" — WITHDRAWN.** It was argued from `total_cost_usd 0`, a figure this same
>    document establishes is computed locally and is not billing-relevant on a Max/Pro seat. You
>    cannot prove zero quota cost with a number you have declared unreliable. Status: **unmeasured**.
>    A protocol to measure it properly is at `experiments/usage-probe-cost.md`.
> 2. **"The escalation ask shrinks" — RETRACTED AS FRAMED.** See the §2 note below on whether the
>    *command* or the *endpoint* is documented. If only the command is documented, the ToS objection
>    has **moved, not shrunk** — parsing stdout from an undocumented surface into a public product is
>    the same objection in a different place.

Requested by the operator, 2026-07-26, after declining §5.1:

> (1) scope the endpoint-dependent capability as internal-only and tell me what we lose;
> (2) spec the same sentinel on Claude Code OTel export + the Admin Usage/Cost API, and report the
> coverage gap explicitly — I want to see what subscription-quota signal is genuinely unavailable
> via supported channels before I consider any escalation to Anthropic.

Method: four documentation surveys, one synthesis, one adversarial pass instructed to refute the
"unavailable" claims. **The adversarial pass materially corrected the synthesis** — it found seven
missed surfaces and eight overclaims. What follows is the corrected picture, not the first draft.

---

## Headline

**The gap is real, but it is not the gap the spec assumes.**

The spec's premise is that reading subscription quota requires the undocumented OAuth endpoint. The
corrected finding is narrower and more actionable:

> Claude Code **already** performs a documented, on-demand, server-side read of subscription plan
> limits, through a documented command, under a documented OAuth scope. What is missing is not the
> capability. It is the **serialisation** — that data is rendered to a terminal and never emitted in
> machine-readable form.

That reframes the escalation ask from "expose a new quota API" to "emit a block you already
compute". Far easier to grant, and it needs no new auth story, no new network surface, no new data.

## ⚠️ The §5.1 premise is already false on this machine — verified directly

§5.1 describes "reading the OAuth token that Claude Code maintains at `~/.claude/.credentials.json`".

**That file does not exist here.** `~/.claude/` contains `backups/ hooks/ plans/ projects/
session-env/ sessions/ settings.json/ shell-snapshots/ tasks/` and no credential file under any
name; no `Claude Code-credentials` keychain item was found either. So the declined path was, on this
machine, already unbuildable as written. Worth knowing independently of the ToS objection.

## Channel by channel

| Channel | Exists | Covers subscription quota? | The decisive detail |
|---|---|---|---|
| **Claude Code OTel export** | yes | **no** | 8 metrics, 24 events, 6 span types. A full-text grep of the 129KB doc for `rate.?limit\|quota\|reset\|utilization\|allowance` returns **zero substantive hits**. Cost figures are computed *locally* at list rates — the docs say so — and are explicitly "not relevant for billing" on a Max/Pro seat. |
| **Admin Usage & Cost API** | yes | **no** | Cumulative token counts and spend, not allowance fractions. Carries the banner *"The Admin API is unavailable for individual accounts."* |
| **Rate Limits API + `anthropic-ratelimit-*` headers** | yes | **no** | Static configured **org** ceilings, not subscription-seat allowance. Headers arrive only as a side effect of a request you already made. |
| **Local surfaces (`/usage`, status line, SDK)** | yes | **partial** | This is where the real answer lives — see below. |

## What `/usage` actually does

`/usage` (aliases `/cost`, `/stats`) is documented as *"Show session cost, plan usage limits, and
activity stats"*, and `commands.md` states it *"runs immediately without interrupting the response"*
— it is not a model turn. Anthropic's own `costs.md` describes the server call in as many words:

> When the request for your plan limits fails, most often because the **usage endpoint** is rate
> limited, `/usage` shows the last usage bars it loaded on this machine within the past 60 minutes…
> Press `r` to retry; a successful retry replaces the last-known bars with **fresh data**.

So a supported, on-demand, live read of subscription plan limits exists, and Anthropic documents the
usage endpoint's existence in passing. `errors.md` even documents its OAuth scope (`user:profile`).

**The boundary is rendering, not metering.** The plan bars are drawn in the TUI. The verifying agent
reports measuring `claude -p "/usage"` at v2.1.219 returning in 33 ms with `total_cost_usd 0`,
`num_turns 0` — free — but emitting only the *session cost* block, with the plan bars absent.

> ⚠️ **I could not reproduce that measurement.** There is no `claude` binary on `PATH` or in the
> usual install locations in my shell. The zero-cost figure is the verifying agent's, unconfirmed by
> me. It is load-bearing for the "observation is free" conclusion, so **measure it yourself before
> relying on it.**

## Corrected: the "you must spend quota to observe quota" claim was WRONG

The first-draft synthesis concluded that every carrier of quota state is a side effect of a completed
request, and therefore that observation costs quota. **The adversarial pass refuted this**, and the
error ran in the direction that hurts us — it would have justified a much larger escalation ask and a
probe-budget design that isn't needed.

It also caught that one synthesis claim (an Agent SDK credit-pool assertion) rested on a **retracted
article**, and that a claimed `subscription_type` enum detail was unverifiable. Both are struck.

## What is genuinely unavailable

Stated so it can be quoted verbatim to a vendor:

> For a Claude Code Pro or Max seat, there is no documented, supported channel that returns the
> seat's current `five_hour` / `seven_day` utilisation or `resets_at` **in machine-readable form,
> without a live interactive terminal session**. The data is computed and displayed on demand at no
> quota cost; it is simply never serialised. Consequently a discretionary grant landing while the
> seat is idle is undetectable by any headless supported means, and nothing in any channel
> distinguishes a vendor-wide grant from a scheduled rollover.

Two capabilities remain **unavailable** rather than degraded:

- **Passive headless observation** — possible in principle (the read is free) but blocked by
  serialisation.
- **Attribution** — no channel says *why* a window reset. A vendor-wide grant and an ordinary
  rollover look identical from inside one account. **The ledger is the only thing that can
  distinguish them**, which is a point in favour of the build order the spec already chose.

## Internal-only scoping: what we lose

If the OAuth path were kept but fenced to internal use, the **public** product loses:

1. **`confidence: "confirmed"` via telemetry.** §4.2 admits `telemetry` as a confirming evidence
   type. Fenced internally, no public record can ever cite it — public records cap at `probable`
   unless a vendor post or status page exists.
2. **Candidate generation (§5.3) as a public claim.** Candidates could still be produced privately
   and promoted by hand, but their provenance could not be shown, which defeats the point of a
   ledger whose value is that every row links to its evidence.
3. **Nothing else.** The forecast surface already renders correctly without it — that path is built
   and tested (`usage/__tests__/usage.test.ts`), falling back to operator-entered utilisation and
   reproducing the baseline exactly.

The honest summary: internal-only scoping costs us **the ability to prove a reset happened**, not the
ability to forecast. Given the editorial-independence position, that trade looks correct.

## The escalation ask, now much smaller

Do not ask for a new quota API. Ask for serialisation of an existing one:

> `/usage` already fetches subscription plan limits from your usage endpoint, on demand, at zero
> quota cost, under the documented `user:profile` scope. Please emit that same block in `-p` /
> SDK `local_command_output`, or add `claude usage --json`. Shape it identically to the `rate_limits`
> block already documented in the Claude Code status line field table
> (`{five_hour: {used_percentage, resets_at}, seven_day: {…}}`) — no new data, no new auth, no new
> network surface.
>
> One addition would cost nothing extra to emit and would be materially useful: a discriminator on
> each window for **why** it last reset — scheduled rollover versus out-of-band grant.

That last clause is the only genuinely new thing being requested, and it is the one that would make
attribution possible at all.

## Recommended design, given all this

Unchanged from what is already built: usage stays behind `UsageProvider`, shaped by what the model
needs rather than by any endpoint. Add providers only as they become supported. `capabilities
.passiveObservation` is the flag that decides whether the §5.3 detection rule is possible at all for
a given source — today, for every supported source, it is `false`.

## Open, and worth measuring before designing further

- Does the status line's `rate_limits` re-fetch on `refreshInterval`, or replay the last response?
  `errors.md` ties the status line indicator to the *same scoped usage-endpoint call* as `/usage`,
  which makes a genuine re-fetch more plausible than first assumed. **Unmeasured.** Do not
  pre-commit to the pessimistic branch.
- Reproduce the `claude -p "/usage"` zero-cost measurement locally.
- `StopFailure` hook fires headlessly with error `rate_limit`. A free, supported "wall hit" signal —
  useless for grant detection, but it is the only headless quota-adjacent event that exists.
