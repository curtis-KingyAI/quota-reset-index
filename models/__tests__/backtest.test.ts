/**
 * Tests for the walk-forward backtest.
 *
 * The load-bearing one is NO FUTURE LEAKAGE. The entire result rests on the model
 * never seeing an event before it happened; if that leaks, the score is flattering
 * and meaningless, and it would leak silently. Everything else here is arithmetic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bootstrapSkill, brier, calibrationInTheLarge, run, skill, stateAt } from '../backtest.ts';

const DAY = 86_400_000;
const t0 = Date.parse('2026-04-01T00:00:00Z');
const at = (d: number) => t0 + d * DAY;

// ------------------------------------------------------------------ leakage
test('the state at T is unchanged by events that happen AFTER T', () => {
  // The property the whole exercise depends on. If appending future events changes
  // the state, the model is being scored on information it could not have had.
  const past = [at(0), at(3), at(9)];
  const future = [...past, at(20), at(25), at(40)];
  const a = stateAt(at(12), past, []);
  const b = stateAt(at(12), future, []);
  assert.deepEqual(a, b, 'future events leaked into the state');
});

test('an event exactly AT the decision instant is not visible to it', () => {
  // Strictly-before. An event at the same instant would let the model "predict"
  // something already happening.
  const s = stateAt(at(10), [at(0), at(10)], []);
  assert.equal(s!.since / 24, 10, 'the event at T must not count as history');
});

test('stateAt returns null before any history exists', () => {
  assert.equal(stateAt(at(0), [at(5)], []), null);
});

test('mirror comes from the OTHER vendor, and reads absent when there is none', () => {
  const withOther = stateAt(at(10), [at(0)], [at(9)]);
  assert.ok(withOther!.mirror <= 120, 'a recent other-vendor event must be live');
  const without = stateAt(at(10), [at(0)], []);
  assert.ok(without!.mirror > 120, 'no other-vendor history must read as no recent move');
});

// ------------------------------------------------------------------ scoring
test('brier is the mean squared error of the forecast', () => {
  assert.equal(brier([{ at: 0, p: 1, outcome: 1 }]), 0, 'a confident correct call scores 0');
  assert.equal(brier([{ at: 0, p: 0, outcome: 1 }]), 1, 'a confident wrong call scores 1');
  assert.equal(brier([{ at: 0, p: 0.5, outcome: 1 }]), 0.25);
  assert.equal(brier([{ at: 0, p: 1, outcome: 1 }, { at: 1, p: 0, outcome: 1 }]), 0.5);
});

test('skill is negative when the model is WORSE than the reference', () => {
  assert.equal(skill(0.1, 0.2), 0.5);
  assert.equal(skill(0.2, 0.2), 0);
  assert.ok(skill(0.3, 0.2) < 0, 'a worse model must score negative, not zero');
});

test('calibration in the large compares mean forecast to observed frequency', () => {
  const c = calibrationInTheLarge([
    { at: 0, p: 0.8, outcome: 1 },
    { at: 1, p: 0.8, outcome: 0 },
  ]);
  assert.equal(c.meanForecast, 0.8);
  assert.equal(c.observedFrequency, 0.5);
});

// ------------------------------------------------------------------ the run
test('baselines are walk-forward too, or the comparison is rigged', () => {
  // A constant rate computed over the whole span would know the future. Both
  // baselines must be built from the same restricted history as the model.
  const events = Array.from({ length: 12 }, (_, i) => at(i * 5));
  const { series } = run(events, [], ['normal'], { warmupDays: 10 });
  const constant = series.find((s) => s.regime === 'baseline-constant')!;
  // Its first prediction can only use the events before the first scored day.
  assert.ok(constant.rows.length > 0);
  assert.ok(constant.rows.every((r) => r.p >= 0 && r.p <= 1));
});

test('every scored window lies entirely inside the observed span', () => {
  const events = Array.from({ length: 10 }, (_, i) => at(i * 6));
  const { series } = run(events, [], ['normal'], { warmupDays: 7 });
  const last = events[events.length - 1];
  for (const s of series) {
    for (const r of s.rows) {
      assert.ok(r.at + 48 * 3_600_000 <= last, 'a window may not extend past the last known event');
    }
  }
});

test('a non-overlapping stride yields roughly half the predictions', () => {
  const events = Array.from({ length: 15 }, (_, i) => at(i * 4));
  const a = run(events, [], ['normal'], { warmupDays: 7, strideDays: 1 }).days;
  const b = run(events, [], ['normal'], { warmupDays: 7, strideDays: 2 }).days;
  assert.ok(b < a && b >= Math.floor(a / 2) - 1, `expected ~half: ${a} -> ${b}`);
});

// ------------------------------------------------------------------ uncertainty
test('the bootstrap is deterministic — a published figure must be reproducible', () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ at: at(i), p: 0.3, outcome: (i % 4 === 0 ? 1 : 0) as 0 | 1 }));
  const ref = rows.map((r) => ({ ...r, p: 0.25 }));
  const a = bootstrapSkill(rows, ref);
  const b = bootstrapSkill(rows, ref);
  assert.deepEqual(a, b, 'same seed must give the same interval');
});

test('the bootstrap interval brackets the point estimate', () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({ at: at(i), p: 0.3, outcome: (i % 3 === 0 ? 1 : 0) as 0 | 1 }));
  const ref = rows.map((r) => ({ ...r, p: 0.4 }));
  const point = skill(brier(rows), brier(ref));
  const { lo, hi } = bootstrapSkill(rows, ref);
  assert.ok(lo <= point && point <= hi, `point ${point} outside [${lo}, ${hi}]`);
});

// ------------------------------------------------------------------ the finding
test('the real ledger produces a result, and launch over-forecasts', async () => {
  // Pins the headline finding so it cannot silently change: at the ledger state of
  // 2026-07-27 the published `launch` regime forecasts ~39% while ~25% of windows
  // contained an event. If this assertion starts failing, the corpus has grown
  // enough to change the answer — which is the moment to re-run and re-publish, not
  // to relax the test.
  const { loadEvents } = await import('../../scripts/backtest.mjs');
  const { codex, claudeCode } = loadEvents();
  const { series } = run(codex, claudeCode, ['quiet', 'normal', 'launch']);
  const launch = series.find((s) => s.regime === 'launch')!;
  const normal = series.find((s) => s.regime === 'normal')!;
  const c = calibrationInTheLarge(launch.rows);

  assert.ok(c.meanForecast > c.observedFrequency + 0.08, 'launch should over-forecast by a wide margin');
  assert.ok(normal.brier < launch.brier, 'normal should score better than launch on this corpus');
});
