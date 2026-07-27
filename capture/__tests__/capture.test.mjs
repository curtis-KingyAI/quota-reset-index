/**
 * Tests for the capture path.
 *
 * Two of these are not ordinary unit tests and are the reason this file matters:
 *
 *  - "the published site does not depend on capture/" enforces the permission
 *    argument in `statusline.mjs` in code. That argument rests on nothing
 *    published depending on a subscription's quota state, and a comment cannot
 *    hold that line — an import added later would silently invalidate it.
 *  - "no candidate can be mistaken for a ledger record" pins the boundary that
 *    `docs/PHASE-2-CLOSED.md` §4 requires: telemetry never becomes a record on its
 *    own authority.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  MATERIAL_PCT_DELTA,
  MAX_LINE_BYTES,
  MIN_INTERVAL_SECONDS,
  isMaterialChange,
  readObservations,
  record,
  toObservation,
} from '../observations.mjs';
import { BOUNDARY_TOLERANCE_SECONDS, DROP_THRESHOLD_PCT, candidateRecord, classifyPair, detect } from '../detect.mjs';
import { renderStatus, until } from '../statusline.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The documented payload, trimmed to the fields this code reads. */
const PAYLOAD = {
  session_id: 'abc123',
  version: '2.1.90',
  model: { display_name: 'Opus' },
  context_window: { used_percentage: 8 },
  rate_limits: {
    five_hour: { used_percentage: 23.5, resets_at: 1738425600 },
    seven_day: { used_percentage: 41.2, resets_at: 1738857600 },
  },
};

const withTempLog = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'qri-obs-'));
  const file = join(dir, 'observations.jsonl');
  const saved = process.env.QRI_OBS_LOG;
  process.env.QRI_OBS_LOG = file;
  try {
    return fn(file);
  } finally {
    if (saved === undefined) delete process.env.QRI_OBS_LOG;
    else process.env.QRI_OBS_LOG = saved;
    rmSync(dir, { recursive: true, force: true });
  }
};

const obs = (iso, fivePct, fiveReset, sevenPct = 40, sevenReset = 1738857600) => ({
  observed_at: iso,
  session: 's1',
  version: '2.1.90',
  five_hour: { used_pct: fivePct, resets_at: fiveReset },
  seven_day: { used_pct: sevenPct, resets_at: sevenReset },
});

// ------------------------------------------------------------ parsing the contract
test('the documented payload maps to an observation', () => {
  const o = toObservation(PAYLOAD, '2026-07-27T01:00:00Z');
  assert.deepEqual(o, {
    observed_at: '2026-07-27T01:00:00Z',
    session: 'abc123',
    version: '2.1.90',
    five_hour: { used_pct: 23.5, resets_at: 1738425600 },
    seven_day: { used_pct: 41.2, resets_at: 1738857600 },
  });
});

test('absent rate_limits yields NO observation rather than a zeroed one', () => {
  // The contract: rate_limits "appears only for Claude.ai subscribers (Pro/Max)
  // after the first API response". Recording 0% there would assert a fresh quota
  // nobody observed — the same class of defect as the ledger's over-claimed fields.
  assert.equal(toObservation({ session_id: 'x' }, '2026-07-27T01:00:00Z'), null);
  assert.equal(toObservation({ rate_limits: {} }, '2026-07-27T01:00:00Z'), null);
  assert.equal(toObservation(null, '2026-07-27T01:00:00Z'), null);
});

test('each window may be independently absent', () => {
  const o = toObservation(
    { rate_limits: { five_hour: { used_percentage: 10, resets_at: 5 } } },
    '2026-07-27T01:00:00Z',
  );
  assert.ok(o.five_hour);
  assert.equal(o.seven_day, undefined);
  assert.equal('seven_day' in o, false, 'an absent window must not appear as a key at all');
});

test('a window present but with null values is dropped, not recorded as 0', () => {
  const o = toObservation({ rate_limits: { five_hour: {}, seven_day: { used_percentage: 5, resets_at: 9 } } }, 'x');
  assert.equal(o.five_hour, undefined);
  assert.ok(o.seven_day);
});

// ------------------------------------------------------------ write volume
test('only material changes are logged', () => {
  const base = obs('2026-07-27T01:00:00Z', 20, 1000);
  // Nothing moved, seconds apart: no write.
  assert.equal(isMaterialChange(base, obs('2026-07-27T01:00:10Z', 20, 1000)), false);
  // Below the noise floor: no write.
  assert.equal(isMaterialChange(base, obs('2026-07-27T01:00:10Z', 20 + MATERIAL_PCT_DELTA / 2, 1000)), false);
  // At the floor: write.
  assert.equal(isMaterialChange(base, obs('2026-07-27T01:00:10Z', 20 + MATERIAL_PCT_DELTA, 1000)), true);
  // A moved boundary is ALWAYS material — it is the detector's discriminator.
  assert.equal(isMaterialChange(base, obs('2026-07-27T01:00:10Z', 20, 1001)), true);
  // Heartbeat, so a quiet session still leaves a trail.
  const later = new Date(Date.parse(base.observed_at) + MIN_INTERVAL_SECONDS * 1000).toISOString();
  assert.equal(isMaterialChange(base, obs(later, 20, 1000)), true);
  // No previous observation at all: always write.
  assert.equal(isMaterialChange(null, base), true);
});

test('a drop is always material, so a reset can never be filtered out as noise', () => {
  // The failure that would make the whole capture path useless: the change filter
  // swallowing the one event it exists to catch.
  const before = obs('2026-07-27T01:00:00Z', 80, 1000);
  const after = obs('2026-07-27T01:00:05Z', 2, 1000);
  assert.equal(isMaterialChange(before, after), true);
});

// ------------------------------------------------------------ the log file
test('records append as one line each and round-trip', () => {
  withTempLog((file) => {
    assert.equal(record(toObservation(PAYLOAD, '2026-07-27T01:00:00Z')), true);
    const moved = { ...PAYLOAD, rate_limits: { ...PAYLOAD.rate_limits, five_hour: { used_percentage: 60, resets_at: 1738425600 } } };
    assert.equal(record(toObservation(moved, '2026-07-27T02:00:00Z')), true);

    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    assert.equal(lines.length, 2);
    for (const l of lines) assert.ok(Buffer.byteLength(l) < MAX_LINE_BYTES, `line must stay under PIPE_BUF: ${l.length}`);

    const back = readObservations({ file });
    assert.equal(back.length, 2);
    assert.equal(back[0].five_hour.used_pct, 23.5);
    assert.equal(back[1].five_hour.used_pct, 60);
  });
});

test('a torn final line is skipped, not thrown on', () => {
  // A cancelled writer is expected: Claude Code kills an in-flight status line
  // when a new update triggers.
  withTempLog((file) => {
    writeFileSync(file, '{"observed_at":"2026-07-27T01:00:00Z","five_hour":{"used_pct":1,"resets_at":2}}\n{"observed_at":"2026-0');
    const back = readObservations({ file });
    assert.equal(back.length, 1);
  });
});

test('observations are returned oldest-first even when appended out of order', () => {
  withTempLog((file) => {
    writeFileSync(
      file,
      [
        JSON.stringify(obs('2026-07-27T03:00:00Z', 30, 1000)),
        JSON.stringify(obs('2026-07-27T01:00:00Z', 10, 1000)),
      ].join('\n') + '\n',
    );
    const back = readObservations({ file });
    assert.deepEqual(back.map((o) => o.five_hour.used_pct), [10, 30]);
  });
});

// ------------------------------------------------------------ detection
const AT = (iso) => Math.floor(Date.parse(iso) / 1000);

test('a sharp drop BEFORE the window was due is a candidate', () => {
  const prev = obs('2026-07-27T01:00:00Z', 80, AT('2026-07-27T04:00:00Z'));
  const curr = obs('2026-07-27T01:05:00Z', 5, AT('2026-07-27T04:00:00Z'));
  const v = classifyPair('five_hour', prev, curr);
  assert.equal(v.ok, true);
  assert.equal(v.drop_pp, 75);
  assert.equal(v.observed_seconds_before_rollover, 3 * 3600 - 300);
});

test('the same drop AT OR AFTER the boundary is an ordinary rollover, not a candidate', () => {
  // This is the confounder the whole rule exists to defeat: a rolling window
  // empties by itself, and without this guard every rollover would be an "event".
  const due = AT('2026-07-27T04:00:00Z');
  const prev = obs('2026-07-27T03:50:00Z', 80, due);
  const curr = obs('2026-07-27T04:01:00Z', 3, due + 5 * 3600);
  const v = classifyPair('five_hour', prev, curr);
  assert.equal(v.ok, false);
  assert.match(v.reason, /ordinary rollover/);
});

test('a drop inside the boundary tolerance is treated as a rollover', () => {
  const due = AT('2026-07-27T04:00:00Z');
  const prev = obs('2026-07-27T03:00:00Z', 80, due);
  const curr = obs(new Date((due - BOUNDARY_TOLERANCE_SECONDS + 10) * 1000).toISOString(), 4, due);
  assert.equal(classifyPair('five_hour', prev, curr).ok, false);
});

test('a drop under the threshold is not a candidate', () => {
  const prev = obs('2026-07-27T01:00:00Z', 40, AT('2026-07-27T04:00:00Z'));
  const curr = obs('2026-07-27T01:05:00Z', 40 - (DROP_THRESHOLD_PCT - 1), AT('2026-07-27T04:00:00Z'));
  const v = classifyPair('five_hour', prev, curr);
  assert.equal(v.ok, false);
  assert.match(v.reason, /under the/);
});

test('with no boundary to compare against, nothing is filed', () => {
  // A candidate we cannot justify must not reach a human. Refusing to guess is
  // the same discipline the ledger applies to an unsourced field.
  const prev = { observed_at: '2026-07-27T01:00:00Z', five_hour: { used_pct: 90, resets_at: null } };
  const curr = { observed_at: '2026-07-27T01:05:00Z', five_hour: { used_pct: 2, resets_at: null } };
  const v = classifyPair('five_hour', prev, curr);
  assert.equal(v.ok, false);
  assert.match(v.reason, /cannot rule out a rollover/);
});

test('a long observation gap spanning a rollover produces no candidate', () => {
  // The realistic quiet-overnight case. prev.resets_at is in the past by the time
  // the next observation lands, so the boundary guard catches it with no special
  // handling for gaps.
  const prev = obs('2026-07-27T01:00:00Z', 85, AT('2026-07-27T02:00:00Z'));
  const curr = obs('2026-07-27T09:00:00Z', 0, AT('2026-07-27T14:00:00Z'));
  assert.equal(classifyPair('five_hour', prev, curr).ok, false);
});

test('detect scans both windows and orders candidates by time', () => {
  const seq = [
    obs('2026-07-27T01:00:00Z', 80, AT('2026-07-27T04:00:00Z'), 70, AT('2026-08-01T00:00:00Z')),
    obs('2026-07-27T01:30:00Z', 6, AT('2026-07-27T04:00:00Z'), 8, AT('2026-08-01T00:00:00Z')),
  ];
  const { candidates } = detect(seq);
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates.map((c) => c.window).sort(), ['five_hour', 'seven_day']);
});

test('a clean log produces no candidates at all', () => {
  const seq = [
    obs('2026-07-27T01:00:00Z', 10, AT('2026-07-27T04:00:00Z')),
    obs('2026-07-27T02:00:00Z', 25, AT('2026-07-27T04:00:00Z')),
    obs('2026-07-27T03:00:00Z', 44, AT('2026-07-27T04:00:00Z')),
  ];
  assert.deepEqual(detect(seq).candidates, []);
});

// ------------------------------------------------------------ the boundary that matters
test('no candidate can be mistaken for a ledger record', () => {
  const prev = obs('2026-07-27T01:00:00Z', 90, AT('2026-07-27T04:00:00Z'));
  const curr = obs('2026-07-27T01:05:00Z', 4, AT('2026-07-27T04:00:00Z'));
  const rec = candidateRecord(classifyPair('five_hour', prev, curr));

  // The ledger's id shape. A candidate carrying one could be dropped into
  // ledger/ and validated by accident.
  assert.ok(!/^(cx|cc)-\d{4}-\d{2}-\d{2}-\d{2}$/.test(rec.candidate_id ?? ''));
  assert.equal(rec.id, undefined, 'must not carry an `id` field at all');
  assert.equal(rec.confidence, undefined, 'must not carry a confidence grade');
  assert.equal(rec.evidence, undefined, 'must not present itself as evidence');
  assert.equal(rec.vendor, null, 'one seat cannot establish which vendor granted anything');

  // And it must say so in words, for whoever opens the file.
  assert.match(rec._not_a_ledger_record, /not that/i);
  assert.match(rec._not_a_ledger_record, /PHASE-2-CLOSED/);
  assert.ok(rec.promotion_checklist.length >= 3);
  assert.ok(
    rec.promotion_checklist.some((s) => /must not appear in evidence/.test(s)),
    'the checklist must forbid citing this file as evidence',
  );
});

test('the published site does not depend on capture/', () => {
  // THE PERMISSION ARGUMENT, ENFORCED. statusline.mjs is defensible because
  // nothing served to anyone depends on a subscription's quota state. A comment
  // cannot hold that line; an import added later would silently invalidate it.
  //
  // Matches IMPORT SYNTAX, not any mention of the string. An earlier version
  // grepped for "capture/" and failed on a prose cross-reference in a comment —
  // a test that fires on documentation trains you to weaken it, which is how a
  // real violation eventually gets waved through.
  const hits = spawnSync(
    'grep',
    [
      '-rnE',
      '--include=*.ts',
      '--include=*.mjs',
      String.raw`(from|import|require)\s*\(?\s*['"][^'"]*\.\./capture/|(from|import)\s+['"][^'"]*capture/`,
      'site',
      'models',
      'scripts',
      'lib',
      'status',
      'usage',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(hits.stdout.trim(), '', `nothing outside capture/ may import it:\n${hits.stdout}`);
});

test('the isolation grep would actually catch a violation', () => {
  // Guards against the vacuous-test failure this repo already hit once in CI: a
  // check whose pattern silently matches nothing proves nothing. Asserted against
  // the real regex, on strings shaped like the imports it must catch.
  const pattern = new RegExp(
    String.raw`(from|import|require)\s*\(?\s*['"][^'"]*\.\./capture/|(from|import)\s+['"][^'"]*capture/`,
  );
  for (const violation of [
    `import { record } from '../capture/observations.mjs';`,
    `const x = require('../capture/detect.mjs');`,
    `import { renderStatus } from '../../capture/statusline.mjs';`,
  ]) {
    assert.ok(pattern.test(violation), `must catch: ${violation}`);
  }
  for (const innocent of [
    ` * Extracted from capture/observations.mjs once a second caller needed it.`,
    ` * See capture/README.md for the permission argument.`,
  ]) {
    assert.ok(!pattern.test(innocent), `must not fire on prose: ${innocent}`);
  }
});

test('capture/ never writes to ledger/', () => {
  const hits = spawnSync('grep', ['-rn', "ledger", 'capture'], { cwd: ROOT, encoding: 'utf8' });
  // Mentions in prose are fine; a path join that would WRITE there is not.
  for (const line of hits.stdout.split('\n').filter(Boolean)) {
    assert.ok(
      !/(writeFileSync|appendFileSync|mkdirSync)\s*\([^)]*ledger/.test(line),
      `capture/ must not write into ledger/: ${line}`,
    );
  }
});

// ------------------------------------------------------------ the status bar itself
test('the rendered line survives every documented absence', () => {
  const now = Date.parse('2026-07-27T01:00:00Z');
  assert.match(renderStatus(PAYLOAD, now), /^Opus · 5h 24% \(.+\) · wk 41% \(.+\) · ctx 8%$/);
  // Early session: no rate_limits yet.
  assert.equal(renderStatus({ model: { display_name: 'Opus' } }, now), 'Opus · quota —');
  // Nothing at all, including unparseable input.
  assert.equal(renderStatus(null, now), 'quota reset index');
  assert.equal(renderStatus({}, now), 'quota —');
  // A window present but without a percentage renders "—", never "0%".
  assert.match(renderStatus({ rate_limits: { five_hour: { resets_at: 0 } } }, now), /5h —/);
});

test('time-to-reset formatting', () => {
  const now = Date.parse('2026-07-27T01:00:00Z');
  assert.equal(until(Math.floor(now / 1000) + 2 * 3600 + 14 * 60, now), '2h14m');
  assert.equal(until(Math.floor(now / 1000) + 48 * 60, now), '48m');
  assert.equal(until(Math.floor(now / 1000) - 10, now), 'now');
  assert.equal(until(undefined, now), null);
  // The seven-day window is normally days out; "168h00m" is not skimmable.
  assert.equal(until(Math.floor(now / 1000) + 6 * 86400 + 4 * 3600, now), '6d4h');
  assert.equal(until(Math.floor(now / 1000) + 47 * 3600, now), '47h00m', 'still hours just under the cutover');
});

test('the script prints a line and exits 0 for every input shape', () => {
  // It IS the operator's status bar. A crash shows an error where the bar should
  // be, so this asserts the contract on the real process, not on the function.
  withTempLog(() => {
    for (const input of [JSON.stringify(PAYLOAD), '{}', 'not json at all', '']) {
      const r = spawnSync('node', [join(ROOT, 'capture', 'statusline.mjs')], {
        input,
        encoding: 'utf8',
        env: { ...process.env },
      });
      assert.equal(r.status, 0, `exit 0 required for input ${JSON.stringify(input.slice(0, 20))}`);
      assert.ok(r.stdout.trim().length > 0, 'must always print something');
    }
  });
});

test('end to end: statusline writes a log the detector reads', () => {
  withTempLog((file) => {
    const run = (payload) =>
      execFileSync('node', [join(ROOT, 'capture', 'statusline.mjs')], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: { ...process.env, QRI_OBS_LOG: file },
      });

    const due = Math.floor(Date.now() / 1000) + 3 * 3600;
    run({ session_id: 'e2e', rate_limits: { five_hour: { used_percentage: 88, resets_at: due } } });
    run({ session_id: 'e2e', rate_limits: { five_hour: { used_percentage: 3, resets_at: due } } });

    assert.ok(existsSync(file));
    const { candidates } = detect(readObservations({ file }));
    assert.equal(candidates.length, 1, 'the drop before the boundary should surface');
    assert.equal(candidates[0].window, 'five_hour');
  });
});
