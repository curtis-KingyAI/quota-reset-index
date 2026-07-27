# Quota Reset Index

**A sourced, append-only record of discretionary AI quota resets — and two forecasts built on it.**

Live at **[ledger.kingy.ai](https://ledger.kingy.ai)** · data at
[`/ledger.json`](https://ledger.kingy.ai/ledger.json) and
[`/ledger.csv`](https://ledger.kingy.ai/ledger.csv), CORS-open and CC BY 4.0.

When OpenAI or Anthropic hand out a goodwill quota reset — after an outage, at a user milestone, during
a launch week — it is announced once, usually on social media, and then it is gone. Nobody keeps the
receipts. This does.

---

## What is actually here

| | |
|---|---|
| Records | **47** — 28 current, 19 superseded |
| Vendors | OpenAI Codex · Anthropic Claude Code |
| Coverage | 2026-03-13 → 2026-07-21 |
| Evidence | 86 cited sources on current records, **99% with a Wayback capture** |
| Tests | 104 |

## Why you might trust it

**Nothing is ever edited or deleted.** A correction is a *new* record that links back to the one it
replaces, and both stay visible on the site. The git history is the audit trail — and it is checked
in CI against full history, not just by a local hook, because a pre-commit hook runs where the author
controls it.

**Every claim carries its provenance.** Scope and trigger fields are marked `attested` (a source
states it of this specific event), `inferred` (it follows from a general statement — nobody asserted
it here), or `unestablished` (nothing addresses it). That distinction exists because an audit found
24 of 29 records asserting scope no source had actually claimed. Those were corrected by supersession
and the markers are what stop it recurring.

**Sources are graded, not merely listed.** `confirmed` requires a vendor post or status page.
Third-party trackers that republish social posts may locate a claim but may never carry its substance.

**The forecasts are labelled uncalibrated, because they are.** Every weight is a hand-set prior. None
has been checked against an outcome. The banner comes off when a Brier score replaces it, not before.

## Repository layout

```
ledger/<vendor>/<id>.json   one record per file — the asset
archive/<sha256>.json       Wayback captures, appended never rewritten
schema/                     JSON Schema for a record
lib/  scripts/              validation, deterministic build, append-only enforcement
models/                     the two forecasters, ported from a prototype
site/                       static site generator
docs/                       runbook, status, migration plans, research
```

## Working on it

```bash
npm install
npm run hooks:install   # without this, nothing is enforced locally
npm run validate        # every record, by file and field
npm test
npm run build           # regenerates public/ deterministically
npm run check:history   # append-only, verified against full git history
```

**Before adding a record, read [`docs/RUNBOOK.md`](docs/RUNBOOK.md).** It is written for a human doing
the intake by hand, and its "what not to do" list is drawn entirely from mistakes actually made here.

## Licence

Data and text: [CC BY 4.0](LICENSE). Attribute to the Quota Reset Index and link back.
Code: MIT, see [LICENSE](LICENSE).

Corrections are welcome — against the evidence, not against the conclusions.
