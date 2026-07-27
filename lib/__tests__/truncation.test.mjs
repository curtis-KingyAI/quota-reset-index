/**
 * Tests for the truncated-prose guard.
 *
 * The last two matter most: the guard must actually fire on the real defect (using
 * a genuine truncated record from the ledger), and it must NOT fire on prose that
 * merely mentions an ellipsis mid-sentence — a check that flags correct work is one
 * people route around.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { OBSERVED_CAPS, TRUNCATION_MARKERS, truncatedFields, truncationMessage } from '../truncation.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const rec = (notes, scopeNotes = '') => ({ notes, scope: { notes: scopeNotes } });

test('prose ending in an ellipsis is flagged', () => {
  assert.deepEqual(truncatedFields(rec('cut off here…')), ['notes']);
  assert.deepEqual(truncatedFields(rec('', 'also cut…')), ['scope.notes']);
  assert.deepEqual(truncatedFields(rec('a…', 'b…')), ['notes', 'scope.notes']);
});

test('three dots count too', () => {
  // A truncator without the character reaches for these.
  assert.deepEqual(truncatedFields(rec('cut off here...')), ['notes']);
});

test('trailing whitespace does not hide it', () => {
  assert.deepEqual(truncatedFields(rec('cut off here…   \n')), ['notes']);
});

test('complete prose passes, including prose that MENTIONS an ellipsis', () => {
  assert.deepEqual(truncatedFields(rec('A finished sentence.')), []);
  assert.deepEqual(
    truncatedFields(rec('The source reads "three resets…" and then stops, which we note here.')),
    [],
    'an ellipsis inside a quotation is not a truncated field',
  );
  assert.deepEqual(truncatedFields(rec('')), [], 'an empty note is not truncated');
});

test('junk input does not throw', () => {
  for (const bad of [null, undefined, 42, 'string', {}]) {
    assert.deepEqual(truncatedFields(bad), [], `must tolerate ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(truncatedFields({ notes: null, scope: null }), []);
});

test('the guard fires on a REAL truncated record from the ledger', () => {
  // Not a synthetic fixture: this is the record that started the investigation. If
  // this stops failing, either the record was repaired (impossible — it is sealed)
  // or the detector broke.
  const real = JSON.parse(readFileSync(join(ROOT, 'ledger/codex/cx-2026-06-28-02.json'), 'utf8'));
  assert.deepEqual(truncatedFields(real), ['notes']);
  assert.ok(real.notes.length > 1000, 'and it sits near the 1200 cap');
});

test('the guard does NOT fire on the record that superseded it', () => {
  // cx-2026-06-28-03 was written after the defect was understood. If the guard
  // flagged it, the guard would be unsatisfiable in practice.
  const fixed = JSON.parse(readFileSync(join(ROOT, 'ledger/codex/cx-2026-06-28-03.json'), 'utf8'));
  assert.deepEqual(truncatedFields(fixed), []);
});

test('the message names the field, the length, and the cap when it is near one', () => {
  const value = 'x'.repeat(1195) + '…';
  const msg = truncationMessage('ledger/codex/cx-2026-01-01-01.json', 'notes', value);
  assert.match(msg, /TRUNCATED PROSE/);
  assert.match(msg, /field: notes/);
  assert.match(msg, new RegExp(String(value.length)));
  assert.match(msg, new RegExp(`historical ${OBSERVED_CAPS.notes} cap`), 'a near-cap length is the diagnosis');
  assert.match(msg, /Do not add the 66th/);
});

test('a short truncated note is still flagged, without claiming a cap', () => {
  const msg = truncationMessage('x.json', 'notes', 'tiny…');
  assert.match(msg, /TRUNCATED PROSE/);
  assert.ok(!/historical/.test(msg), 'must not invent a cap explanation for a short field');
});

test('the marker list is what the survey actually found', () => {
  assert.ok(TRUNCATION_MARKERS.includes('…'));
  assert.equal(OBSERVED_CAPS['scope.notes'], 700);
  assert.equal(OBSERVED_CAPS.notes, 1200);
});
