/**
 * Phase 3 (§6) acceptance.
 *
 * Fixtures are REAL captured bodies from both vendors, not hand-written ones,
 * so the "OpenAI is not really Statuspage" divergence is exercised for real.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { parseSummary, SEVERITY } from '../severity.ts';
import { currentState, describeAge, readLog, sha256 } from '../store.ts';
import { pollFeed, pollAll, type Fetcher } from '../ingest.ts';
import { FEEDS } from '../config.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const fixture = (n: string) => readFileSync(join(HERE, 'fixtures', n), 'utf8');
const OPENAI = fixture('openai-summary.json');
const CLAUDE = fixture('claude-summary.json');

const codexFeed = FEEDS.find((f) => f.vendor === 'codex')!;
const claudeFeed = FEEDS.find((f) => f.vendor === 'claude-code')!;
const T0 = new Date('2026-07-26T10:00:00Z');

const withTmp = async (fn: (dir: string) => Promise<void> | void) => {
  const dir = mkdtempSync(join(tmpdir(), 'qri-status-'));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const ok = (body: string): Fetcher => async () => ({ status: 200, body });
const boom = (msg: string): Fetcher => async () => {
  throw new Error(msg);
};

// ------------------------------------------------------------------ mapping
test('§6 — indicator maps to the specified severities', () => {
  assert.deepEqual(SEVERITY, { none: 0, minor: 45, major: 80, critical: 100 });
  for (const [ind, sev] of Object.entries(SEVERITY)) {
    const r = parseSummary(JSON.stringify({ status: { indicator: ind, description: 'x' } }));
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.severity, sev);
  }
});

test('§6 — an UNRECOGNISED indicator does not silently become 0', () => {
  // The prototype does `sev[indicator] ?? 0`, which reports "all fine" for a
  // value the vendor has newly introduced. That is the exact failure §6 forbids.
  const r = parseSummary(JSON.stringify({ status: { indicator: 'catastrophic' } }));
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.sawIndicator, 'catastrophic');
  assert.match(r.ok === false ? r.reason : '', /refusing to guess/);
});

test('§5.1-style defensiveness — malformed bodies degrade, never crash, never read wrong', () => {
  for (const body of ['{ not json', 'null', '[]', '"a string"', '{}', '{"status":null}', '{"status":{}}', '{"status":{"indicator":42}}']) {
    const r = parseSummary(body);
    assert.equal(r.ok, false, `expected failure for ${body}`);
    assert.ok((r as { reason: string }).reason.length > 0);
  }
});

// ------------------------------------------------------------------ real payloads
test('both real vendor payloads parse, despite different shapes', () => {
  const o = parseSummary(OPENAI);
  const c = parseSummary(CLAUDE);
  assert.equal(o.ok, true);
  assert.equal(c.ok, true);
  assert.ok(o.ok && typeof o.severity === 'number');
  assert.ok(c.ok && typeof c.severity === 'number');
});

test('OpenAI omits keys when empty — absent arrays report null, not 0', () => {
  // Observed for real: on 2026-07-25 OpenAI returned 3 top-level keys with no
  // `incidents`; on 2026-07-26, with one live incident, the key appeared.
  // `scheduled_maintenances` stayed absent throughout. So "missing" must mean
  // "this feed does not carry it", never "there are zero".
  const stripped = JSON.parse(OPENAI);
  delete stripped.incidents;
  delete stripped.scheduled_maintenances;
  const r = parseSummary(JSON.stringify(stripped));
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.incidentCount, null, 'absent incidents must be null, not 0');

  const withEmpty = parseSummary(JSON.stringify({ ...JSON.parse(OPENAI), incidents: [] }));
  assert.equal(withEmpty.ok && withEmpty.incidentCount, 0, 'present-but-empty must be 0, distinct from null');
});

// ------------------------------------------------------------------ snapshot vs heartbeat
test('§6 — a snapshot is stored only when the body hash changes; otherwise a heartbeat', async () => {
  await withTmp(async (dir) => {
    const a = await pollFeed(codexFeed, T0, ok(OPENAI), dir);
    assert.equal(a.result, 'snapshot');

    const b = await pollFeed(codexFeed, new Date('2026-07-26T10:10:00Z'), ok(OPENAI), dir);
    assert.equal(b.result, 'heartbeat', 'identical body must not write a second snapshot');

    const changed = JSON.stringify({ ...JSON.parse(OPENAI), status: { indicator: 'minor', description: 'Partial outage' } });
    const c = await pollFeed(codexFeed, new Date('2026-07-26T10:20:00Z'), ok(changed), dir);
    assert.equal(c.result, 'snapshot');

    const snapDir = join(dir, 'codex', 'snapshots');
    assert.equal(readdirSync(snapDir).length, 2, 'exactly two distinct bodies stored');
    assert.ok(existsSync(join(snapDir, `${sha256(OPENAI)}.json`)));

    const log = readLog('codex', dir);
    assert.deepEqual(log.map((e) => e.type), ['snapshot', 'heartbeat', 'snapshot']);
    assert.equal(log[2].severity, 45);
  });
});

// ------------------------------------------------------------------ failure handling
test('§6 — a failed fetch serves the LAST KNOWN value with its age, never a stale zero', async () => {
  await withTmp(async (dir) => {
    const good = JSON.stringify({ status: { indicator: 'major', description: 'Major outage' } });
    await pollFeed(codexFeed, T0, ok(good), dir);

    const later = new Date('2026-07-26T12:30:00Z');
    const f = await pollFeed(codexFeed, later, boom('network down'), dir);
    assert.equal(f.result, 'failure');

    const s = currentState('codex', later, dir);
    assert.equal(s.severity, 80, 'must still serve the last known severity, not 0');
    assert.equal(s.indicator, 'major');
    assert.equal(s.consecutiveFailures, 1);
    assert.equal(s.degraded, false);
    assert.equal(s.ageMs, 2.5 * 3600_000);
    assert.equal(describeAge(s.ageMs), '2 hours ago');
  });
});

test('§6 — a shape change is a failure, not a severity of 0', async () => {
  await withTmp(async (dir) => {
    await pollFeed(codexFeed, T0, ok(JSON.stringify({ status: { indicator: 'critical' } })), dir);
    // Vendor renames the field. The naive `?? 0` would now report "all clear".
    const r = await pollFeed(codexFeed, new Date('2026-07-26T10:10:00Z'), ok(JSON.stringify({ statusV2: { indicator: 'none' } })), dir);
    assert.equal(r.result, 'failure');
    const s = currentState('codex', new Date('2026-07-26T10:10:00Z'), dir);
    assert.equal(s.severity, 100, 'last known critical must survive the shape change');
  });
});

test('§6 — three consecutive failures marks the feed degraded', async () => {
  await withTmp(async (dir) => {
    await pollFeed(codexFeed, T0, ok(OPENAI), dir);
    for (let i = 1; i <= 2; i++) await pollFeed(codexFeed, new Date(T0.getTime() + i * 600_000), boom('down'), dir);
    assert.equal(currentState('codex', T0, dir).degraded, false, 'two failures is not yet degraded');

    await pollFeed(codexFeed, new Date(T0.getTime() + 3 * 600_000), boom('down'), dir);
    const s = currentState('codex', T0, dir);
    assert.equal(s.consecutiveFailures, 3);
    assert.equal(s.degraded, true);
  });
});

test('a recovery resets the consecutive-failure count', async () => {
  await withTmp(async (dir) => {
    for (let i = 0; i < 4; i++) await pollFeed(codexFeed, new Date(T0.getTime() + i * 600_000), boom('down'), dir);
    assert.equal(currentState('codex', T0, dir).degraded, true);
    await pollFeed(codexFeed, new Date(T0.getTime() + 5 * 600_000), ok(OPENAI), dir);
    const s = currentState('codex', T0, dir);
    assert.equal(s.consecutiveFailures, 0);
    assert.equal(s.degraded, false);
  });
});

test('§6 — a feed never successfully read reports UNKNOWN, not 0', async () => {
  await withTmp(async (dir) => {
    await pollFeed(codexFeed, T0, boom('down'), dir);
    const s = currentState('codex', T0, dir);
    assert.equal(s.severity, null);
    assert.equal(s.neverRead, true);
    assert.equal(describeAge(s.ageMs), 'never read');
  });
});

test('non-2xx responses are failures', async () => {
  await withTmp(async (dir) => {
    const r = await pollFeed(codexFeed, T0, async () => ({ status: 503, body: 'nope' }), dir);
    assert.equal(r.result, 'failure');
    assert.equal(readLog('codex', dir)[0].httpStatus, 503);
  });
});

test('one vendor failing does not stop the other being polled', async () => {
  await withTmp(async (dir) => {
    const f: Fetcher = async (url) => {
      if (url.includes('openai')) throw new Error('down');
      return { status: 200, body: CLAUDE };
    };
    const out = await pollAll(T0, f, dir);
    assert.equal(out.length, 2);
    assert.equal(out.find((o) => o.vendor === 'codex')!.result, 'failure');
    assert.equal(out.find((o) => o.vendor === 'claude-code')!.result, 'snapshot');
    assert.equal(currentState('claude-code', T0, dir).severity, 0);
  });
});

test('the Anthropic feed is configured at its RESOLVED host, and the divergence is recorded', () => {
  assert.equal(claudeFeed.url, 'https://status.claude.com/api/v2/summary.json');
  assert.equal(claudeFeed.specUrl, 'https://status.anthropic.com/api/v2/summary.json');
  assert.notEqual(claudeFeed.url, claudeFeed.specUrl, 'if these ever match, the spec was amended — update this test');
});

test('the store is append-only: polling never rewrites earlier log lines', async () => {
  await withTmp(async (dir) => {
    await pollFeed(codexFeed, T0, ok(OPENAI), dir);
    const first = readFileSync(join(dir, 'codex', 'log.ndjson'), 'utf8');
    await pollFeed(codexFeed, new Date(T0.getTime() + 600_000), ok(CLAUDE), dir);
    const second = readFileSync(join(dir, 'codex', 'log.ndjson'), 'utf8');
    assert.ok(second.startsWith(first), 'existing log content must be a prefix of the new log');
  });
});
