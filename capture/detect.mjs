#!/usr/bin/env node
/**
 * Candidate detector — turns observations into questions for a human, never into
 * ledger records.
 *
 * ⚠️ THE ONE RULE THIS FILE EXISTS TO ENFORCE ⚠️
 *
 * `docs/PHASE-2-CLOSED.md` §4 stands and is not weakened by having better data:
 *
 *   > No channel — supported or not — distinguishes a vendor-wide grant from a
 *   > scheduled rollover. Telemetry can establish "my quota changed", never "the
 *   > vendor granted a reset". The ledger records the latter.
 *
 * And `confidence: "telemetry"` was struck from the confirming set on 2026-07-26
 * for exactly that reason. So an observation can never become a record on its own
 * authority, however sharp the drop. What it CAN do is tell you which day to go
 * looking for a vendor post — which is worth a great deal, because the alternative
 * is finding out two weeks later from a tracker whose own timestamps are wrong.
 *
 * Hence: candidates land in `capture/candidates/`, carry no ledger-shaped id, and
 * carry the promotion checklist. Promotion is a human writing a record by hand
 * against `docs/RUNBOOK.md`, with an external source. There is no automatic path,
 * and adding one would be a defect, not a feature.
 *
 * ── THE DISCRIMINATOR ───────────────────────────────────────────────────────
 *
 * A rolling window empties by itself. That is the confounder, and `resets_at` is
 * what defeats it: the contract defines it as the epoch second at which the
 * current window rolls. So
 *
 *   an ordinary rollover  →  usage drops AT OR AFTER prev.resets_at
 *   something granted     →  usage drops BEFORE it, while the window still stood
 *
 * A drop before the boundary is the only shape worth a human's attention. This is
 * strictly sharper than the closed Phase 2 rule, which watched for a ≥15pp drop
 * "across samples in which the account issued no requests" — a condition that
 * needs request accounting the status line does not provide, and that a rollover
 * satisfies trivially.
 *
 * Usage:
 *   node capture/detect.mjs             report candidates, write none
 *   node capture/detect.mjs --write     also write capture/candidates/*.json
 */

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readObservations } from './observations.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CANDIDATE_DIR = join(ROOT, 'capture', 'candidates');

/** Percentage points. Inherited from the Phase 2 spec's ≥15pp rule. */
export const DROP_THRESHOLD_PCT = 15;

/**
 * Seconds of slack around a window boundary.
 *
 * A drop observed within this of `prev.resets_at` is treated as an ordinary
 * rollover, not a grant. The status line is event-driven, so the first observation
 * after a roll can arrive well after the roll itself, and neither the host clock
 * nor `resets_at` is exact to the second. Erring towards "rollover" costs a missed
 * candidate; erring the other way puts a false event in front of a human, and a
 * detector that cries wolf gets ignored — which is the worse failure.
 */
export const BOUNDARY_TOLERANCE_SECONDS = 120;

export const WINDOWS = ['five_hour', 'seven_day'];

const epoch = (iso) => Math.floor(Date.parse(iso) / 1000);

/**
 * Classify one consecutive pair for one window.
 *
 * Returns a candidate, or a rejection carrying its reason. Rejections are
 * returned rather than dropped so `--verbose` can show what was considered and
 * why it was not flagged: a detector nobody can audit is one nobody should trust.
 */
export function classifyPair(window, prev, curr) {
  const a = prev[window];
  const b = curr[window];
  if (!a || !b) return { ok: false, reason: 'window absent from one of the two observations' };
  if (a.used_pct === null || b.used_pct === null) return { ok: false, reason: 'used_percentage missing' };

  const drop = a.used_pct - b.used_pct;
  if (drop < DROP_THRESHOLD_PCT) {
    return { ok: false, reason: `drop ${drop.toFixed(1)}pp is under the ${DROP_THRESHOLD_PCT}pp threshold` };
  }

  // Without a boundary there is no way to tell a refill from a rollover, and a
  // candidate we cannot justify must not be filed.
  if (a.resets_at === null) {
    return { ok: false, reason: `drop of ${drop.toFixed(1)}pp, but prev.resets_at is absent — cannot rule out a rollover` };
  }

  const at = epoch(curr.observed_at);
  if (at >= a.resets_at - BOUNDARY_TOLERANCE_SECONDS) {
    const late = at - a.resets_at;
    return {
      ok: false,
      reason: `drop of ${drop.toFixed(1)}pp observed ${late}s after the window was due to roll — ordinary rollover`,
    };
  }

  const secondsEarly = a.resets_at - at;
  return {
    ok: true,
    window,
    drop_pp: Number(drop.toFixed(2)),
    observed_seconds_before_rollover: secondsEarly,
    boundary_moved: a.resets_at !== b.resets_at,
    from: { observed_at: prev.observed_at, used_pct: a.used_pct, resets_at: a.resets_at },
    to: { observed_at: curr.observed_at, used_pct: b.used_pct, resets_at: b.resets_at },
  };
}

/**
 * Scan the whole log for candidates.
 *
 * Observations from DIFFERENT sessions are compared against each other on
 * purpose: they are views of one account's state, so merging them by time gives
 * denser coverage than any single session. The cost is that a stale in-flight
 * observation can arrive out of order; sorting by `observed_at` in
 * `readObservations` is what contains that.
 */
export function detect(observations) {
  const candidates = [];
  const rejections = [];
  for (const window of WINDOWS) {
    const seq = observations.filter((o) => o[window]);
    for (let i = 1; i < seq.length; i++) {
      const verdict = classifyPair(window, seq[i - 1], seq[i]);
      if (verdict.ok) candidates.push(verdict);
      else rejections.push({ window, at: seq[i].observed_at, ...verdict });
    }
  }
  candidates.sort((a, b) => Date.parse(a.to.observed_at) - Date.parse(b.to.observed_at));
  return { candidates, rejections };
}

/**
 * The candidate file.
 *
 * Shaped so it can never be mistaken for a ledger record, nor dropped into
 * `ledger/` and validated by accident:
 *   - no `id` matching `^(cx|cc)-\d{4}-\d{2}-\d{2}-\d{2}$`
 *   - a first field that says what it is not
 *   - the vendor left UNSET, because the observation cannot establish one: it
 *     shows this seat's quota moved, not who moved it or how widely
 */
export function candidateRecord(c) {
  return {
    _not_a_ledger_record:
      'An observation of ONE Claude Code seat. It shows that this account\'s quota changed, not that ' +
      'Anthropic granted anything. Telemetry cannot earn any confidence grade on its own (see ' +
      'docs/PHASE-2-CLOSED.md §4). Promote by hand via docs/RUNBOOK.md, with an external source, or discard.',
    candidate_id: `cand-${c.to.observed_at.replace(/[:.]/g, '-')}-${c.window}`,
    detected_window: c.window,
    observed_change: {
      used_pct_before: c.from.used_pct,
      used_pct_after: c.to.used_pct,
      drop_pp: c.drop_pp,
      before_at: c.from.observed_at,
      after_at: c.to.observed_at,
    },
    why_not_a_rollover: {
      rule: 'the drop was observed before the window was due to roll over',
      window_was_due_at_epoch: c.from.resets_at,
      observed_seconds_before_rollover: c.observed_seconds_before_rollover,
      window_boundary_also_moved: c.boundary_moved,
    },
    promotion_checklist: [
      'Find a vendor post or status-page entry dated to this instant in UTC. Without one there is no record.',
      'Establish the UTC date independently — decode the post id if a source dates it in Pacific (RUNBOOK §5).',
      'Confirm the grant reached accounts beyond this one. A single seat cannot establish scope.plans or scope.partial; leave them unestablished if nothing addresses them.',
      'Grade confidence from the EXTERNAL source only. This file is not evidence and must not appear in evidence[].',
      'If nothing external corroborates it, discard the candidate and record the attempt.',
    ],
    vendor: null,
    detector_version: 1,
  };
}

function main() {
  const write = process.argv.includes('--write');
  const verbose = process.argv.includes('--verbose');
  const observations = readObservations();

  if (!observations.length) {
    console.log('No observations yet. Is the status line installed? See capture/README.md.');
    return;
  }

  const { candidates, rejections } = detect(observations);
  const span = `${observations[0].observed_at} → ${observations[observations.length - 1].observed_at}`;
  console.log(`${observations.length} observations, ${span}`);
  console.log(`${candidates.length} candidate${candidates.length === 1 ? '' : 's'}, ${rejections.length} pair${rejections.length === 1 ? '' : 's'} considered and rejected\n`);

  for (const c of candidates) {
    console.log(
      `  CANDIDATE  ${c.to.observed_at}  ${c.window}  ` +
        `${c.from.used_pct}% → ${c.to.used_pct}%  (−${c.drop_pp}pp, ` +
        `${c.observed_seconds_before_rollover}s before the window was due)`,
    );
  }
  if (verbose) {
    for (const r of rejections) console.log(`  rejected   ${r.at}  ${r.window}  ${r.reason}`);
  }

  if (write && candidates.length) {
    mkdirSync(CANDIDATE_DIR, { recursive: true });
    const existing = new Set(readdirSync(CANDIDATE_DIR));
    let written = 0;
    for (const c of candidates) {
      const rec = candidateRecord(c);
      const file = `${rec.candidate_id}.json`;
      // Never overwrite: a candidate a human has already annotated or dismissed
      // must not be silently regenerated underneath them.
      if (existing.has(file)) continue;
      writeFileSync(join(CANDIDATE_DIR, file), JSON.stringify(rec, null, 2) + '\n');
      written++;
    }
    console.log(`\nwrote ${written} new candidate file${written === 1 ? '' : 's'} to capture/candidates/`);
    console.log('These are NOT ledger records. Promote by hand via docs/RUNBOOK.md, or delete them.');
  } else if (candidates.length) {
    console.log('\nRe-run with --write to file these for review. Nothing was written.');
  }
}

if (isMain(import.meta.url)) main();
