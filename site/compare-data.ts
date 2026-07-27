/**
 * What the other Codex reset trackers do, as data.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY CLAIM HERE IS A CLAIM ABOUT SOMEONE ELSE'S WORK. That raises the standard, not lowers it.
 * The rules this file exists to enforce:
 *
 *   1. Only what was SEEN. Each row records what the site showed on CHECKED_ON, not what it is
 *      assumed to do. A first draft of this comparison asserted "historical record: none" for two
 *      trackers that plainly have one, and "they don't forecast" for one that does. Three rows were
 *      false and all three were falsifiable by opening the site. Hence: fetch, then write.
 *
 *   2. No fragile counts. Entry totals move daily and two reads of codexreset.org disagreed on its
 *      own total, so counts are NOT published as differentiators. The published axes are structural
 *      — does it cover Claude Code, is there a download, is there a correction history — because
 *      those are categorical and stay true between checks.
 *
 *   3. Losing rows are not optional. `AHEAD_OF_US` renders on the same page, and a test enforces
 *      that it is non-empty. A comparison table with no losing rows is an advertisement, and this
 *      site's entire argument is that its claims can be checked.
 *
 *   4. Staleness is a build failure, not a disclaimer. See STALE_AFTER_DAYS below.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * The date all three sites were last fetched and read. Bump ONLY after actually re-fetching.
 *
 * ⚠️ UTC, LIKE EVERY OTHER DATE IN THIS PROJECT. Corrected from 2026-07-26 on 2026-07-27.
 *
 * The fetches ran at ~02:2x–02:4x UTC, which is ~19:2x–19:4x the previous evening in US Pacific. The
 * first value recorded the Pacific date, and the reasoning offered for it was that 2026-07-27 "had
 * not happened yet" — true locally, false in UTC, where it was already 02:51 on the 27th.
 *
 * That is precisely the defect RUNBOOK §5 exists to prevent, and it has already cost this ledger
 * real work: one event was recorded TWICE under the two conventions, and a separate pair was nearly
 * merged wrongly. `minimaxir.com` dates in Pacific, `codexreset.org` dates in UTC, and every one of
 * the ten cross-checked post ids maps at exactly UTC-7.
 *
 * A one-day error in the date stamp on a page that grades other people's accuracy is the worst place
 * in the repository to have one. Keep this in UTC; check with `date -u +%F`, never the local clock.
 */
export const CHECKED_ON = '2026-07-27';

/**
 * How far the comparison may drift behind the ledger before the build refuses to publish it.
 *
 * Measured against the ledger's own AS_OF, never the wall clock, so §4.4 determinism holds: the
 * same commit builds the same bytes forever. The point is that a comparison silently ageing into
 * falsehood is worse than no comparison — a reader cannot tell a stale row from a wrong one.
 */
export const STALE_AFTER_DAYS = 120;

export type Cell = 'yes' | 'no' | 'partial';

export interface Tracker {
  name: string;
  url: string;
  /** How the site describes itself, verbatim where possible. */
  blurb: string;
  /** Forecasts the next reset. */
  forecast: Cell;
  forecastNote: string;
  /** Publishes a list of past events. */
  history: Cell;
  historyNote: string;
  /** Covers Anthropic Claude Code, not only OpenAI Codex. */
  claudeCode: Cell;
  /** Links a source on each entry. */
  sources: Cell;
  sourcesNote: string;
  /** Archived/immutable copies of those sources. */
  archived: Cell;
  /** Machine-readable export. */
  download: Cell;
  downloadNote: string;
  /** Per-event confidence grading. */
  confidence: Cell;
  /** Visible correction history. */
  corrections: Cell;
  /** Published method with the actual parameters, not just a description of the inputs. */
  methodology: Cell;
  methodologyNote: string;
}

export const TRACKERS: Tracker[] = [
  {
    name: 'willcodexquotareset.com',
    url: 'https://www.willcodexquotareset.com/',
    blurb: 'Will Codex Reset? — a single-page verdict on the next 48 hours.',
    forecast: 'yes',
    forecastNote: 'A 48-hour verdict. Self-described as “a transparent heuristic, not a serious statistical model”.',
    history: 'no',
    historyNote: 'No past events are listed. The page shows the current call only.',
    claudeCode: 'no',
    sources: 'no',
    sourcesNote: 'Nothing to link — there are no entries.',
    archived: 'no',
    download: 'no',
    downloadNote: 'No JSON, CSV or API.',
    confidence: 'no',
    corrections: 'no',
    methodology: 'partial',
    methodologyNote:
      'Names its four inputs — OpenAI status, @thsottiaux posts, product launches, cooldown timers — but publishes no weights.',
  },
  {
    name: 'codexreset.org',
    url: 'https://codexreset.org',
    blurb: 'Codex Reset Monitor — a timeline of confirmed resets plus 24h/48h estimates.',
    forecast: 'yes',
    forecastNote: 'Publishes both a 24-hour and a 48-hour figure, off a reset-cadence baseline.',
    history: 'yes',
    historyNote: 'A rolling timeline; on the date checked it ran from 29 June to 25 July 2026.',
    claudeCode: 'no',
    sources: 'yes',
    sourcesNote: 'Says every public source stays linked from the timeline.',
    archived: 'no',
    download: 'no',
    downloadNote: 'No JSON, CSV or API.',
    confidence: 'no',
    corrections: 'no',
    methodology: 'partial',
    methodologyNote: 'Describes its inputs — hourly X API over approved accounts, plus OpenAI Status — without publishing parameters.',
  },
  {
    name: 'codex-resets.com',
    url: 'https://codex-resets.com',
    blurb: 'Built by @wong2__ — the longest event list of the three, with interval statistics.',
    forecast: 'no',
    forecastNote: 'Reports intervals rather than probabilities: average gap and longest wait.',
    history: 'yes',
    historyNote: 'The longest run of the three. Its oldest entries predate this ledger’s March start.',
    claudeCode: 'no',
    sources: 'yes',
    sourcesNote: 'Each entry carries a “View on X →” link to the original post.',
    archived: 'no',
    download: 'no',
    downloadNote: 'Web page and Telegram alerts; no JSON, CSV or API.',
    confidence: 'no',
    corrections: 'no',
    methodology: 'partial',
    methodologyNote: 'States its source — @thsottiaux’s posts, machine-classified — without publishing the classifier.',
  },
];

/**
 * Where the other trackers beat this one.
 *
 * Kept honest deliberately, and pinned by a test. Point 1 is the important one: it is the axis a
 * reader most likely cares about, and we lose it.
 */
export const AHEAD_OF_US: { claim: string; detail: string }[] = [
  {
    claim: 'All three react faster than we do.',
    detail:
      'They poll automatically and update within the hour. This ledger is curated by hand, so a reset can be real for a day before it appears here. If you want to know what happened in the last hour, go to them.',
  },
  {
    claim: 'codex-resets.com covers a longer span.',
    detail:
      'Its event list reaches back further than this ledger’s earliest record of 13 March 2026. More history is more history, and we do not have it yet.',
  },
  {
    claim: 'They are simpler.',
    detail:
      'One page, one number, nothing to learn. A schema, a confidence grade and a supersede chain are overhead — worth it if you need to check a claim, pure friction if you just want the number.',
  },
];

/**
 * The claim that survives contact with their sites.
 *
 * NOT "more events" and NOT "faster" — both are false or contested. Auditability is narrower and
 * it holds: it is the only axis on which the answer elsewhere is categorically "not offered".
 */
export const THE_CLAIM =
  'Every record here can be checked, and when one of ours was wrong you can see that it was wrong and what replaced it.';
