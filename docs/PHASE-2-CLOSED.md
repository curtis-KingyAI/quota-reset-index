# Phase 2 (the sentinel) — CLOSED, not blocked

**Closed 2026-07-26 by operator decision.** Recorded here because leaving it "blocked" implies it is
waiting on something. It is not. Nothing will unblock it in its specified form.

## What Phase 2 specified

A poller reading `https://api.anthropic.com/api/oauth/usage` via the OAuth token at
`~/.claude/.credentials.json`, detecting a discretionary reset as a ≥15 percentage-point drop in
`seven_day_utilization` across samples in which the account issued no requests.

## Why it is closed rather than deferred

**1. The operator declined §5.1 on the merits.** No stability contract, risk transfers to end users,
and it compromises the editorial-independence position. That is a standing decision, not a pending one.

**2. The ToS objection is surface-indifferent, and quotable from Anthropic's own product docs.**

> "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai
> login **or rate limits** for their products, including agents built on the Claude Agent SDK.
> Please use the API key authentication methods described in this document instead."
> — Agent SDK overview

The words "or rate limits" reach past authentication to a product built on a subscription's quota.
It applies identically whether the number comes from the undocumented endpoint, from scraped `/usage`
stdout, or from the **fully documented** `statusline.md` `rate_limits` field. Choosing a better
surface makes the product technically durable and legally unchanged. There is a path to yes —
"unless previously approved" — but it runs through business development, not through engineering.

**3. The premise was already false locally.** `~/.claude/.credentials.json` does not exist on the
operator's machine; there is no credential file under any name and no matching keychain item.

**4. Even if it worked, it would confirm the wrong proposition.** No channel — supported or not —
distinguishes a vendor-wide grant from a scheduled rollover. Telemetry can establish *"my quota
changed"*, never *"the vendor granted a reset"*. The ledger records the latter. See the consequence
for §4.2 below.

## Consequence for the spec: §4.2 is mis-specified

§4.2 admits `telemetry` as evidence sufficient for `confidence: "confirmed"`. Given (4) above, that
is wrong as written — telemetry would confirm a proposition the ledger does not record.

**Recommended amendment**, not yet applied: strike `telemetry` from the confirming-evidence set, or
narrow it to confirming `kind: "scheduled_recycle"` only, where "my quota changed on cadence" *is*
the proposition. No current record relies on telemetry evidence, so nothing breaks either way.

## What survives, and is already built

- **`UsageProvider`** (`usage/provider.ts`) — usage behind an injected interface shaped by what the
  model needs, not by any endpoint. A test asserts endpoint-shaped keys never appear.
- **`OperatorProvider`** — the §5.1 fallback. Tested to reproduce the baseline forecast exactly.
- **`NO_SUPPORTED_TELEMETRY`** — "we do not know" as a first-class renderable state.
- **`resolveUsage(..., { publicSurface: true })`** — refuses any provider marked `supported: false`
  on a public surface, so the §5.1 decision is enforced in code rather than by comment.

Nothing in the forecast path depends on Phase 2. It renders correctly with no telemetry at all.

## What would have to change to reopen it

Not a better parser. Either (a) Anthropic grants prior approval for a product built on claude.ai
rate limits, or (b) the product is restructured so each user runs it locally against their own seat
with their own credentials — which is a different product, and would need re-specifying, not resuming.

## Filed, not pursued

The serialisation request — *"`/usage` already fetches plan limits on demand under a documented
OAuth scope; please emit that block in `-p`/SDK output, or add `claude usage --json`, plus a
discriminator for **why** a window last reset"* — is worth filing as an ordinary feature request.
Per operator instruction it is **off the critical path**: design as though it never lands.
