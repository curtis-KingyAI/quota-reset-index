# Deploy

**The pipeline is built. It has never been run against anything, and it refuses to publish.**

```bash
npm run deploy
```

Runs the preflight only. Safe. Exits 0 when the site is publishable.

```bash
npm run deploy -- --publish
```

Refuses, exits 2, and prints what is missing. The upload step is deliberately not implemented:
spec §8 says build the pipeline, not run it, and §2 forbids production deploys without approval.

## What the preflight checks

Each of these is a failure that would otherwise be found *after* publication.

| # | Check | Why it is a blocker |
|---|---|---|
| 1 | Ledger validates | A site built from an invalid ledger is worse than no site — it looks authoritative. |
| 2 | Test suite passes | 89 tests, including the §7.2 golden numbers and the append-only guarantees. |
| 3 | Every artifact exists and is non-trivial | Catches a half-written `public/`. |
| 4 | `public/` is not stale | Rebuilds and compares. If the output changes, the committed bytes correspond to no commit. |
| 5 | §7.3 banner precedes every forecast number | Structural, not trusted. |
| 6 | No runtime network code, no third-party assets, no input capture | §8, verified rather than assumed. |
| 7 | Working tree is clean | So published bytes map to a commit. |

## Blocking, before this can be wired at all

1. **A decided subdomain and host.** Spec §11.1, open since Phase 0 and never answered. The operator
   makes this change, not the agent. Note the constraint recorded during Phase 0: kingy.ai's DNS sits
   behind a managed Cloudflare tenancy the operator does not administer, so a `*.kingy.ai` subdomain may
   not be self-serve.
2. **Operator approval to publish**, on the record.

## CORS, and the part that is not verified

§8 requires `/ledger.json` and `/ledger.csv` served CORS-open. The contract:

| path | header | value |
|---|---|---|
| `/ledger.json` | `Access-Control-Allow-Origin` | `*` |
| | `Content-Type` | `application/json; charset=utf-8` |
| | `Cache-Control` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/ledger.csv` | `Access-Control-Allow-Origin` | `*` |
| | `Content-Type` | `text/csv; charset=utf-8` |
| | `Cache-Control` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/*` | `X-Content-Type-Options` | `nosniff` |
| | `Referrer-Policy` | `strict-origin-when-cross-origin` |

`public/_headers` is generated from that same table, so the two cannot drift.

> ⚠️ **`_headers` is read by Cloudflare Pages and Netlify only.** It is inert on GitHub Pages, S3,
> nginx and most other hosts, which need their own configuration. **Since the host is undecided, CORS
> is currently unverified.** Do not assume it works until it has been checked against the real host
> with an actual cross-origin request. That check is not something the preflight can do.

The one-hour cache is chosen so a correction propagates the same day. The ledger changes on the order
of days, so nothing shorter buys anything.

## What is deliberately absent

- **No email capture.** §8: an alert is a promise about accuracy this project cannot yet make.
- **No scheduled revalidation yet.** §8 mentions it; it needs a host and a scheduler, and neither is
  decided. The status poller (`npm run status:poll`) runs one cycle and is likewise unscheduled.
- **No analytics.** Nothing on any page contacts anything at runtime, and check 6 enforces it.
