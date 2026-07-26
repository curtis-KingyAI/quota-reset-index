/**
 * Model B — Claude Code: renewal hazard with covariates, plus a scheduled track.
 *
 * Claude Code exposes seven_day.utilization and resets_at, so it can be
 * instrumented: a sentinel account turns "did a reset happen" into a sharp drop
 * in a number you already have. That state is worth conditioning on, so this is a
 * renewal hazard with covariates rather than a self-exciting process.
 *
 *   lambda(t) = lambda0 * D(utilisation) * K(day, hour)
 *             * exp( SUM w_j * s_j * 2^(-age_j/hl_j) )
 *
 *   scheduled: Phi((W - t_anchor) / sigma)
 *
 * The panel reports TWO numbers because the vendor gives two knowable things. The
 * scheduled recycle is near-deterministic; the discretionary reset is the
 * genuinely uncertain one. Do not add them — they are different questions.
 *
 * Ported from the prototype (§7). Unlike the Codex model this one READS THE CLOCK,
 * via the calendar term, which is why §7.2 requires the clock be pinned in tests.
 */

import {
  BASE,
  CALENDAR,
  CLAUDE_WEIGHTS,
  DEPLETION_CENTRE,
  DEPLETION_MAX_UPLIFT,
  DEPLETION_SCALE,
  PERIOD,
  SIGMA,
  type Regime,
} from './config.ts';
import { MIRROR_CUTOFF_HOURS, type Evidence, type EvidenceRow } from './codex.ts';

export interface ClaudeState {
  /** Hours since the last observed scheduled recycle. */
  since: number;
  /** Sentinel seven_day.utilization as a percentage, 0-100. */
  util: number;
  /** Anthropic status severity, 0-100. */
  inc: number;
  /** @ClaudeDevs signal strength, 0-100. UNREACHABLE in v1 — §2 forbids scraping X. */
  dev: number;
  /** Age of that post in hours. */
  devAge: number;
  /** Model availability event, 0-100. */
  model: number;
  /** Hours since OpenAI acted. Values > 120 mean "no recent move". */
  mirror: number;
}

export const CLAUDE_BASELINE: Readonly<ClaudeState> = Object.freeze({
  since: 25,
  util: 62,
  inc: 0,
  dev: 0,
  devAge: 6,
  model: 0,
  mirror: 121,
});

const decay = (age: number, halfLife: number): number => Math.pow(2, -age / halfLife);

export function claudeEvidence(s: ClaudeState, t: number): Evidence {
  const rows: EvidenceRow[] = [];
  let logSum = 0;

  const add = (key: keyof typeof CLAUDE_WEIGHTS, label: string, observed: string, strength: number, age: number) => {
    const { w, hl } = CLAUDE_WEIGHTS[key];
    const effect = w * strength * decay(age + t, hl);
    logSum += effect;
    rows.push({ key, label, observed, multiplier: Math.exp(effect) });
  };

  add('inc', 'Status incident', s.inc ? `severity ${s.inc}%, live` : 'no active incident', s.inc / 100, 0);
  add('dev', '@ClaudeDevs post', s.dev ? `${s.dev}% signal, ${s.devAge}h old` : 'quiet', s.dev / 100, s.devAge);
  add(
    'model',
    'Model availability event',
    s.model > 40 ? 'restoration / launch in progress' : 'none',
    s.model / 100,
    0,
  );

  const mirrorOn = s.mirror <= MIRROR_CUTOFF_HOURS;
  add('mirror', 'OpenAI mirroring', mirrorOn ? `OpenAI acted ${s.mirror}h ago` : 'no recent move', mirrorOn ? 1 : 0, mirrorOn ? s.mirror : 999);

  return { multiplier: Math.exp(logSum), rows };
}

/** Logistic depletion pressure. `u` is a FRACTION (0-1), not a percentage. */
export function depletion(u: number): number {
  return 1 + DEPLETION_MAX_UPLIFT / (1 + Math.exp(-(u - DEPLETION_CENTRE) / DEPLETION_SCALE));
}

/**
 * Calendar multiplier at offset t hours from `now`.
 *
 * `now` is injected rather than read from Date.now() so tests can pin it — the
 * prototype reads the clock directly here, which is exactly why its Claude Code
 * numbers move from day to day.
 */
export function calendar(now: Date, t: number): number {
  const at = new Date(now.getTime() + t * 3600_000);
  const day = at.getUTCDay();
  const hour = at.getUTCHours();

  const fri = CALENDAR.fridayAfternoon;
  if (day === fri.day && hour >= fri.fromHour && hour < fri.toHour) return fri.multiplier;

  const mon = CALENDAR.mondayMorning;
  if (day === mon.day && hour >= mon.fromHour && hour < mon.toHour) return mon.multiplier;

  if (day === 0 || day === 6) return CALENDAR.weekend.multiplier;
  return CALENDAR.ordinary.multiplier;
}

export function calendarLabel(now: Date): string {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  if (day === 5 && hour >= 11 && hour < 18) return 'Friday afternoon CET — hot spot';
  if (day === 1 && hour >= 5 && hour < 11) return 'Monday-morning spike window';
  if (day === 0 || day === 6) return 'weekend — suppressed';
  return 'ordinary weekday hour';
}

/** Instantaneous DISCRETIONARY intensity, events per hour, at offset t. */
export function claudeLambda(s: ClaudeState, regime: Regime, now: Date, t: number): number {
  return BASE[regime].claudeCode * depletion(s.util / 100) * calendar(now, t) * claudeEvidence(s, t).multiplier;
}

/**
 * Abramowitz & Stegun 7.1.26 error function. Max absolute error ~1.5e-7, which is
 * far inside the precision anyone reads off a percentage. Ported verbatim rather
 * than swapped for a library: §7 says port, and a different erf would silently
 * move the golden numbers.
 */
export function erf(x: number): number {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export interface ScheduledRecycle {
  /** Hours until the next scheduled recycle. Negative means overdue. */
  dueInHours: number;
  /** Probability it lands inside the window. */
  probability: number;
}

/**
 * The scheduled track. Near-deterministic, and the reason Claude Code gets two
 * numbers where Codex gets one.
 *
 * ⚠️ Faithful to the prototype: this uses only PERIOD and elapsed time. It does
 * NOT anchor to ANCHOR_UTC (04:50 UTC) despite the prototype's prose saying so.
 * See the note on ANCHOR_UTC in config.ts.
 */
export function scheduledRecycle(s: ClaudeState, windowHours: number): ScheduledRecycle {
  const dueInHours = PERIOD - s.since;
  const p = 0.5 * (1 + erf((windowHours - dueInHours) / (SIGMA * Math.SQRT2)));
  return { dueInHours, probability: Math.min(1, Math.max(0, p)) };
}
