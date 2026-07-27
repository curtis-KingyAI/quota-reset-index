/**
 * Tests for the generated figure blocks.
 *
 * The load-bearing ones are idempotence, the drift check, and the exclusion of
 * anything that changes without a source change. A generator that is not idempotent
 * makes CI's reproducibility check FLAP rather than catch drift — which would be
 * worse than the hand-maintained counts it replaces, because a flapping check gets
 * disabled.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countTests, renderReadmeStats, renderStatusStats, stats } from '../stats.mjs';
import { TARGETS, buildDocs, replaceBlock } from '../../scripts/build-docs.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

// ------------------------------------------------------------------ derivation
test('every figure is derived from the committed tree', () => {
  const s = stats();
  assert.equal(s.records.current + s.records.superseded, s.records.total);
  assert.equal(s.vendors.codex.total + s.vendors['claude-code'].total, s.records.total);
  assert.ok(s.evidence.archivedItems <= s.evidence.items);
  assert.ok(s.evidence.uniqueUrls <= s.evidence.items, 'unique URLs cannot exceed evidence items');
  assert.ok(s.span.earliest <= s.span.latest);
  assert.ok(s.tests > 0);
});

test('the test count matches what the suite actually declares', () => {
  // Counted statically because running the suite from the build would be circular.
  // This asserts the counter finds the files rather than silently globbing nothing —
  // a count of 0 would render as "0 tests" and look like a deliberate claim.
  const { count, files } = countTests();
  assert.ok(files >= 7, `expected the test globs to resolve; got ${files} files`);
  assert.ok(count >= 150, `suspiciously low test count: ${count}`);
});

test('archive percentages round DOWN, never flatteringly', () => {
  const s = stats();
  const exact = (s.evidence.archivedItems / s.evidence.items) * 100;
  assert.ok(Number(s.evidence.itemsPct) <= exact + 1e-9, 'must not round up');
  assert.ok(exact - Number(s.evidence.itemsPct) < 0.1, 'but must stay accurate to a decimal place');
});

// ------------------------------------------------------------------ the blocks
test('rendering is idempotent — the same stats produce the same bytes', () => {
  const s = stats();
  assert.equal(renderReadmeStats(s), renderReadmeStats(s));
  assert.equal(renderStatusStats(s), renderStatusStats(s));
});

test('substitution is idempotent — applying it twice is applying it once', () => {
  // ⚠️ REWRITTEN. This used to call buildDocs({write:false}) twice and assert the
  // second reported no change — but with write:false nothing is ever written, so
  // both passes report the same thing and the test could only ever restate the
  // drift check below. It tested nothing about idempotence.
  //
  // This tests the actual property: substituting into already-substituted text is a
  // no-op. If it were not, CI's reproducibility check would flap on every run and
  // someone would eventually delete it — worse than the counts it replaced.
  const text = 'BEFORE\n<!-- generated:x -->\nstale\n<!-- /generated:x -->\nAFTER';
  const once = replaceBlock(text, 'x', 'fresh body');
  const twice = replaceBlock(once, 'x', 'fresh body');
  assert.equal(twice, once, 'a second substitution changed the text');

  // And for real: the rendered blocks are pure functions of the stats.
  const s = stats();
  for (const t of TARGETS) {
    const body = t.render(s);
    const a = replaceBlock(readFileSync(join(ROOT, t.file), 'utf8'), t.id, body);
    assert.equal(replaceBlock(a, t.id, body), a, `${t.file} substitution is not idempotent`);
  }
});

test('the committed docs are CURRENT — this is the drift check', () => {
  // The whole point. If a figure was edited by hand, or the ledger changed without
  // a rebuild, this fails here as well as in CI.
  for (const r of buildDocs({ write: false }).results) {
    assert.equal(r.changed, false, `${r.file} is stale — run \`npm run build\` and commit`);
  }
});

test('every target file actually carries its markers', () => {
  for (const t of TARGETS) {
    const text = readFileSync(join(ROOT, t.file), 'utf8');
    assert.ok(text.includes(`<!-- generated:${t.id} -->`), `${t.file} is missing its opening marker`);
    assert.ok(text.includes(`<!-- /generated:${t.id} -->`), `${t.file} is missing its closing marker`);
  }
});

test('a missing marker throws rather than silently writing nowhere', () => {
  assert.throws(() => replaceBlock('no markers here', 'readme-stats', 'x'), /missing markers/);
  assert.throws(
    () => replaceBlock('<!-- /generated:x -->\n<!-- generated:x -->', 'x', 'body'),
    /inverted/,
    'inverted markers must be caught, not silently produce a mangled file',
  );
});

test('replaceBlock preserves everything outside the markers', () => {
  const text = 'BEFORE\n<!-- generated:x -->\nold\n<!-- /generated:x -->\nAFTER';
  const out = replaceBlock(text, 'x', 'new');
  assert.ok(out.startsWith('BEFORE\n'));
  assert.ok(out.endsWith('\nAFTER'));
  assert.ok(out.includes('new'));
  assert.ok(!out.includes('old'));
});

// ------------------------------------------------------------------ the exclusion
test('NOTHING that changes without a source change may be generated', () => {
  // The trap: `git rev-list --count HEAD` increments on the very commit that writes
  // it, so a block containing it could never be reproducible and the tree could
  // never be clean after a build. Same for timestamps and run counters.
  const rendered = renderReadmeStats() + renderStatusStats();
  assert.ok(!/[Cc]ommits/.test(rendered), 'commit count must not appear — it can never be reproducible');
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(rendered), 'no wall-clock timestamps in a generated block');
  // COMMENTS STRIPPED FIRST. An earlier version grepped the raw source and failed on
  // stats.mjs's own comment explaining why `rev-list` is excluded — the same
  // fires-on-documentation defect the capture/ isolation test had. A check that
  // flags its own rationale trains you to weaken it.
  const src = readFileSync(join(ROOT, 'lib/stats.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/rev-list/.test(src), 'stats.mjs must not read the commit log');
  assert.ok(!/Date\.now\(|new Date\(/.test(src), 'stats.mjs must not read the clock');
  assert.ok(!/child_process/.test(src), 'stats.mjs must not shell out — its inputs are files');
});
