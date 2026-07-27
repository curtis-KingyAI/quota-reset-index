/**
 * Forecast inputs derived from the ledger, rather than hardcoded.
 *
 * THE DEFECT THIS FIXES. The published forecast used a frozen July baseline —
 * `since: 38, prior: 6` — while the ledger recorded the actual date of every
 * reset. That meant publishing a number the project's own data contradicted, and
 * the gap widened every day. The one asset nobody else has was sitting unused by
 * the figure on the front page.
 *
 * TWO CONSTRAINTS PULL AGAINST EACH OTHER, AND BOTH ARE MET:
 *
 *   1. §4.4 requires a deterministic build. Nothing here reads the wall clock:
 *      the static render is computed at AS_OF, derived from the ledger's own
 *      observed_at, so two builds of one ledger are byte-identical.
 *   2. The number should still move as real time passes. The page ships the
 *      reset timestamps and recomputes in the browser — arithmetic over embedded
 *      data, not a network call, so §8 still holds.
 *
 * ⚠️ ONLY RESET-BEARING RECORDS COUNT. The model's inputs are "hours since the
 * last RESET" and "resets in the trailing fortnight". A `limit_increase` or
 * `limit_removal` is a forward-looking change to the allowance rule, not a refill
 * of a spent window, and counting one as a reset would both mis-date "the last
 * reset" and inflate the burst term. Today this is latent for Codex (all 19
 * current records are reset-bearing) but it is already live for Claude Code,
 * where 5 of 9 are `limit_increase` — so the filter is written now rather than
 * after it silently produces a wrong number.
 *
 * A record counts if ANY of its effects qualify: cx-2026-07-12-02 is
 * [global_reset, limit_removal] and is genuinely a reset.
 *
 * WHAT IS NOT LEDGER-DRIVEN. Only Codex. Claude Code's model needs hours since a
 * scheduled *recycle* and current utilisation; the ledger holds neither, and the
 * sentinel that would have measured utilisation was closed. Pretending otherwise
 * would be inventing liveness.
 */

import { collectEntries } from '../scripts/validate.mjs';

/** Effects that constitute a refill of a spent window. */
export const RESET_EFFECTS = new Set(['global_reset', 'banked_reset']);

export const isReset = (rec: { effects?: string[]; kind: string }): boolean =>
  (rec.effects ?? [rec.kind]).some((e) => RESET_EFFECTS.has(e));

export interface CodexLiveState {
  lastResetIso: string;
  /** Deterministic reference point for the static render. */
  asOfIso: string;
  since: number;
  prior: number;
  /**
   * Every reset at or after (AS_OF − 14d), newest first.
   *
   * Shipped so the browser can recompute `prior` as well as `since`. Without it
   * `prior` stays frozen at build time while `since` advances — and because
   * `prior` only ever FALLS as events age out of the fortnight, a frozen value
   * makes the published probability drift UPWARD relative to truth. That is the
   * wrong direction to be wrong in, so it is fixed rather than disclosed.
   */
  recentResetIsos: string[];
}

const HOURS = 3600_000;
const FORTNIGHT_H = 14 * 24;

export function codexLiveState(): CodexLiveState {
  const records = collectEntries()
    .map((e: { raw: string }) => JSON.parse(e.raw))
    .filter((r: any) => r.superseded_by === null);

  const resets = records
    .filter((r: any) => r.vendor === 'codex' && isReset(r))
    .sort((a: any, b: any) => (a.effective_at < b.effective_at ? 1 : -1));

  if (resets.length === 0) throw new Error('no current reset-bearing codex records — cannot derive forecast state');

  const asOfIso = records
    .map((r: any) => r.observed_at)
    .sort()
    .pop() as string;
  const asOf = new Date(asOfIso).getTime();

  const lastResetIso = resets[0].effective_at as string;
  const since = Math.max(0, (asOf - new Date(lastResetIso).getTime()) / HOURS);

  const cutoff = asOf - FORTNIGHT_H * HOURS;
  const recentResetIsos = resets
    .map((r: any) => r.effective_at as string)
    .filter((iso: string) => new Date(iso).getTime() >= cutoff);

  return { lastResetIso, asOfIso, since, prior: recentResetIsos.length, recentResetIsos };
}

/** Plain-language elapsed time, for the line under the headline number. */
export function elapsedLabel(hours: number): string {
  if (hours < 1) return 'less than an hour ago';
  if (hours < 48) return `${Math.round(hours)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Coverage span of the current ledger, for the snapshot label. */
export function coverageSpan(): { earliest: string; latest: string; label: string } {
  const dates = collectEntries()
    .map((e: { raw: string }) => JSON.parse(e.raw))
    .filter((r: any) => r.superseded_by === null)
    .map((r: any) => r.effective_at.slice(0, 10) as string)
    .sort();
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  const month = (d: string) =>
    ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][
      Number(d.slice(5, 7)) - 1
    ];
  const year = earliest.slice(0, 4);
  const label =
    month(earliest) === month(latest)
      ? `${month(earliest)} ${year}`
      : `${month(earliest)}–${month(latest)} ${year}`;
  return { earliest, latest, label };
}
