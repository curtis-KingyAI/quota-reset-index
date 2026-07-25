#!/usr/bin/env node
/**
 * npm run build:ledger — regenerate public/ledger.json and public/ledger.csv
 * from the flat files. Never hand-edit the outputs.
 *
 * Determinism (spec §4.4): same inputs => byte-identical outputs. That rules out
 * timestamps, hostnames, run counters, object-key iteration order, and
 * locale-dependent formatting anywhere in the emitted bytes. The only thing
 * that changes the output is a change to ledger/.
 *
 * Validation runs first. A ledger that does not validate does not get published.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, validateEntries, formatErrors } from '../lib/validate-core.mjs';
import { canonicalRecord, compareRecords } from '../lib/canonical.mjs';
import { collectEntries } from './validate.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public');
const SCHEMA = join(ROOT, 'schema', 'reset-event.schema.json');

/**
 * CSV columns. One row per event. Evidence is multi-valued, so it is emitted as
 * five parallel pipe-joined columns sharing an index order — evidence_types[2]
 * belongs with evidence_urls[2]. That keeps the file genuinely flat while
 * preserving the pairing, so a reader can reconstruct the JSON from the CSV.
 */
const COLUMNS = [
  'id',
  'vendor',
  'kind',
  'effective_at',
  'effective_at_precision',
  'observed_at',
  'scope_windows',
  'scope_plans',
  'scope_partial',
  'scope_notes',
  'trigger',
  'confidence',
  'evidence_count',
  'evidence_types',
  'evidence_urls',
  'evidence_authors',
  'evidence_captured_at',
  'evidence_archive_urls',
  'recorded_by',
  'superseded_by',
  'notes',
];

const JOIN = ' | ';

/** RFC 4180: quote if the value contains a comma, quote, CR or LF; double inner quotes. */
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(rec) {
  const ev = rec.evidence;
  return {
    id: rec.id,
    vendor: rec.vendor,
    kind: rec.kind,
    effective_at: rec.effective_at,
    effective_at_precision: rec.effective_at_precision,
    observed_at: rec.observed_at,
    scope_windows: rec.scope.windows.join(JOIN),
    scope_plans: rec.scope.plans.join(JOIN),
    scope_partial: String(rec.scope.partial),
    scope_notes: rec.scope.notes,
    trigger: rec.trigger,
    confidence: rec.confidence,
    evidence_count: String(ev.length),
    evidence_types: ev.map((e) => e.type).join(JOIN),
    evidence_urls: ev.map((e) => e.url).join(JOIN),
    evidence_authors: ev.map((e) => e.author ?? '').join(JOIN),
    evidence_captured_at: ev.map((e) => e.captured_at).join(JOIN),
    evidence_archive_urls: ev.map((e) => e.archive_url ?? '').join(JOIN),
    recorded_by: rec.recorded_by,
    superseded_by: rec.superseded_by ?? '',
    notes: rec.notes,
  };
}

export function buildOutputs(records) {
  const sorted = records.slice().sort(compareRecords).map(canonicalRecord);
  const json = JSON.stringify(sorted, null, 2) + '\n';
  const lines = [COLUMNS.join(',')];
  for (const rec of sorted) {
    const row = csvRow(rec);
    lines.push(COLUMNS.map((c) => csvCell(row[c])).join(','));
  }
  return { json, csv: lines.join('\n') + '\n', count: sorted.length };
}

function main() {
  const entries = collectEntries();
  const { errors, records } = validateEntries(entries, loadSchema(SCHEMA));
  if (errors.length) {
    console.error(`\nREFUSING TO BUILD — ${errors.length} validation problem${errors.length === 1 ? '' : 's'}:\n`);
    console.error(formatErrors(errors));
    console.error('');
    process.exit(1);
  }

  const { json, csv, count } = buildOutputs(records);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'ledger.json'), json);
  writeFileSync(join(OUT, 'ledger.csv'), csv);
  console.log(`built public/ledger.json and public/ledger.csv — ${count} record${count === 1 ? '' : 's'}`);
}

if (isMain(import.meta.url)) main();
