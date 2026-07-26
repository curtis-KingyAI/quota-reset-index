/**
 * Survival: P(at least one event in W) = 1 - exp(-INTEGRAL_0^W lambda dt).
 *
 * Midpoint rule at 0.25h steps (§7.1). Midpoint rather than left-endpoint matters:
 * both models are steep near t=0 — the Codex refractory dip especially — and a
 * left-endpoint sum would bias the short windows.
 */

import { STEP_HOURS } from './config.ts';
import { codexLambda, type CodexState } from './codex.ts';
import { claudeLambda, scheduledRecycle, type ClaudeState } from './claudeCode.ts';
import type { Regime } from './config.ts';

/** Integrate an intensity over [0, windowHours) and convert to a probability. */
export function survivalProbability(lambda: (t: number) => number, windowHours: number, step = STEP_HOURS): number {
  let integral = 0;
  for (let t = 0; t < windowHours; t += step) integral += lambda(t + step / 2) * step;
  return 1 - Math.exp(-integral);
}

export interface Forecast {
  windowHours: number;
  /** Probability of at least one discretionary event in the window. */
  probability: number;
  /** Instantaneous intensity now, events per hour. */
  lambdaNow: number;
  /** Mean wait at the current rate, in hours. Infinity when lambda is 0. */
  meanWaitHours: number;
}

export function codexForecast(s: CodexState, regime: Regime, windowHours: number): Forecast {
  const lambdaNow = codexLambda(s, regime, 0);
  return {
    windowHours,
    probability: survivalProbability((t) => codexLambda(s, regime, t), windowHours),
    lambdaNow,
    meanWaitHours: lambdaNow > 0 ? 1 / lambdaNow : Infinity,
  };
}

export interface ClaudeForecast extends Forecast {
  /** The scheduled track. Reported separately — never summed with `probability`. */
  scheduled: { dueInHours: number; probability: number };
}

export function claudeForecast(s: ClaudeState, regime: Regime, now: Date, windowHours: number): ClaudeForecast {
  const lambdaNow = claudeLambda(s, regime, now, 0);
  return {
    windowHours,
    probability: survivalProbability((t) => claudeLambda(s, regime, now, t), windowHours),
    lambdaNow,
    meanWaitHours: lambdaNow > 0 ? 1 / lambdaNow : Infinity,
    scheduled: scheduledRecycle(s, windowHours),
  };
}

/** Percent, rounded the way the UI rounds it. Golden tests assert on this. */
export const pct = (p: number): number => Math.round(p * 100);
