/**
 * Model A — Codex: self-exciting (Hawkes) intensity.
 *
 * You cannot see Codex quota state from outside, so the reset history is the
 * richest signal available. Resets arrive in bursts, which is the signature of a
 * self-exciting process rather than a memoryless one. Hence a Hawkes intensity
 * with a short refractory dip.
 *
 *   lambda(t) = [mu + alpha * e^(-dt/tau)]
 *             * refractory(dt)
 *             * exp( SUM w_j * s_j * 2^(-age_j/hl_j) )
 *
 * Ported from the prototype, not reimplemented (§7). Pure and clock-independent:
 * nothing here reads the wall clock, which is why the Codex golden numbers in
 * §7.2 hold on any day of the week.
 */

import { ALPHA, BASE, CODEX_WEIGHTS, MU_INTERCEPT, MU_PER_PRIOR_RESET, REFR_K, REFR_T, TAU, type Regime } from './config.ts';

export interface CodexState {
  /** Hours since the last observed reset. */
  since: number;
  /** Resets in the trailing 14 days. Feeds the EWMA stand-in for mu. */
  prior: number;
  /** OpenAI status severity, 0-100. */
  inc: number;
  /** @thsottiaux signal strength, 0-100. UNREACHABLE in v1 — §2 forbids scraping X. */
  tibo: number;
  /** Age of that post in hours. */
  tiboAge: number;
  /** Launch-window proximity, 0-100. */
  launch: number;
  /** Hours since Anthropic acted. Values > 120 mean "no recent move". */
  mirror: number;
}

export const CODEX_BASELINE: Readonly<CodexState> = Object.freeze({
  since: 38,
  prior: 6,
  inc: 0,
  tibo: 0,
  tiboAge: 4,
  launch: 0,
  mirror: 121,
});

/** Signals older than this are treated as absent. */
export const MIRROR_CUTOFF_HOURS = 120;

const decay = (age: number, halfLife: number): number => Math.pow(2, -age / halfLife);

export interface EvidenceRow {
  key: string;
  label: string;
  observed: string;
  /** Multiplicative effect on lambda. 1.0 means no effect. */
  multiplier: number;
}

export interface Evidence {
  multiplier: number;
  rows: EvidenceRow[];
}

/**
 * Evidence multiplier at offset t hours from now.
 *
 * Note the ageing: each signal's age is (its age now + t), so evidence decays
 * across the forecast window rather than being frozen at t=0. That is what makes
 * a fresh incident matter more for a 12h window than a 72h one.
 */
export function codexEvidence(s: CodexState, t: number): Evidence {
  const rows: EvidenceRow[] = [];
  let logSum = 0;

  const add = (key: keyof typeof CODEX_WEIGHTS, label: string, observed: string, strength: number, age: number) => {
    const { w, hl } = CODEX_WEIGHTS[key];
    const effect = w * strength * decay(age + t, hl);
    logSum += effect;
    rows.push({ key, label, observed, multiplier: Math.exp(effect) });
  };

  add('inc', 'Status incident', s.inc ? `severity ${s.inc}%, live` : 'no active incident', s.inc / 100, 0);
  add('tibo', '@thsottiaux post', s.tibo ? `${s.tibo}% signal, ${s.tiboAge}h old` : 'quiet', s.tibo / 100, s.tiboAge);
  add(
    'launch',
    'Launch proximity',
    s.launch > 55 ? 'inside release window' : s.launch > 20 ? 'adjacent' : 'no release nearby',
    s.launch / 100,
    0,
  );

  const mirrorOn = s.mirror <= MIRROR_CUTOFF_HOURS;
  add(
    'mirror',
    'Anthropic mirroring',
    mirrorOn ? `Anthropic acted ${s.mirror}h ago` : 'no recent move',
    mirrorOn ? 1 : 0,
    // 999 rather than the raw value so an "off" mirror decays to nothing rather
    // than contributing a small residual. Faithful to the prototype.
    mirrorOn ? s.mirror : 999,
  );

  return { multiplier: Math.exp(logSum), rows };
}

/** Base rate mu, with the EWMA stand-in applied. */
export const codexMu = (s: CodexState, regime: Regime): number =>
  BASE[regime].codex * (MU_INTERCEPT + MU_PER_PRIOR_RESET * s.prior);

/** Hawkes excitation from the most recent reset. */
export const codexExcitation = (s: CodexState, t: number): number => ALPHA * Math.exp(-(s.since + t) / TAU);

/** Refractory suppression. Approaches 1 as the last reset recedes. */
export const codexRefractory = (s: CodexState, t: number): number => 1 - REFR_K * Math.exp(-(s.since + t) / REFR_T);

/** Instantaneous intensity, events per hour, at offset t hours from now. */
export function codexLambda(s: CodexState, regime: Regime, t: number): number {
  return (codexMu(s, regime) + codexExcitation(s, t)) * codexRefractory(s, t) * codexEvidence(s, t).multiplier;
}
