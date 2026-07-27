/**
 * The figures shown in the forecast hero, computed once and shared by all pages.
 *
 * Codex is DERIVED FROM THE LEDGER (see live-state.ts): its inputs are literally
 * what the ledger records, so the number reflects the project's own evidence
 * rather than a frozen constant. It is recomputed in the browser against the
 * real clock, so it moves as time passes without any rebuild.
 *
 * Claude Code is NOT ledger-driven and is not claimed to be. Its model needs
 * hours-since-scheduled-recycle and current utilisation; the ledger holds
 * neither, and the sentinel that would have measured utilisation was closed.
 * Its figures come from a stated baseline and the page says so.
 */
import { CODEX_BASELINE } from '../models/codex.ts';
import { CLAUDE_BASELINE } from '../models/claudeCode.ts';
import { claudeForecast, codexForecast, pct } from '../models/integrate.ts';
import type { Regime } from '../models/config.ts';
import { codexLiveState, coverageSpan, elapsedLabel } from './live-state.ts';
import { ABANDONED_DAYS, STALE_DAYS, lastReviewedAt } from '../lib/sweeps.mjs';

export const HERO_WINDOW = 48;

/**
 * Pinned clock for Claude Code only. Its calendar term is day-of-week dependent,
 * so an unstated clock would render a figure nobody could reproduce.
 */
export const CLAUDE_CLOCK = new Date('2026-07-07T12:00:00Z');

/**
 * The regime the hero speaks in.
 *
 * ── CHANGED 2026-07-27: `launch` → `normal`, ON EVIDENCE ────────────────────
 *
 * This was the largest undisclosed assumption on the site. `launch` is the HIGHEST
 * of the three base rates, and the hero showed it with no indication that it was a
 * choice at all — 46% where `normal` gave 29% and `quiet` 16%.
 *
 * The first walk-forward backtest (docs/CALIBRATION.md, `npm run backtest`) settled
 * it against the 19 Codex events on record:
 *
 *   normal   Brier 0.1744   mean forecast 25.4%   observed 25.8%   ← best, and calibrated
 *   quiet    Brier 0.1870   mean forecast 15.8%
 *   launch   Brier 0.1895   mean forecast 38.9%   ← OVER-FORECAST BY ~14 POINTS
 *
 * `launch` also scored BELOW a constant-rate baseline on non-overlapping windows —
 * worse than assuming nothing. `normal` ranked first under both window schemes.
 *
 * ⚠️ THIS IS REGIME SELECTION, NOT FITTING. Nothing in the model was tuned; three
 * already-published configurations were scored and one matched the record. The
 * weights remain hand-set priors and the §7.3 banner remains, because no
 * configuration's skill interval excludes zero at 19 events.
 *
 * ⚠️ AND IT IS STILL NOT DERIVED AT RUN TIME, deliberately. The obvious proxy —
 * recent event density — is exactly what the trailing-fortnight term already
 * measures, so deriving the regime from it would count the same signal twice and
 * silently double the effect of a cluster. It is an editorial claim, now an
 * evidenced one, and it should be revisited when the corpus grows.
 *
 * Exported and threaded through to the hero so the LABEL cannot drift from the
 * VALUE. Tests assert the rendered page names whichever regime is set here.
 */
export const HERO_REGIME: Regime = 'normal';

/**
 * The regimes NOT shown, so the hero can present the range rather than assert a point.
 *
 * ⚠️ DERIVED from HERO_REGIME, never listed by hand. It was hardcoded to
 * ['quiet','normal'] and the moment HERO_REGIME changed to `normal` the hero
 * cheerfully offered "the other two give 16% (quiet) and 29% (normal)" — listing
 * the shown regime as its own alternative. Same class of defect as every stale
 * hand-maintained figure fixed today, introduced in the act of fixing them.
 */
const ALL_REGIMES: Regime[] = ['quiet', 'normal', 'launch'];
const OTHER_REGIMES: Regime[] = ALL_REGIMES.filter((r) => r !== HERO_REGIME);

export function heroFigures() {
  const live = codexLiveState();
  const cx = { ...CODEX_BASELINE, since: live.since, prior: live.prior };
  const cl = claudeForecast(CLAUDE_BASELINE, HERO_REGIME, CLAUDE_CLOCK, HERO_WINDOW);

  return {
    windowHours: HERO_WINDOW,
    regime: HERO_REGIME,
    // Codex at the regimes NOT shown, so the reader can see the spread the single
    // headline figure hides.
    alternatives: OTHER_REGIMES.map((r) => ({
      regime: r,
      codex: pct(codexForecast(cx, r, HERO_WINDOW).probability),
    })),
    codex: pct(codexForecast(cx, HERO_REGIME, HERO_WINDOW).probability),
    claude: pct(cl.probability),
    scheduled: pct(cl.scheduled.probability),
    // Everything the browser needs to recompute Codex against the real clock.
    live: {
      lastResetIso: live.lastResetIso,
      asOfIso: live.asOfIso,
      prior: live.prior,
      sinceLabel: elapsedLabel(live.since),
      // Shipped so the browser recomputes `prior` too. A frozen `prior` only
      // ever over-states the probability as the anchor ages, because resets can
      // age OUT of the fortnight but none can appear.
      recentResetIsos: live.recentResetIsos,
      coverage: coverageSpan(),
      // When this ledger last had human attention: the later of "we learned
      // something" (a record's observed_at) and "we looked" (a sweep). Only the
      // pair distinguishes a genuinely quiet period from an abandoned project,
      // which is the risk the operate-it decision creates. See lib/sweeps.mjs.
      reviewedIso: lastReviewedAt(live.asOfIso),
      staleDays: STALE_DAYS,
      abandonedDays: ABANDONED_DAYS,
    },
  };
}
