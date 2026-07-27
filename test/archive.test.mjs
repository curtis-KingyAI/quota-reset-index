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

// ------------------------------------------------- verification demotes (2026-07-27)
test('a capture that failed its last verification is no longer served', () => {
  // Otherwise verifying is theatre: the log faithfully records that a link is dead
  // and the site goes on publishing it.
  const entry = {
    attempts: [
      { method: 'availability', status: 'ok', archive_url: 'A', archive_timestamp: '1' },
      { method: 'verify', status: 'not_found', archive_url: 'A', checked_at: '2' },
    ],
  };
  assert.equal(bestCapture(entry), null);
});

test('INCONCLUSIVE is not dead — a failed check must NOT demote', () => {
  // ⚠️ THE MOST IMPORTANT ONE. `not_found` means the archive answered and the
  // snapshot is gone. `failed` means we could not ask — timeout, refused
  // connection, rate limit. The first full verification run was throttled into 42
  // "fetch failed" results; under a rule that demoted on any non-ok verdict,
  // published coverage would have fallen from 61 to 18 purely because our own
  // client got rate-limited, and it would have looked like a real finding.
  const entry = {
    attempts: [
      { method: 'availability', status: 'ok', archive_url: 'A', archive_timestamp: '1' },
      { method: 'verify', status: 'failed', archive_url: 'A', checked_at: '2' },
    ],
  };
  assert.equal(bestCapture(entry)?.archive_url, 'A');
});

test('a never-verified capture is still served', () => {
  // Every capture was unverified until 2026-07-27. Demoting them would have blanked
  // the entire archive layer the moment verification shipped.
  const entry = { attempts: [{ method: 'availability', status: 'ok', archive_url: 'A', archive_timestamp: '1' }] };
  assert.equal(bestCapture(entry)?.archive_url, 'A');
});

test('the latest verdict wins — a dead capture can come back', () => {
  const entry = {
    attempts: [
      { method: 'availability', status: 'ok', archive_url: 'A', archive_timestamp: '1' },
      { method: 'verify', status: 'not_found', archive_url: 'A', checked_at: '2' },
      { method: 'verify', status: 'ok', archive_url: 'A', checked_at: '3' },
    ],
  };
  assert.equal(bestCapture(entry)?.archive_url, 'A');
});

test('a dead capture falls back to a live one rather than blanking', () => {
  const entry = {
    attempts: [
      { method: 'availability', status: 'ok', archive_url: 'A', archive_timestamp: '1' },
      { method: 'availability', status: 'ok', archive_url: 'B', archive_timestamp: '2' },
      { method: 'verify', status: 'not_found', archive_url: 'B', checked_at: '3' },
    ],
  };
  assert.equal(bestCapture(entry)?.archive_url, 'A');
});

test('a verify attempt is a verdict, never itself a capture', () => {
  const entry = { attempts: [{ method: 'verify', status: 'ok', archive_url: 'A', checked_at: '1' }] };
  assert.equal(bestCapture(entry), null, 'a verdict with no capture behind it is not a capture');
});
