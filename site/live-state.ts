/**
 * Forecast inputs derived from the ledger, rather than hardcoded.
 *
 * THE DEFECT THIS FIXES. The published forecast used a frozen July baseline —
 * `since: 38, prior: 6` — while the ledger recorded the actual dates of every
 * reset. On 2026-07-27 that meant publishing 55% when the project's own data
 * implied 46%, and the gap widened every day that passed. The one asset nobody
 * else has was sitting unused by the number on the front page.
 *
 * TWO CONSTRAINTS PULL AGAINST EACH OTHER, AND BOTH ARE MET:
 *
 *   1. §4.4 requires a deterministic build — same inputs, byte-identical output.
 *      So nothing here reads the wall clock. The static render is computed at
 *      AS_OF, which is derived from the ledger itself and therefore changes only
 *      when the ledger changes.
 *   2. The number should still move as real time passes. So the page ships the
 *      last-reset timestamp and recomputes in the browser on load. That is
 *      arithmetic on embedded data, not a network call, so it stays inside §8's
 *      prohibition on client-side calls to vendor endpoints.
 *
 * WHAT IS NOT LEDGER-DRIVEN, AND WHY. Only Codex. Its model inputs are "hours
 * since the last reset" and "resets in the trailing fortnight" — both of which
 * ARE the ledger. Claude Code's inputs are hours since a scheduled *recycle* and
 * current utilisation; the ledger records neither, and the sentinel that would
 * have measured utilisation was closed. Pretending otherwise would be inventing
 * liveness. Its figures stay a stated baseline and the page says so.
 */

import { collectEntries } from '../scripts/validate.mjs';

export interface CodexLiveState {
  /** ISO timestamp of the most recent Codex reset in the ledger. */
  lastResetIso: string;
  /** Deterministic reference point for the static render. */
  asOfIso: string;
  /** Hours since the last reset, at AS_OF. */
  since: number;
  /** Resets in the 14 days before AS_OF. */
  prior: number;
  /** Total current Codex records, for the supporting line. */
  totalRecords: number;
}

const HOURS = 3600_000;
const FORTNIGHT_H = 14 * 24;

/**
 * Derive Codex forecast inputs from the ledger.
 *
 * AS_OF is the latest `observed_at` across current records — a property of the
 * data, not of the clock, so two builds of the same ledger agree byte for byte.
 */
export function codexLiveState(): CodexLiveState {
  const records = collectEntries()
    .map((e: { raw: string }) => JSON.parse(e.raw))
    .filter((r: any) => r.superseded_by === null);

  const codex = records
    .filter((r: any) => r.vendor === 'codex')
    .sort((a: any, b: any) => (a.effective_at < b.effective_at ? 1 : -1));

  if (codex.length === 0) throw new Error('no current codex records — cannot derive forecast state');

  const asOfIso = records
    .map((r: any) => r.observed_at)
    .sort()
    .pop() as string;

  const asOf = new Date(asOfIso).getTime();
  const lastResetIso = codex[0].effective_at as string;
  const since = (asOf - new Date(lastResetIso).getTime()) / HOURS;
  const prior = codex.filter((r: any) => (asOf - new Date(r.effective_at).getTime()) / HOURS <= FORTNIGHT_H).length;

  return { lastResetIso, asOfIso, since: Math.max(0, since), prior, totalRecords: codex.length };
}

/** Plain-language elapsed time, for the line under the headline number. */
export function elapsedLabel(hours: number): string {
  if (hours < 1) return 'less than an hour ago';
  if (hours < 48) return `${Math.round(hours)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}
