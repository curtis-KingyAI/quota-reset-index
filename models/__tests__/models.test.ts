/**
 * §7.2 golden tests — "Lock the current behaviour so a future refactor cannot
 * silently move the numbers."
 *
 * ⚠️ WHAT THESE ARE LOCKED TO, AND WHY IT IS NOT THE SPEC TABLE ⚠️
 *
 * §7 states: "Source of truth is the working prototype... port them, do not
 * reimplement them." The port was checked against the prototype's own code run
 * headlessly: 29 independent numbers (7 weekdays x 4 windows for Claude Code,
 * 4 windows for Codex, plus the scheduled recycle) — ALL IDENTICAL.
 *
 * The Codex column of the §7.2 table matches the prototype exactly: 20/34/55/68.
 *
 * The CLAUDE CODE column does not, and cannot. Its 48h and 72h figures (24%, 33%)
 * are not produced by the prototype at ANY clock: a search over the full week at
 * 15-minute granularity — 672 start times — found zero exact matches, the closest
 * being 9/14/24/34, three points off in aggregate. The prototype gives 27%/37% on
 * an ordinary weekday.
 *
 * So these lock to the PROTOTYPE, per §7's own instruction about which artifact
 * governs, and the divergence is asserted explicitly below so that nobody can
 * quietly "fix" one side without the other failing. Reported to the operator as a
 * spec defect; the table needs amending, not the model.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CODEX_BASELINE, codexEvidence, codexLambda, codexRefractory } from '../codex.ts';
import { CLAUDE_BASELINE, calendar, claudeEvidence, claudeLambda, depletion, erf, scheduledRecycle } from '../claudeCode.ts';
import { claudeForecast, codexForecast, pct, survivalProbability } from '../integrate.ts';
import { CALIBRATION_BANNER } from '../config.ts';

/** Pinned per §7.2: "Claude Code figures shift with the day-of-week calendar term. Pin the clock." */
const PINNED = new Date('2026-07-07T12:00:00Z'); // Tuesday, an ordinary weekday hour
const WINDOWS = [12, 24, 48, 72] as const;

// -------------------------------------------------------------- Codex goldens
test('§7.2 — Codex golden numbers at the July baseline', () => {
  const expected: Record<number, number> = { 12: 20, 24: 34, 48: 55, 72: 68 };
  for (const w of WINDOWS) {
    assert.equal(pct(codexForecast(CODEX_BASELINE, 'launch', w).probability), expected[w], `Codex ${w}h`);
  }
});

test('§7.2 — the Codex column agrees with the spec table exactly', () => {
  // Recorded separately from the lock above so that if the model ever changes,
  // it is obvious whether it broke agreement with the SPEC or merely with itself.
  assert.deepEqual(
    WINDOWS.map((w) => pct(codexForecast(CODEX_BASELINE, 'launch', w).probability)),
    [20, 34, 55, 68],
  );
});

test('Codex intensity is clock-independent', () => {
  const a = codexForecast(CODEX_BASELINE, 'launch', 48).probability;
  const saved = Date.now;
  try {
    Date.now = () => new Date('2026-01-03T03:00:00Z').getTime(); // a Saturday
    assert.equal(codexForecast(CODEX_BASELINE, 'launch', 48).probability, a);
  } finally {
    Date.now = saved;
  }
});

// -------------------------------------------------- Claude Code goldens (locked to prototype)
test('§7.2 — Claude Code discretionary goldens, locked to the PROTOTYPE at a pinned clock', () => {
  const expected: Record<number, number> = { 12: 7, 24: 14, 48: 27, 72: 37 };
  for (const w of WINDOWS) {
    assert.equal(pct(claudeForecast(CLAUDE_BASELINE, 'launch', PINNED, w).probability), expected[w], `Claude Code ${w}h`);
  }
});

test('the §7.2 Claude Code table diverges from the prototype — asserted so it cannot be silently reconciled', () => {
  const got = WINDOWS.map((w) => pct(claudeForecast(CLAUDE_BASELINE, 'launch', PINNED, w).probability));
  const specTable = [7, 14, 24, 33];

  // Short windows agree.
  assert.equal(got[0], specTable[0], '12h agrees');
  assert.equal(got[1], specTable[1], '24h agrees');

  // Long windows do not, and the model is right — see this file's header.
  assert.notEqual(got[2], specTable[2], '48h: if this now agrees, the spec was amended — update this test');
  assert.notEqual(got[3], specTable[3], '72h: if this now agrees, the spec was amended — update this test');
  assert.equal(got[2], 27);
  assert.equal(got[3], 37);
});

test('the calendar term is the only reason the Claude Code figures move by day', () => {
  const sat = new Date('2026-07-11T12:00:00Z');
  const fri = new Date('2026-07-10T12:00:00Z');
  assert.equal(calendar(PINNED, 0), 1.0);
  assert.equal(calendar(sat, 0), 0.75);
  assert.equal(calendar(fri, 0), 1.95);
  assert.notEqual(
    pct(claudeForecast(CLAUDE_BASELINE, 'launch', sat, 24).probability),
    pct(claudeForecast(CLAUDE_BASELINE, 'launch', PINNED, 24).probability),
  );
});

// -------------------------------------------------------------- scheduled track
test('§7.2 — scheduled recycle at the 48h window with 25h elapsed is ~95%', () => {
  const s = scheduledRecycle(CLAUDE_BASELINE, 48);
  assert.equal(s.dueInHours, 47);
  assert.equal(pct(s.probability), 95);
});

test('the scheduled track saturates either side of the anchor', () => {
  assert.equal(pct(scheduledRecycle({ ...CLAUDE_BASELINE, since: 25 }, 12).probability), 0);
  assert.equal(pct(scheduledRecycle({ ...CLAUDE_BASELINE, since: 71 }, 12).probability), 100);
  // Overdue: due is negative, so any window contains it.
  assert.equal(pct(scheduledRecycle({ ...CLAUDE_BASELINE, since: 80 }, 12).probability), 100);
});

// ------------------------------------------------- the clustering behaviour (§7.2, explicit)
test('§7.2 — a reset 2h ago RAISES the 48h probability while LOWERING instantaneous lambda', () => {
  // This is intentional, and the single most likely thing for a future refactor
  // to "fix" backwards. Excitation outlives the refractory dip.
  const baseline = CODEX_BASELINE;
  const recent = { ...CODEX_BASELINE, since: 2 };

  const pBaseline = codexForecast(baseline, 'launch', 48).probability;
  const pRecent = codexForecast(recent, 'launch', 48).probability;
  assert.ok(pRecent > pBaseline, `48h probability must RISE: baseline ${pBaseline}, recent ${pRecent}`);

  const lBaseline = codexLambda(baseline, 'launch', 0);
  const lRecent = codexLambda(recent, 'launch', 0);
  assert.ok(lRecent < lBaseline, `instantaneous lambda must FALL: baseline ${lBaseline}, recent ${lRecent}`);

  // And the mechanism, so a failure says which half broke.
  assert.ok(codexRefractory(recent, 0) < 0.4, 'refractory dip should be deep at 2h');
  assert.ok(codexRefractory(baseline, 0) > 0.95, 'refractory should have relaxed by 38h');
});

// -------------------------------------------------------------- component behaviour
test('at the baseline every evidence term is inert (multiplier exactly 1)', () => {
  assert.equal(codexEvidence(CODEX_BASELINE, 0).multiplier, 1);
  assert.equal(claudeEvidence(CLAUDE_BASELINE, 0).multiplier, 1);
  for (const r of codexEvidence(CODEX_BASELINE, 0).rows) assert.equal(r.multiplier, 1);
});

test('a mirror signal older than the 120h cutoff contributes nothing', () => {
  assert.equal(codexEvidence({ ...CODEX_BASELINE, mirror: 121 }, 0).multiplier, 1);
  assert.ok(codexEvidence({ ...CODEX_BASELINE, mirror: 120 }, 0).multiplier > 1);
});

test('evidence decays across the forecast window rather than freezing at t=0', () => {
  const withIncident = { ...CODEX_BASELINE, inc: 100 };
  const now = codexEvidence(withIncident, 0).multiplier;
  const later = codexEvidence(withIncident, 72).multiplier;
  assert.ok(later < now, 'a live incident must matter less 72h out');
  assert.ok(now > 2.9 && now < 3.1, `w=1.10 at full strength gives ~e^1.1: got ${now}`);
});

test('depletion is monotonic and bounded', () => {
  assert.ok(depletion(0) > 1 && depletion(0) < 1.01);
  assert.ok(depletion(1) > 2.6 && depletion(1) < 2.71);
  for (let u = 0; u < 1; u += 0.05) assert.ok(depletion(u + 0.05) > depletion(u));
  assert.ok(Math.abs(depletion(0.74) - 1.85) < 1e-9, 'centre is exactly half the uplift');
});

test('erf matches known values', () => {
  assert.ok(Math.abs(erf(0)) < 1e-12);
  assert.ok(Math.abs(erf(1) - 0.8427007) < 1e-6);
  assert.ok(Math.abs(erf(-1) + 0.8427007) < 1e-6);
  assert.ok(Math.abs(erf(2) - 0.9953223) < 1e-6);
});

test('survival probability is monotonic in the window and never leaves [0,1)', () => {
  let prev = 0;
  for (const w of [1, 6, 12, 24, 48, 72, 96]) {
    const p = codexForecast(CODEX_BASELINE, 'launch', w).probability;
    assert.ok(p > prev, `must increase with window at ${w}h`);
    assert.ok(p >= 0 && p < 1);
    prev = p;
  }
});

test('a zero intensity yields zero probability and an infinite mean wait', () => {
  assert.equal(survivalProbability(() => 0, 48), 0);
  const f = codexForecast(CODEX_BASELINE, 'quiet', 48);
  assert.ok(Number.isFinite(f.meanWaitHours));
});

test('regimes are ordered quiet < normal < launch', () => {
  const p = (r: 'quiet' | 'normal' | 'launch') => codexForecast(CODEX_BASELINE, r, 48).probability;
  assert.ok(p('quiet') < p('normal'));
  assert.ok(p('normal') < p('launch'));
});

// -------------------------------------------------------------- §7.3
test('§7.3 — the calibration banner exists and says the weights are unfitted', () => {
  assert.match(CALIBRATION_BANNER, /^Uncalibrated\./);
  assert.match(CALIBRATION_BANNER, /hand-set priors/);
  assert.match(CALIBRATION_BANNER, /not fitted parameters/);
});
