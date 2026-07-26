/**
 * EVERY weight, half-life and base rate in the two models. One place, by §7.1.
 *
 * ⚠️ READ THIS BEFORE CHANGING ANY NUMBER IN THIS FILE ⚠️
 *
 * Not one of these constants is a fitted parameter. Every one is a prior set by
 * hand from the public July 2026 event record. They are structured opinions.
 * They have never been checked against an outcome, and no number here has a
 * confidence interval because there is no sample behind it to compute one from.
 *
 * They become fitted parameters in Phase 6, by maximum-likelihood against the
 * ledger with a held-out window, at roughly 40 labelled events per vendor. Until
 * that happens every rendered forecast carries the §7.3 banner, and the banner
 * is removed only by replacing it with a Brier score.
 *
 * Source of truth for the values is the working prototype
 * (quota-reset-forecast.html). §7 says PORT it, do not reimplement it — so where
 * a constant looks arbitrary, that is faithful, not sloppy.
 */

export type Regime = 'quiet' | 'normal' | 'launch';

/**
 * Unconditional discretionary event rate, events per HOUR.
 *
 * Hand-set prior. Authored as events-per-day/24 in the prototype and kept in that
 * form so the daily figure stays legible: Codex 0.09/0.18/0.33 per day, Claude
 * Code 0.04/0.07/0.12 per day. The launch-regime Codex figure is the one with any
 * observational support at all — six direct resets in the nine days after the
 * GPT-5.6 launch — and even that is a count, not a fit.
 */
export const BASE: Readonly<Record<Regime, { codex: number; claudeCode: number }>> = Object.freeze({
  quiet: { codex: 0.09 / 24, claudeCode: 0.04 / 24 },
  normal: { codex: 0.18 / 24, claudeCode: 0.07 / 24 },
  launch: { codex: 0.33 / 24, claudeCode: 0.12 / 24 },
});

// ---------------------------------------------------------------- Codex (Hawkes)

/**
 * Hawkes excitation: each past reset adds ALPHA to the intensity, decaying with
 * time constant TAU hours. Hand-set. ALPHA=0.020 is roughly 1.5x the launch-regime
 * base rate, i.e. "a reset that just happened roughly doubles the near-term rate".
 * TAU=30h is eyeballed from the July cluster, where repeats landed inside ~1-2 days.
 */
export const ALPHA = 0.02;
export const TAU = 30;

/**
 * Refractory dip: immediately after a reset the instantaneous rate is suppressed
 * by REFR_K (85%), relaxing with time constant REFR_T hours.
 *
 * ⚠️ REFR_K and ALPHA pull in OPPOSITE directions and their interaction is the
 * model's most load-bearing behaviour: a reset 2h ago LOWERS instantaneous lambda
 * but RAISES the 48h window probability, because excitation outlives the dip.
 * That is intentional and §7.2 pins it with a test. A "fix" that reverses it is a
 * regression, not a correction.
 */
export const REFR_K = 0.85;
export const REFR_T = 8;

/**
 * EWMA stand-in for mu. The prototype does not implement a real EWMA over the
 * ledger; it approximates one as base * (0.55 + 0.075 * resets_in_trailing_14d),
 * so 6 resets/14d lands exactly on the unmodified base rate. Replacing this with
 * a true EWMA over the ledger is the obvious Phase 6 improvement.
 */
export const MU_INTERCEPT = 0.55;
export const MU_PER_PRIOR_RESET = 0.075;

/**
 * Codex evidence terms: log-multiplier weight, and half-life in hours.
 *
 * w is applied as exp(w * strength * 2^(-age/hl)), so w=1.45 at full strength and
 * zero age multiplies lambda by ~4.3. Half-lives encode how fast each signal goes
 * stale: a vaguepost is worthless in ~10h, an incident stays relevant ~36h.
 *
 * `launch` has hl=1e9, i.e. no decay — proximity to a release window is a state,
 * not an event, so it does not age within a 96h horizon.
 *
 * ⚠️ `tibo` is the @thsottiaux vaguepost signal. It is UNREACHABLE in v1: §2
 * prohibits scraping X, so nothing can ever set its strength above 0. The weight
 * is retained so the port is faithful and so the term is ready if the prohibition
 * is ever lifted, but treat this model as having three live evidence terms, not four.
 */
export const CODEX_WEIGHTS = Object.freeze({
  inc: { w: 1.1, hl: 36 },
  tibo: { w: 1.45, hl: 10 },
  launch: { w: 0.75, hl: 1e9 },
  mirror: { w: 0.6, hl: 40 },
});

// ---------------------------------------------------- Claude Code (renewal hazard)

/**
 * Claude Code evidence terms. Same exp(w * strength * decay) form.
 * ⚠️ `dev` is the @ClaudeDevs signal and is likewise UNREACHABLE in v1 under §2.
 */
export const CLAUDE_WEIGHTS = Object.freeze({
  inc: { w: 1.05, hl: 36 },
  dev: { w: 1.35, hl: 12 },
  model: { w: 0.95, hl: 48 },
  mirror: { w: 0.7, hl: 44 },
});

/**
 * Depletion pressure: a logistic in weekly utilisation, rising from ~1.0 to ~2.7.
 * Centred at 0.74 with scale 0.075, so it is nearly flat below 60% utilisation and
 * nearly saturated above 90%. The premise — that goodwill resets cluster where
 * depletion and complaint pressure peak together — is a hypothesis, not a finding.
 */
export const DEPLETION_MAX_UPLIFT = 1.7;
export const DEPLETION_CENTRE = 0.74;
export const DEPLETION_SCALE = 0.075;

/**
 * Scheduled recycle track. An observed ~72h cadence anchored near 04:50 UTC with
 * roughly +/-0.6h of drift, modelled as a Gaussian CDF around the due time.
 *
 * ⚠️ ANCHOR_UTC is declared in the prototype and NEVER USED — scheduledRecycle()
 * computes purely from PERIOD and elapsed time, so the model does not actually
 * anchor to a wall-clock hour at all. Ported faithfully, including the gap.
 * Recorded here rather than silently dropped, because a reader comparing the
 * prototype's prose ("anchored near 04:50-05:00 UTC") to its code would otherwise
 * assume this file lost something.
 */
export const ANCHOR_UTC = 4.85;
export const PERIOD = 72;
export const SIGMA = 0.6;

/**
 * Calendar multipliers, by UTC day-of-week and hour. Hand-set from the claim that
 * Friday afternoon CET is a hot spot for goodwill resets. Weekends are suppressed.
 * ⚠️ This is the ONLY clock-dependent term in either model, which is why §7.2 says
 * to pin the clock in tests: the same inputs on a Tuesday and a Saturday give
 * materially different Claude Code numbers.
 */
export const CALENDAR = Object.freeze({
  fridayAfternoon: { day: 5, fromHour: 11, toHour: 18, multiplier: 1.95 },
  mondayMorning: { day: 1, fromHour: 5, toHour: 11, multiplier: 1.35 },
  weekend: { multiplier: 0.75 },
  ordinary: { multiplier: 1.0 },
});

// ---------------------------------------------------------------- integration

/** §7.1: survival integrated in 0.25h steps. */
export const STEP_HOURS = 0.25;
/** Chart horizon in the prototype; also the widest window worth integrating. */
export const HORIZON_HOURS = 96;

/** §7.3. Rendered adjacent to any forecast number, unhidden, until Phase 6. */
export const CALIBRATION_BANNER =
  'Uncalibrated. Weights are hand-set priors from the public event record, not fitted parameters.';
