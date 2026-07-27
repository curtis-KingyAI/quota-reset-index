/**
 * Walk-forward backtest of the Codex forecaster against the ledger's own events.
 *
 * ── THE QUESTION ────────────────────────────────────────────────────────────
 *
 * Every forecast this project publishes carries a banner saying the weights are
 * hand-set priors that have never been checked against an outcome, and that the
 * banner comes off when a Brier score replaces it. Nobody had ever computed one.
 * The spec defers calibration until "roughly 40 labelled events per vendor" — but
 * that 40 is itself a hand-set number nobody justified, and a sharper question can
 * be asked with the 19 Codex events already recorded:
 *
 *     Does this model beat a constant rate?
 *
 * If it does not, the Hawkes excitation, the refractory dip and the mirroring term
 * are decoration, and the honest thing is to say so. A ledger built to be checkable
 * should be able to discover that about its own forecast.
 *
 * ── WHY WALK-FORWARD, AND WHY NOTHING IS FITTED ─────────────────────────────
 *
 * ⚠️ THE PRIORS WERE HAND-SET BY A HUMAN LOOKING AT THIS SAME EVENT RECORD. Scoring
 * the model in-sample would therefore be circular and flattering — it would measure
 * how well someone remembered July.
 *
 * So: nothing here fits anything. The model is scored EXACTLY AS PUBLISHED, and at
 * each decision point it may see only records with `effective_at` strictly before
 * that instant. The baselines are computed the same way, from the same restricted
 * history, or the comparison would be rigged in the model's favour.
 *
 * ── WHAT THIS CANNOT DO ─────────────────────────────────────────────────────
 *
 * - **Claude Code has 4 reset events.** Nothing here can say anything about it, and
 *   the asymmetry is structural rather than a backlog item.
 * - **19 events is a small sample.** The uncertainty is reported rather than buried;
 *   see the block bootstrap below and read the interval, not the point estimate.
 * - **Daily 48h windows OVERLAP.** Consecutive predictions are not independent, so
 *   the effective sample is smaller than the count of scored days. That is why the
 *   bootstrap resamples contiguous BLOCKS rather than individual days, and why a
 *   non-overlapping variant is reported alongside as a robustness check.
 */

import { codexForecast } from './integrate.ts';
import type { CodexState } from './codex.ts';
import { MIRROR_CUTOFF_HOURS } from './codex.ts';
import type { Regime } from './config.ts';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export interface Event {
  /** UTC instant of the reset. */
  at: number;
  vendor: string;
}

export interface Prediction {
  /** The instant the forecast is made. */
  at: number;
  /** P(at least one reset in [at, at + windowHours)). */
  p: number;
  /** Did one actually occur? */
  outcome: 0 | 1;
}

/** Brier score: mean squared error of a probabilistic forecast. Lower is better. */
export const brier = (rows: Prediction[]): number =>
  rows.reduce((s, r) => s + (r.p - r.outcome) ** 2, 0) / rows.length;

/**
 * Brier Skill Score against a reference. 0 = no better than the reference,
 * 1 = perfect, NEGATIVE = WORSE THAN THE REFERENCE.
 */
export const skill = (model: number, reference: number): number => (reference === 0 ? 0 : 1 - model / reference);

/**
 * State for the model at instant `now`, built from history strictly before it.
 *
 * The evidence covariates are held at zero deliberately: `inc` needs a status feed
 * nobody was running historically, and `tibo`/`launch` are unreachable by decision.
 * That is exactly what production does, so the backtest scores the model that is
 * actually published rather than a better one that has never existed.
 *
 * `mirror` IS derivable from the ledger and production uses it, so it is included.
 */
export function stateAt(now: number, codexHistory: number[], otherVendorHistory: number[]): CodexState | null {
  const past = codexHistory.filter((t) => t < now);
  if (!past.length) return null;
  const last = past[past.length - 1];
  const otherPast = otherVendorHistory.filter((t) => t < now);
  const lastOther = otherPast.length ? otherPast[otherPast.length - 1] : null;

  return {
    since: (now - last) / HOUR_MS,
    prior: past.filter((t) => t > now - 14 * DAY_MS).length,
    inc: 0,
    tibo: 0,
    tiboAge: 4,
    launch: 0,
    mirror: lastOther === null ? MIRROR_CUTOFF_HOURS + 1 : (now - lastOther) / HOUR_MS,
  };
}

export interface RunOptions {
  windowHours?: number;
  /** Days of history required before scoring starts. */
  warmupDays?: number;
  /** 1 = score every day (windows overlap); 2 = non-overlapping 48h windows. */
  strideDays?: number;
}

export interface Series {
  regime: Regime | 'baseline-constant' | 'baseline-climatology';
  rows: Prediction[];
  brier: number;
}

const occurred = (events: number[], from: number, to: number): 0 | 1 =>
  events.some((t) => t >= from && t < to) ? 1 : 0;

/**
 * Score the model at every regime, plus two baselines, over the same days.
 *
 * ⚠️ THE BASELINES ARE WALK-FORWARD TOO. A constant rate computed from the whole
 * span would know the future, and beating a handicapped reference would prove
 * nothing. `baseline-constant` uses only the rate observed so far; `climatology`
 * uses the observed frequency of positive windows so far, which is the strongest
 * honest reference — it is what "just predict the historical base rate" means.
 */
export function run(
  codexEvents: number[],
  otherEvents: number[],
  regimes: Regime[],
  { windowHours = 48, warmupDays = 21, strideDays = 1 }: RunOptions = {},
): { series: Series[]; days: number; positives: number } {
  const sorted = [...codexEvents].sort((a, b) => a - b);
  const start = sorted[0] + warmupDays * DAY_MS;
  const end = sorted[sorted.length - 1];
  const W = windowHours * HOUR_MS;

  const days: number[] = [];
  for (let t = start; t + W <= end; t += strideDays * DAY_MS) days.push(t);

  const series: Series[] = [];

  for (const regime of regimes) {
    const rows: Prediction[] = [];
    for (const at of days) {
      const s = stateAt(at, sorted, otherEvents);
      if (!s) continue;
      rows.push({ at, p: codexForecast(s, regime, windowHours).probability, outcome: occurred(sorted, at, at + W) });
    }
    series.push({ regime, rows, brier: brier(rows) });
  }

  // Baseline 1: a homogeneous Poisson process at the rate observed SO FAR.
  const constRows: Prediction[] = [];
  // Baseline 2: the observed frequency of positive windows SO FAR — "just say the
  // historical rate". This is the reference a forecast must beat to be worth having.
  const climRows: Prediction[] = [];

  for (const at of days) {
    const past = sorted.filter((t) => t < at);
    const elapsedDays = (at - sorted[0]) / DAY_MS;
    const rate = elapsedDays > 0 ? past.length / elapsedDays : 0;
    constRows.push({ at, p: 1 - Math.exp(-rate * (windowHours / 24)), outcome: occurred(sorted, at, at + W) });

    const priorDays = days.filter((d) => d < at);
    const priorPos = priorDays.filter((d) => occurred(sorted, d, d + W)).length;
    climRows.push({
      at,
      p: priorDays.length ? priorPos / priorDays.length : 0.5,
      outcome: occurred(sorted, at, at + W),
    });
  }

  series.push({ regime: 'baseline-constant', rows: constRows, brier: brier(constRows) });
  series.push({ regime: 'baseline-climatology', rows: climRows, brier: brier(climRows) });

  return { series, days: days.length, positives: constRows.filter((r) => r.outcome === 1).length };
}

/** Deterministic PRNG, so a published figure is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Block bootstrap CI for the skill score.
 *
 * Contiguous blocks, NOT individual days: overlapping 48h windows make consecutive
 * predictions correlated, and resampling days independently would pretend the
 * sample is larger than it is and produce a falsely tight interval.
 */
export function bootstrapSkill(
  model: Prediction[],
  reference: Prediction[],
  { blocks = 7, iterations = 2000, seed = 20260727 } = {},
): { lo: number; hi: number } {
  const rand = mulberry32(seed);
  const n = model.length;
  const nBlocks = Math.ceil(n / blocks);
  const out: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const m: Prediction[] = [];
    const r: Prediction[] = [];
    for (let b = 0; b < nBlocks; b++) {
      const startIdx = Math.floor(rand() * Math.max(1, n - blocks));
      for (let k = 0; k < blocks && m.length < n; k++) {
        m.push(model[startIdx + k]);
        r.push(reference[startIdx + k]);
      }
    }
    out.push(skill(brier(m), brier(r)));
  }
  out.sort((a, b) => a - b);
  return { lo: out[Math.floor(iterations * 0.025)], hi: out[Math.floor(iterations * 0.975)] };
}

/** Mean forecast vs observed frequency — over- or under-forecasting, in one line. */
export const calibrationInTheLarge = (rows: Prediction[]) => ({
  meanForecast: rows.reduce((s, r) => s + r.p, 0) / rows.length,
  observedFrequency: rows.reduce((s, r) => s + r.outcome, 0) / rows.length,
});
