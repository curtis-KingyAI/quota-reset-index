/**
 * Spec §4.5 acceptance criteria, one test each, plus the invariants from §4.2.
 *
 *   1. `npm run validate` passes on every seeded record
 *   2. Deliberately corrupting one record fails validation with a message
 *      naming the file and the field
 *   3. Attempting to edit a sealed record's effective_at is rejected by the
 *      commit hook
 *   4. `build:ledger` run twice produces identical bytes
 *
 * Tests 2 and 3 run against a disposable git repo in the OS temp dir so that
 * proving the hook works never involves corrupting the real ledger.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { loadSchema, validateEntries } from '../lib/validate-core.mjs';
import { buildOutputs } from '../scripts/build-ledger.mjs';
import { collectEntries } from '../scripts/validate.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCHEMA = loadSchema(join(ROOT, 'schema', 'reset-event.schema.json'));

/** A minimal record that satisfies every invariant. Tests mutate copies of it. */
const FIXTURE = {
  id: 'cx-2026-01-01-01',
  vendor: 'codex',
  kind: 'global_reset',
  effective_at: '2026-01-01T12:00:00Z',
  effective_at_precision: 'hour',
  observed_at: '2026-01-01T13:00:00Z',
  scope: { windows: ['weekly'], plans: ['plus'], partial: false, notes: '' },
  trigger: 'courtesy',
  confidence: 'confirmed',
  evidence: [
    {
      type: 'vendor_post',
      url: 'https://example.invalid/post',
      author: null,
      captured_at: '2026-01-01T13:00:00Z',
      archive_url: null,
    },
  ],
  recorded_by: 'test',
  superseded_by: null,
  notes: '',
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const entry = (rec, path = `ledger/${rec.vendor}/${rec.id}.json`) => ({ path, raw: JSON.stringify(rec, null, 2) + '\n' });
const check = (recs) => validateEntries(recs.map((r) => entry(r)), SCHEMA).errors;

/** Disposable repo carrying the real scripts, so hook behaviour is the real behaviour. */
function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'qri-hook-'));
  for (const d of ['lib', 'scripts', 'schema', '.githooks']) cpSync(join(ROOT, d), join(dir, d), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(dir, 'package.json'));
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
  mkdirSync(join(dir, 'ledger', 'codex'), { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  return { dir, git };
}

/** Run the hook. Returns {ok, output} rather than throwing, so tests can assert on rejection. */
function runHook(dir) {
  try {
    return { ok: true, output: execFileSync('node', [join(dir, 'scripts', 'check-append-only.mjs')], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, output: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

// ---------------------------------------------------------------- §4.5 (1)
test('§4.5.1 — the committed ledger validates clean', () => {
  const entries = collectEntries();
  const { errors } = validateEntries(entries, SCHEMA);
  assert.deepEqual(errors, [], `ledger has validation errors:\n${JSON.stringify(errors, null, 2)}`);
});

// ---------------------------------------------------------------- §4.5 (2)
test('§4.5.2 — a corrupted record fails, naming the file and the field', () => {
  const bad = clone(FIXTURE);
  bad.confidence = 'very-sure'; // not in the closed enum
  const errors = check([bad]);

  assert.ok(errors.length > 0, 'expected at least one error');
  const e = errors.find((x) => x.field === 'confidence');
  assert.ok(e, `no error named the "confidence" field; got ${JSON.stringify(errors)}`);
  assert.equal(e.file, 'ledger/codex/cx-2026-01-01-01.json');
  assert.match(e.message, /allowed: confirmed, probable, reported/);
});

test('§4.5.2 — malformed JSON is reported against its file, not thrown', () => {
  const { errors } = validateEntries([{ path: 'ledger/codex/cx-2026-01-01-01.json', raw: '{ nope' }], SCHEMA);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].file, 'ledger/codex/cx-2026-01-01-01.json');
  assert.match(errors[0].message, /not valid JSON/);
});

// ---------------------------------------------------------------- §4.2 invariants
test('§4.2 — a record with no evidence does not exist', () => {
  const bad = clone(FIXTURE);
  bad.evidence = [];
  const errors = check([bad]);
  assert.ok(errors.some((e) => e.field === 'evidence'), JSON.stringify(errors));
});

test('§4.2 — confirmed requires vendor_post, status_page or telemetry', () => {
  const bad = clone(FIXTURE);
  bad.evidence[0].type = 'user_report';
  const errors = check([bad]);
  const e = errors.find((x) => x.field === 'confidence');
  assert.ok(e, JSON.stringify(errors));
  assert.match(e.message, /requires at least one evidence item/);

  // ...and the same record downgraded to "reported" is fine.
  const ok = clone(bad);
  ok.confidence = 'reported';
  assert.deepEqual(check([ok]), []);
});

test('§4.2 — observed_at may not precede effective_at', () => {
  const bad = clone(FIXTURE);
  bad.observed_at = '2026-01-01T11:00:00Z';
  const errors = check([bad]);
  assert.ok(errors.some((e) => e.field === 'observed_at' && /before effective_at/.test(e.message)), JSON.stringify(errors));
});

test('§4.2 — superseded_by must point at a record that exists', () => {
  const dangling = clone(FIXTURE);
  dangling.superseded_by = 'cx-2026-02-02-01';
  assert.ok(check([dangling]).some((e) => e.field === 'superseded_by'));

  const target = clone(FIXTURE);
  target.id = 'cx-2026-02-02-01';
  target.effective_at = '2026-02-02T12:00:00Z';
  target.observed_at = '2026-02-02T13:00:00Z';
  target.evidence[0].captured_at = '2026-02-02T13:00:00Z';
  assert.deepEqual(check([dangling, target]), []);
});

test('§4.2 — supersede cycles are rejected', () => {
  const a = clone(FIXTURE);
  const b = clone(FIXTURE);
  b.id = 'cx-2026-02-02-01';
  b.effective_at = '2026-02-02T12:00:00Z';
  b.observed_at = '2026-02-02T13:00:00Z';
  b.evidence[0].captured_at = '2026-02-02T13:00:00Z';
  a.superseded_by = b.id;
  b.superseded_by = a.id;
  assert.ok(check([a, b]).some((e) => /cycle/.test(e.message)));
});

test('§4.1 — id must agree with filename, directory and effective_at', () => {
  const rec = clone(FIXTURE);
  assert.ok(validateEntries([entry(rec, 'ledger/codex/cx-2026-09-09-01.json')], SCHEMA).errors.some((e) => /filename stem/.test(e.message)));
  assert.ok(validateEntries([entry(rec, 'ledger/claude-code/cx-2026-01-01-01.json')], SCHEMA).errors.some((e) => /does not match directory/.test(e.message)));

  const wrongDate = clone(FIXTURE);
  wrongDate.id = 'cx-2026-03-03-01';
  assert.ok(validateEntries([entry(wrongDate, 'ledger/codex/cx-2026-03-03-01.json')], SCHEMA).errors.some((e) => /does not match effective_at date/.test(e.message)));

  const wrongPrefix = clone(FIXTURE);
  wrongPrefix.vendor = 'claude-code';
  assert.ok(validateEntries([entry(wrongPrefix, 'ledger/claude-code/cx-2026-01-01-01.json')], SCHEMA).errors.some((e) => /requires id prefix/.test(e.message)));
});

test('duplicate ids are rejected', () => {
  assert.ok(check([clone(FIXTURE), clone(FIXTURE)]).some((e) => /duplicate id/.test(e.message)));
});

// ---------------------------------------------------------------- §4.5 (3)
test('§4.5.3 — the commit hook rejects an edit to a sealed effective_at', () => {
  const { dir, git } = makeTempRepo();
  try {
    const file = join(dir, 'ledger', 'codex', 'cx-2026-01-01-01.json');
    writeFileSync(file, JSON.stringify(FIXTURE, null, 2) + '\n');
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'seed');

    // Sanity: an untouched tree passes.
    assert.equal(runHook(dir).ok, true, 'hook should pass on an unmodified tree');

    const edited = clone(FIXTURE);
    edited.effective_at = '2026-01-01T18:00:00Z';
    writeFileSync(file, JSON.stringify(edited, null, 2) + '\n');
    git('add', '-A');

    const res = runHook(dir);
    assert.equal(res.ok, false, 'hook should have rejected the edit');
    assert.match(res.output, /SEALED FIELD MODIFIED/);
    assert.match(res.output, /effective_at/);
    assert.match(res.output, /cx-2026-01-01-01\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('§4.5.3 — the hook permits setting superseded_by, and permits new records', () => {
  const { dir, git } = makeTempRepo();
  try {
    const file = join(dir, 'ledger', 'codex', 'cx-2026-01-01-01.json');
    writeFileSync(file, JSON.stringify(FIXTURE, null, 2) + '\n');
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'seed');

    const correction = clone(FIXTURE);
    correction.id = 'cx-2026-01-01-02';
    writeFileSync(join(dir, 'ledger', 'codex', 'cx-2026-01-01-02.json'), JSON.stringify(correction, null, 2) + '\n');

    const superseded = clone(FIXTURE);
    superseded.superseded_by = correction.id;
    writeFileSync(file, JSON.stringify(superseded, null, 2) + '\n');
    git('add', '-A');

    const res = runHook(dir);
    assert.equal(res.ok, true, `hook should allow a correction:\n${res.output}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('§2 — the hook rejects deleting a record', () => {
  const { dir, git } = makeTempRepo();
  try {
    const file = join(dir, 'ledger', 'codex', 'cx-2026-01-01-01.json');
    writeFileSync(file, JSON.stringify(FIXTURE, null, 2) + '\n');
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'seed');

    rmSync(file);
    git('add', '-A');

    const res = runHook(dir);
    assert.equal(res.ok, false, 'hook should have rejected the deletion');
    assert.match(res.output, /DELETION REJECTED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('regression — the hook actually executes when the repo sits on a symlinked path', () => {
  // mkdtemp hands back /var/folders/... which is a symlink to /private/var/folders/...
  // With a naive `process.argv[1] === fileURLToPath(import.meta.url)` guard, main()
  // never runs and the hook exits 0 having checked NOTHING. See lib/is-main.mjs.
  // If this test ever fails, the append-only gate has become a no-op.
  const { dir, git } = makeTempRepo();
  try {
    writeFileSync(join(dir, 'ledger', 'codex', 'cx-2026-01-01-01.json'), JSON.stringify(FIXTURE, null, 2) + '\n');
    git('add', '-A');
    const res = runHook(dir);
    assert.match(res.output, /append-only check passed \(1 record staged\)/, `hook produced no output — it did not run:\n${JSON.stringify(res)}`);
    assert.notEqual(realpathSync(dir), dir, 'this test is only meaningful on a symlinked temp path');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- §4.5 (4)
test('§4.5.4 — build:ledger is deterministic (byte-identical across runs)', () => {
  const a = execFileSync('node', [join(ROOT, 'scripts', 'build-ledger.mjs')], { cwd: ROOT, encoding: 'utf8' });
  const json1 = readFileSync(join(ROOT, 'public', 'ledger.json'));
  const csv1 = readFileSync(join(ROOT, 'public', 'ledger.csv'));

  execFileSync('node', [join(ROOT, 'scripts', 'build-ledger.mjs')], { cwd: ROOT, encoding: 'utf8' });
  const json2 = readFileSync(join(ROOT, 'public', 'ledger.json'));
  const csv2 = readFileSync(join(ROOT, 'public', 'ledger.csv'));

  assert.ok(a.includes('built public/ledger.json'));
  assert.equal(Buffer.compare(json1, json2), 0, 'ledger.json differed between runs');
  assert.equal(Buffer.compare(csv1, csv2), 0, 'ledger.csv differed between runs');
});

test('§4.5.4 — output order does not depend on input order', () => {
  const a = clone(FIXTURE);
  const b = clone(FIXTURE);
  b.id = 'cc-2025-12-31-01';
  b.vendor = 'claude-code';
  b.effective_at = '2025-12-31T12:00:00Z';
  b.observed_at = '2025-12-31T13:00:00Z';
  b.evidence[0].captured_at = '2025-12-31T13:00:00Z';

  const forward = buildOutputs([a, b]);
  const reverse = buildOutputs([b, a]);
  assert.equal(forward.json, reverse.json);
  assert.equal(forward.csv, reverse.csv);
  // ...and it is chronological, not insertion order.
  assert.ok(forward.json.indexOf('cc-2025-12-31-01') < forward.json.indexOf('cx-2026-01-01-01'));
});

test('CSV quotes commas and newlines rather than corrupting the row', () => {
  const rec = clone(FIXTURE);
  rec.notes = 'has, a comma and a "quote"';
  rec.scope.notes = 'line one\nline two';
  const { csv } = buildOutputs([rec]);
  assert.match(csv, /"has, a comma and a ""quote"""/);
  assert.match(csv, /"line one\nline two"/);
  assert.equal(csv.split('\n')[0].split(',').length, 21, 'header column count changed — update the test and the docs');
});
