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
import { codexLiveState, coverageSpan, elapsedLabel } from './live-state.ts';
import { ABANDONED_DAYS, STALE_DAYS, lastReviewedAt } from '../lib/sweeps.mjs';

export const HERO_WINDOW = 48;

/**
 * Pinned clock for Claude Code only. Its calendar term is day-of-week dependent,
 * so an unstated clock would render a figure nobody could reproduce.
 */
export const CLAUDE_CLOCK = new Date('2026-07-07T12:00:00Z');

export function heroFigures() {
  const live = codexLiveState();
  const cx = { ...CODEX_BASELINE, since: live.since, prior: live.prior };
  const cl = claudeForecast(CLAUDE_BASELINE, 'launch', CLAUDE_CLOCK, HERO_WINDOW);

  return {
    windowHours: HERO_WINDOW,
    codex: pct(codexForecast(cx, 'launch', HERO_WINDOW).probability),
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
