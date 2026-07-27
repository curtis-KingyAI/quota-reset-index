/**
 * The sweep log — "we looked, and here is what we found and failed to find."
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT A LEDGER RECORD ──────────────────────
 *
 * The operator chose to OPERATE this ledger rather than declare it a snapshot
 * (2026-07-27). That decision creates the exact risk `docs/STATUS.md` warns about:
 * a ledger that silently stops being maintained while still presenting as live is
 * strictly worse than one honestly labelled as a snapshot.
 *
 * The schema could not express the difference. A record says "an event happened".
 * Nothing said "we checked and nothing admissible turned up", so
 * **"nobody looked" and "nothing occurred" were indistinguishable** — which makes
 * the claim to be operated unverifiable, and makes decay invisible.
 *
 * A sweep is therefore NOT an event and must never become one. It carries no
 * vendor, no scope and no confidence grade. It is provenance for the PROCESS,
 * where the ledger is provenance for the CLAIMS.
 *
 * ── AND IT SAVES THE NEXT PERSON THE SAME DEAD ENDS ─────────────────────────
 *
 * The first sweep under this discipline produced ZERO new records and FIVE
 * documented failures: an X post behind HTTP 402, a press article behind 403, two
 * sources that do not cover the date, and a vendor status page with no incident in
 * the window a mirror claimed. Without somewhere to put that, the next sweep pays
 * for all five again — and worse, might reach a different conclusion from the same
 * unusable evidence. RUNBOOK §1 already says to record the attempt; this is where.
 *
 * Unlike `capture/` and `social/`, this log is COMMITTED. It is not personal
 * telemetry, it is the audit trail for "is anyone still doing this", and a project
 * whose argument is "check our work" should publish it.
 */

import { appendLine, readLines } from './jsonl.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const SWEEP_LOG = join(ROOT, 'operations', 'sweeps.jsonl');

/** How a source behaved. Distinguishing these is the whole value of the log. */
export const OUTCOMES = Object.freeze({
  /** Read successfully and it addresses the period. */
  read: 'read',
  /** Read successfully but says nothing about the period — a real answer. */
  'no-coverage': 'no-coverage',
  /** Could not be read at all: 402, 403, login wall, timeout. NOT the same as "nothing there". */
  blocked: 'blocked',
  /** Read, but inadmissible under §2 — a mirror carrying substance. */
  inadmissible: 'inadmissible',
});

/**
 * Longest gap ever observed between consecutive resets, in days, per vendor.
 *
 * MEASURED from the current records, not chosen: codex 19 resets → max gap 20d
 * (median 2.9); claude-code 4 resets → max gap 37d (median 22). These are what
 * make the staleness thresholds defensible rather than invented — a threshold
 * below the observed maximum would fire on a quiet period the vendors have
 * actually produced before.
 *
 * ⚠️ Re-derive these if the corpus grows materially. They are a summary of 23
 * reset-bearing records, and the claude-code figure rests on three gaps.
 */
export const OBSERVED_MAX_GAP_DAYS = Object.freeze({ codex: 20, 'claude-code': 37 });

/**
 * Days of silence after which the site should say so.
 *
 * 21 = just past the longest quiet period Codex has ever produced (20 days), so
 * this cannot fire on any inter-event gap in the record. Past it, either the
 * vendors changed behaviour or nobody is looking — and the reader is entitled to
 * know which is possible.
 */
export const STALE_DAYS = 21;

/**
 * Days after which the honest reading is "this may no longer be maintained".
 *
 * 45 exceeds both observed maxima, including claude-code's 37, with margin.
 */
export const ABANDONED_DAYS = 45;

/** Validate a sweep before it is written. A malformed audit trail is not one. */
export function validateSweep(s) {
  const errors = [];
  if (!s || typeof s !== 'object') return ['sweep is not an object'];
  if (typeof s.swept_at !== 'string' || Number.isNaN(Date.parse(s.swept_at))) {
    errors.push('swept_at must be an RFC 3339 instant');
  } else if (!/Z$/.test(s.swept_at)) {
    // UTC, like every other date here. RUNBOOK §5 exists because this slipped once
    // in the ledger and once, on 2026-07-27, in a correction to a comparison page.
    errors.push('swept_at must be UTC, Z-suffixed');
  }
  if (typeof s.by !== 'string' || !s.by) errors.push('by is required');
  if (!Array.isArray(s.vendors) || !s.vendors.length) errors.push('vendors must be a non-empty array');
  if (!Array.isArray(s.sources) || !s.sources.length) errors.push('sources must be a non-empty array');
  for (const [i, src] of (s.sources ?? []).entries()) {
    if (!src?.url) errors.push(`sources[${i}].url is required`);
    if (!OUTCOMES[src?.outcome]) {
      errors.push(`sources[${i}].outcome must be one of ${Object.keys(OUTCOMES).join(', ')}`);
    }
  }
  if (!Number.isInteger(s.records_added) || s.records_added < 0) errors.push('records_added must be a non-negative integer');
  if (!Number.isInteger(s.candidates) || s.candidates < 0) errors.push('candidates must be a non-negative integer');
  return errors;
}

export function appendSweep(sweep, { file = SWEEP_LOG } = {}) {
  const errors = validateSweep(sweep);
  if (errors.length) throw new Error(`invalid sweep:\n  - ${errors.join('\n  - ')}`);
  // A sweep carries prose, so it can exceed the 512-byte atomicity cap that the
  // status line needs. Nothing else writes this file concurrently — it is appended
  // by a human running a command, not by an event-driven process — so a larger
  // limit is safe here and the cap stays where it matters.
  if (!appendLine(file, sweep, { maxBytes: 8192 })) throw new Error('failed to append sweep (too large, or unwritable)');
  return true;
}

export function readSweeps({ file = SWEEP_LOG } = {}) {
  if (!existsSync(file)) return [];
  return readLines(file, { sortKey: 'swept_at' });
}

/** The most recent sweep instant, or null. */
export function lastSweptAt({ file = SWEEP_LOG } = {}) {
  const all = readSweeps({ file });
  return all.length ? all[all.length - 1].swept_at : null;
}

/**
 * When this ledger last received human attention.
 *
 * The LATER of "we learned something" (a record's observed_at) and "we looked"
 * (a sweep). Either is attention; only the pair of them distinguishes a quiet
 * period from an abandoned one.
 */
export function lastReviewedAt(ledgerAsOfIso, { file = SWEEP_LOG } = {}) {
  const swept = lastSweptAt({ file });
  if (!swept) return ledgerAsOfIso;
  if (!ledgerAsOfIso) return swept;
  return Date.parse(swept) > Date.parse(ledgerAsOfIso) ? swept : ledgerAsOfIso;
}
