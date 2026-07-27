/**
 * Tests for the sweep log.
 *
 * The load-bearing ones are the last three: a sweep must never be mistakable for a
 * ledger record, the thresholds must match what the corpus actually shows, and
 * "last reviewed" must take the LATER of learning and looking — otherwise the
 * freshness signal understates how fresh the ledger is, or worse, overstates it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  ABANDONED_DAYS,
  OBSERVED_MAX_GAP_DAYS,
  OUTCOMES,
  STALE_DAYS,
  appendSweep,
  lastReviewedAt,
  lastSweptAt,
  readSweeps,
  validateSweep,
} from '../sweeps.mjs';

const VALID = {
  swept_at: '2026-07-27T03:05:00Z',
  by: 'tester',
  vendors: ['codex'],
  sources: [{ url: 'https://example.invalid/a', outcome: 'read', note: 'fine' }],
  records_added: 0,
  candidates: 0,
};

const withTemp = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'qri-sweep-'));
  try {
    return fn(join(dir, 'sweeps.jsonl'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------- validation
test('a well-formed sweep validates', () => {
  assert.deepEqual(validateSweep(VALID), []);
});

test('swept_at must be UTC, Z-suffixed', () => {
  // RUNBOOK §5. This slipped once in the ledger and once, on 2026-07-27, in a
  // CORRECTION to a comparison page — reasoned from the local Pacific clock.
  assert.ok(validateSweep({ ...VALID, swept_at: '2026-07-27T03:05:00-07:00' }).some((e) => /UTC/.test(e)));
  assert.ok(validateSweep({ ...VALID, swept_at: 'not a date' }).some((e) => /RFC 3339/.test(e)));
});

test('a sweep with no sources is refused', () => {
  // "I looked" with nothing to show is not a record of looking.
  assert.ok(validateSweep({ ...VALID, sources: [] }).some((e) => /non-empty/.test(e)));
});

test('every source needs a url and a known outcome', () => {
  assert.ok(validateSweep({ ...VALID, sources: [{ outcome: 'read' }] }).some((e) => /url is required/.test(e)));
  assert.ok(
    validateSweep({ ...VALID, sources: [{ url: 'https://x.invalid', outcome: 'shrug' }] }).some((e) => /outcome must be/.test(e)),
  );
});

test('the outcome vocabulary distinguishes "nothing there" from "could not read"', () => {
  // The whole point of the log. A 403 is not evidence of absence, and collapsing
  // the two would let a blocked source read as a clean negative — which is how the
  // memeburn.com exclusion nearly became a silent gap.
  for (const o of ['read', 'no-coverage', 'blocked', 'inadmissible']) assert.ok(OUTCOMES[o], `missing outcome ${o}`);
  assert.notEqual(OUTCOMES.blocked, OUTCOMES['no-coverage']);
});

test('counts must be non-negative integers', () => {
  assert.ok(validateSweep({ ...VALID, records_added: -1 }).length > 0);
  assert.ok(validateSweep({ ...VALID, candidates: 1.5 }).length > 0);
});

// ---------------------------------------------------------------- the log
test('sweeps append and round-trip, oldest first', () => {
  withTemp((file) => {
    appendSweep({ ...VALID, swept_at: '2026-08-01T00:00:00Z' }, { file });
    appendSweep({ ...VALID, swept_at: '2026-07-27T03:05:00Z' }, { file });
    const back = readSweeps({ file });
    assert.equal(back.length, 2);
    assert.deepEqual(
      back.map((s) => s.swept_at),
      ['2026-07-27T03:05:00Z', '2026-08-01T00:00:00Z'],
      'must be ordered by time, not by append order',
    );
    assert.equal(lastSweptAt({ file }), '2026-08-01T00:00:00Z');
  });
});

test('an invalid sweep throws rather than being written', () => {
  withTemp((file) => {
    assert.throws(() => appendSweep({ ...VALID, by: '' }, { file }), /invalid sweep/);
    assert.deepEqual(readSweeps({ file }), [], 'nothing may be written');
  });
});

test('a missing log reads as empty, not as an error', () => {
  assert.deepEqual(readSweeps({ file: '/nonexistent/qri/sweeps.jsonl' }), []);
  assert.equal(lastSweptAt({ file: '/nonexistent/qri/sweeps.jsonl' }), null);
});

test('a torn final line is skipped', () => {
  withTemp((file) => {
    writeFileSync(file, JSON.stringify(VALID) + '\n{"swept_at":"2026-08');
    assert.equal(readSweeps({ file }).length, 1);
  });
});

// ---------------------------------------------------------------- last reviewed
test('last reviewed takes the LATER of learning and looking', () => {
  withTemp((file) => {
    // No sweeps yet: the ledger's own as-of is all there is.
    assert.equal(lastReviewedAt('2026-07-26T14:00:00Z', { file }), '2026-07-26T14:00:00Z');

    // A later sweep supersedes it — we looked after we last learned anything.
    appendSweep({ ...VALID, swept_at: '2026-07-27T03:05:00Z' }, { file });
    assert.equal(lastReviewedAt('2026-07-26T14:00:00Z', { file }), '2026-07-27T03:05:00Z');

    // An EARLIER sweep must not drag freshness backwards: adding a record is
    // attention too, and the more recent attention is what the reader cares about.
    assert.equal(lastReviewedAt('2026-08-01T00:00:00Z', { file }), '2026-08-01T00:00:00Z');
  });
});

test('with no ledger as-of at all, a sweep still establishes freshness', () => {
  withTemp((file) => {
    appendSweep(VALID, { file });
    assert.equal(lastReviewedAt(null, { file }), VALID.swept_at);
  });
});

// ---------------------------------------------------------------- thresholds
test('the staleness thresholds exceed every gap the corpus actually contains', () => {
  // MEASURED, not chosen. A threshold at or below an observed maximum would fire
  // on a quiet period the vendors have genuinely produced, and a warning that
  // cries wolf gets ignored — which is how the real one gets missed.
  assert.ok(
    STALE_DAYS > OBSERVED_MAX_GAP_DAYS.codex,
    `STALE_DAYS ${STALE_DAYS} must exceed the observed Codex max gap ${OBSERVED_MAX_GAP_DAYS.codex}`,
  );
  assert.ok(
    ABANDONED_DAYS > OBSERVED_MAX_GAP_DAYS['claude-code'],
    `ABANDONED_DAYS ${ABANDONED_DAYS} must exceed the observed Claude Code max gap ${OBSERVED_MAX_GAP_DAYS['claude-code']}`,
  );
  assert.ok(ABANDONED_DAYS > STALE_DAYS, 'escalation must be ordered');
});

test('the recorded max gaps still match the ledger', async () => {
  // Pins the derivation, so the thresholds cannot quietly stop being justified as
  // the corpus grows. If this fails, RE-DERIVE the constants — do not relax it.
  const { collectEntries } = await import('../../scripts/validate.mjs');
  const RESET = new Set(['global_reset', 'banked_reset']);
  const recs = collectEntries()
    .map((e) => JSON.parse(e.raw))
    .filter((r) => r.superseded_by === null);

  for (const vendor of ['codex', 'claude-code']) {
    const t = recs
      .filter((r) => r.vendor === vendor && (r.effects ?? [r.kind]).some((k) => RESET.has(k)))
      .map((r) => Date.parse(r.effective_at))
      .sort((a, b) => a - b);
    let max = 0;
    for (let i = 1; i < t.length; i++) max = Math.max(max, (t[i] - t[i - 1]) / 86_400_000);
    assert.equal(
      Math.round(max),
      OBSERVED_MAX_GAP_DAYS[vendor],
      `${vendor}: observed max gap is now ${Math.round(max)}d, recorded as ${OBSERVED_MAX_GAP_DAYS[vendor]}d — re-derive the thresholds`,
    );
  }
});

// ---------------------------------------------------------------- the boundary
test('a sweep cannot be mistaken for a ledger record', () => {
  // It asserts that someone LOOKED, never that an event occurred. Giving it a
  // vendor-scoped identity, a confidence grade or evidence[] would make it
  // droppable into ledger/ and validatable by accident.
  const keys = Object.keys(VALID);
  for (const forbidden of ['id', 'confidence', 'evidence', 'effective_at', 'kind', 'scope', 'superseded_by']) {
    assert.ok(!keys.includes(forbidden), `a sweep must not carry "${forbidden}"`);
  }
  assert.ok(!/^(cx|cc)-\d{4}-\d{2}-\d{2}-\d{2}$/.test(VALID.swept_at));
});
