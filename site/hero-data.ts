/**
 * The figures shown in the forecast hero, computed once and shared by all pages.
 *
 * A single source so the three pages cannot disagree — a ledger page claiming
 * 55% while the forecast page says something else would undermine both.
 *
 * The clock is PINNED and matches build-forecast.ts. Claude Code's number moves
 * with the day of week (the calendar term), so an unpinned hero would show a
 * figure nobody could reproduce from the stated inputs.
 */
import { CODEX_BASELINE } from '../models/codex.ts';
import { CLAUDE_BASELINE } from '../models/claudeCode.ts';
import { claudeForecast, codexForecast, pct } from '../models/integrate.ts';

export const HERO_WINDOW = 48;
export const HERO_CLOCK = new Date('2026-07-07T12:00:00Z');

export function heroFigures() {
  const cl = claudeForecast(CLAUDE_BASELINE, 'launch', HERO_CLOCK, HERO_WINDOW);
  return {
    windowHours: HERO_WINDOW,
    codex: pct(codexForecast(CODEX_BASELINE, 'launch', HERO_WINDOW).probability),
    claude: pct(cl.probability),
    scheduled: pct(cl.scheduled.probability),
  };
}
