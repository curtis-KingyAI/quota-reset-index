# Proposed amendment to SPEC §2 — mirrors as locators

**Status: DRAFT, awaiting operator approval. No record has been touched.**
Requested by the operator 2026-07-26. Drafted by claude-code-agent.

---

## The bullet as it stands

> - **No scraping X/Twitter.** Not via API-shaped endpoints, not via headless browser, not via
>   third-party mirrors. The vaguepost signal is out of scope for v1 by decision, not oversight.

## The bullet as amended

> - **No scraping X/Twitter.** Not via API-shaped endpoints, not via headless browser, not via
>   third-party mirrors. The vaguepost signal is out of scope for v1 by decision, not oversight.
>
>   **Amendment, 2026-07-26 — mirrors as locators.** A third-party mirror — any site whose content
>   is substantially republished X posts, including reset trackers — may be cited as a **locator**,
>   never as a source of **substance**.
>
>   - **Locator** means it establishes *that* a post exists, *which* post it is, and *where* it sits
>     in time. Permitted only when either (a) the claim it locates is independently sourced
>     elsewhere in the same record, or (b) the value taken from it is derivable offline from the
>     post ID alone.
>   - **Substance** means what was said, promised, changed, or scoped. A mirror may never be the
>     basis for any of these — however plainly it renders them, and however many mirrors agree.
>     Mirrors are correlated by construction: they copy the same upstream, so agreement between
>     them is not corroboration.
>   - **Post-ID timestamp decode is arithmetic, not testimony.** `timestamp_ms = (id >> 22) +
>     1288834974657` is an operation on an integer. It evidences *when* and asserts nothing about
>     *what*. It requires trusting the transcription of the ID, not the honesty of the mirror.
>   - **A record may never rest on a mirror alone.** If striking every mirror citation would leave
>     the record without evidence, the record does not exist. §4.2's evidence floor is unchanged.
>   - Mirror-sourced evidence entries carry `type: "user_report"` and must state the locator role in
>     the record's `notes`. They never carry `type: "vendor_post"`, whatever the mirror reproduces.
>
>   **Operational test.** Ask: *if this mirror were fabricating, what would change?*
>   If the answer is "the timestamp would move, and I can confirm it by decoding the ID" — locator,
>   permitted. If the answer is "I would no longer know what happened" — substance, prohibited.
>
>   Fetching a mirror to obtain a post ID is permitted. Fetching x.com to read the post is not, and
>   remains prohibited without exception.

---

## What this changes in the ledger

**8 records cite an X-scraping tracker, not 7.** The earlier count of 7 was taken before the
milestone batch landed. All 8 are listed below with the classification each would receive under the
amended rule. **Nothing here has been applied.**

| Record | Conf. | Tracker | Independent sources | Role the tracker plays | Under the amendment |
|---|---|---|---|---|---|
| `cx-2026-07-12-01` | probable | codex-resets.com | 4 — minimaxir, explainx, eesel, community.openai.com | corroborating only | **Locator — keep** |
| `cx-2026-07-13-01` | probable | codex-resets.com | 6 — incl. latent.space, community.openai.com | corroborating only | **Locator — keep** |
| `cx-2026-07-14-01` | probable | codex-resets.com | 3 — incl. github.com/openai | corroborating only | **Locator — keep** |
| `cx-2026-07-15-01` | probable | codex-resets.com | 3 — incl. 2× community.openai.com | corroborating only | **Locator — keep** |
| `cx-2026-07-16-01` | reported | codexreset.org | 3 — biggo, minimaxir, community.openai.com | **supplies the 04:14 UTC timestamp, independently confirmed by offline post-ID decode** | **Locator — keep**, the clearest case under clause (b) |
| `cx-2026-07-17-01` | probable | codex-resets.com | 4 — incl. news.ycombinator.com | corroborating only | **Locator — keep** |
| `cx-2026-07-18-01` | reported | codexreset.org | **1** — note.com only | supplies the timestamp **and** the announcement text | ⚠️ **Marginal.** Survives only because note.com independently attests the reset landed. If the amendment is read strictly, the tracker is carrying substance here. **Needs your ruling.** |
| `cx-2026-07-21-01` | reported | codexreset.org | **1** — unite.ai only | supplies the reset wording; unite.ai carries the milestone | ⚠️ **Marginal**, same shape. Also note unite.ai now returns 403 to a plain client, so this record's only non-tracker source is the harder one to re-fetch. **Needs your ruling.** |

**Six are clean.** Two — `cx-2026-07-18-01` and `cx-2026-07-21-01` — have a single independent
source each, and the tracker is doing more than locating. Those are the two the amendment does not
decide on its own.

Records are sealed, so any reclassification is a **superseding record**, not an edit. That means the
two marginal cases cost two new records each if you want their evidence lists changed — one to
supersede, one to replace. Worth deciding deliberately rather than reflexively.

## Not covered by this amendment

`minimaxir.com` is cited by 6 records and is **not** a mirror — it is an independent technical blog
whose author enumerated the resets and cited post IDs as references. Under the amended rule it is a
normal `user_report`/`press` source. Flagging it explicitly because "cites post IDs" is otherwise
easy to mistake for "is a mirror", and misclassifying it would strip six records of a real source.
