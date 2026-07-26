import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendAttempt, bestCapture, coverage, loadEntry, urlKey, loadIndex } from '../lib/archive.mjs';
import { buildOutputs } from '../scripts/build-ledger.mjs';

const withTmp = (fn) => {
  const d = mkdtempSync(join(tmpdir(), 'qri-arch-'));
  try { fn(d); } finally { rmSync(d, { recursive: true, force: true }); }
};

const U = 'https://example.invalid/a';

test('the archive index is append-only: failures are kept, not overwritten', () => {
  withTmp((d) => {
    appendAttempt(U, { checked_at: '2026-07-26T10:00:00Z', method: 'wayback-availability', status: 'not_found' }, d);
    appendAttempt(U, { checked_at: '2026-07-26T11:00:00Z', method: 'save-page-now', status: 'failed', note: 'x' }, d);
    appendAttempt(U, { checked_at: '2026-07-26T12:00:00Z', method: 'save-page-now', status: 'ok',
                       archive_url: 'https://web.archive.org/web/1/a', archive_timestamp: '2026-07-26T12:00:00Z' }, d);
    const e = loadEntry(U, d);
    assert.equal(e.attempts.length, 3, 'every attempt is retained');
    assert.equal(e.attempts[0].status, 'not_found', 'the first failure is still there');
  });
});

test('bestCapture takes the most recent success, ignoring failures', () => {
  withTmp((d) => {
    appendAttempt(U, { checked_at: 'x', method: 'm', status: 'ok', archive_url: 'A', archive_timestamp: '2026-01-01T00:00:00Z' }, d);
    appendAttempt(U, { checked_at: 'x', method: 'm', status: 'failed' }, d);
    appendAttempt(U, { checked_at: 'x', method: 'm', status: 'ok', archive_url: 'B', archive_timestamp: '2026-06-01T00:00:00Z' }, d);
    assert.equal(bestCapture(loadEntry(U, d)).archive_url, 'B');
  });
});

test('a URL with only failures reports as unarchived, not as archived-with-null', () => {
  withTmp((d) => {
    appendAttempt(U, { checked_at: 'x', method: 'm', status: 'blocked', note: 'source refuses archiving' }, d);
    assert.equal(bestCapture(loadEntry(U, d)), null);
    const c = coverage([U], d);
    assert.equal(c.archived, 0);
    assert.deepEqual(c.unarchived, [U]);
  });
});

test('the sidecar never touches record files — the append-only guarantee is untouched', () => {
  // The whole reason for the sidecar. If this ever fails, the design was abandoned.
  const before = readFileSync('ledger/codex/cx-2026-06-04-01.json', 'utf8');
  const parsed = JSON.parse(before);
  for (const e of parsed.evidence) {
    assert.equal(e.archive_url, null, 'record files must keep archive_url null on disk');
    assert.ok(!('archive_timestamp' in e), 'record files must not gain an archive_timestamp field');
  }
});

test('the PUBLISHED output carries archives even though the records do not', () => {
  const rec = JSON.parse(readFileSync('ledger/codex/cx-2026-06-04-01.json', 'utf8'));
  const url = rec.evidence[0].url;
  const index = new Map([[url, { best: { archive_url: 'https://web.archive.org/web/9/x', archive_timestamp: '2026-07-26T00:00:00Z' } }]]);
  const { json } = buildOutputs([rec], index);
  const out = JSON.parse(json)[0];
  assert.equal(out.evidence[0].archive_url, 'https://web.archive.org/web/9/x');
  assert.equal(out.evidence[0].archive_timestamp, '2026-07-26T00:00:00Z');
  // ...and an unarchived item is untouched rather than given a fake value.
  if (out.evidence[1]) assert.equal(out.evidence[1].archive_url, null);
});

test('build stays deterministic with the archive index joined in', () => {
  const rec = JSON.parse(readFileSync('ledger/codex/cx-2026-06-04-01.json', 'utf8'));
  const index = loadIndex();
  assert.equal(buildOutputs([rec], index).json, buildOutputs([rec], index).json);
});

test('urlKey is stable and distinct', () => {
  assert.equal(urlKey('https://a.invalid'), urlKey('https://a.invalid'));
  assert.notEqual(urlKey('https://a.invalid'), urlKey('https://b.invalid'));
});
