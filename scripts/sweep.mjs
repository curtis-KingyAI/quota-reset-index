#!/usr/bin/env node
/**
 * npm run sweep — record that someone looked, and what happened.
 *
 * The operating loop for this ledger, in one command. `docs/OPERATING.md` says when
 * to run it and what to check; `docs/RUNBOOK.md` says how to write a record if the
 * sweep finds one.
 *
 * ⚠️ RECORDING A SWEEP IS NOT RECORDING AN EVENT. A sweep carries no vendor, no
 * scope and no confidence grade, and nothing here can write to `ledger/`. It is
 * provenance for the PROCESS; the ledger is provenance for the CLAIMS.
 *
 *   npm run sweep -- --show                  what has been swept, and how stale we are
 *   npm run sweep -- --check                 exit non-zero if the ledger is overdue
 *   npm run sweep -- --record <file.json>    append a sweep from a JSON file
 *
 * `--record` takes a file rather than a pile of flags because a sweep's value is in
 * its per-source notes — "403, try a browser", "read, says nothing about the date" —
 * and prose does not survive being typed as shell arguments.
 */

import { readFileSync } from 'node:fs';
import { ABANDONED_DAYS, OUTCOMES, STALE_DAYS, appendSweep, lastReviewedAt, readSweeps, validateSweep } from '../lib/sweeps.mjs';
import { codexLiveState } from '../site/live-state.ts';
import { isMain } from '../lib/is-main.mjs';

const DAY = 86_400_000;

/**
 * Age of the last review in days, against the wall clock.
 *
 * Reading the clock is correct HERE and forbidden in the site build: this is an
 * operator tool answering "are we overdue right now", not a build step that has to
 * produce byte-identical output. The site asks the same question in the reader's
 * browser instead, for exactly that reason.
 */
function reviewAgeDays() {
  const reviewed = lastReviewedAt(codexLiveState().asOfIso);
  return { reviewed, days: (Date.now() - Date.parse(reviewed)) / DAY };
}

function show() {
  const sweeps = readSweeps();
  const { reviewed, days } = reviewAgeDays();

  console.log(`${sweeps.length} sweep${sweeps.length === 1 ? '' : 's'} recorded`);
  for (const s of sweeps) {
    const blocked = s.sources.filter((x) => x.outcome === 'blocked').length;
    console.log(
      `  ${s.swept_at}  by ${s.by}  ${s.sources.length} source${s.sources.length === 1 ? '' : 's'}` +
        `  +${s.records_added} record${s.records_added === 1 ? '' : 's'}` +
        `  ${s.candidates} candidate${s.candidates === 1 ? '' : 's'}` +
        (blocked ? `  (${blocked} unreadable)` : ''),
    );
  }

  console.log(`\nlast reviewed: ${reviewed} — ${days.toFixed(1)} days ago`);
  if (days >= ABANDONED_DAYS) console.log(`  ⛔ past ${ABANDONED_DAYS}d: the site now tells readers this may be unmaintained.`);
  else if (days >= STALE_DAYS) console.log(`  ⚠️  past ${STALE_DAYS}d: the site is showing a staleness warning to readers.`);
  else console.log(`  ✅ inside the ${STALE_DAYS}d window.`);
}

/** Exit non-zero when overdue, so this can back a reminder without a scheduler. */
function check() {
  const { reviewed, days } = reviewAgeDays();
  if (days >= STALE_DAYS) {
    console.error(`OVERDUE — last reviewed ${reviewed}, ${days.toFixed(1)} days ago (threshold ${STALE_DAYS}d).`);
    console.error('Run a sweep per docs/OPERATING.md, then `npm run sweep -- --record <file>`.');
    process.exit(1);
  }
  console.log(`OK — last reviewed ${reviewed}, ${days.toFixed(1)} days ago.`);
}

function record(path) {
  let sweep;
  try {
    sweep = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`cannot read ${path}: ${e.message}`);
    process.exit(1);
  }
  const errors = validateSweep(sweep);
  if (errors.length) {
    console.error(`REFUSING — ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error(`\nvalid source outcomes: ${Object.keys(OUTCOMES).join(', ')}`);
    process.exit(1);
  }
  appendSweep(sweep);
  console.log(`recorded sweep ${sweep.swept_at} (${sweep.sources.length} sources, +${sweep.records_added} records)`);
  if (sweep.records_added > 0) console.log('Remember to run `npm run build` so the site reflects the new records.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) return check();
  const i = args.indexOf('--record');
  if (i !== -1) {
    if (!args[i + 1]) {
      console.error('--record needs a path to a JSON file. See docs/OPERATING.md for the shape.');
      process.exit(1);
    }
    return record(args[i + 1]);
  }
  show();
}

if (isMain(import.meta.url)) main();
