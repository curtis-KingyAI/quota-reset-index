#!/usr/bin/env node
/**
 * npm run validate — validate every record on disk.
 *
 * Exits 0 if the whole ledger is clean, 1 otherwise, printing file + field for
 * every problem found. Reports all errors rather than stopping at the first,
 * so a bad import can be fixed in one pass.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, validateEntries, formatErrors } from '../lib/validate-core.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEDGER = join(ROOT, 'ledger');
const SCHEMA = join(ROOT, 'schema', 'reset-event.schema.json');

export function collectEntries(ledgerDir = LEDGER) {
  const entries = [];
  if (!existsSync(ledgerDir)) return entries;
  for (const vendor of readdirSync(ledgerDir, { withFileTypes: true })) {
    if (!vendor.isDirectory()) continue;
    const dir = join(ledgerDir, vendor.name);
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.json')) continue;
      const abs = join(dir, f);
      entries.push({ path: relative(ROOT, abs), raw: readFileSync(abs, 'utf8') });
    }
  }
  return entries;
}

function main() {
  const entries = collectEntries();
  const { errors, records } = validateEntries(entries, loadSchema(SCHEMA));

  if (errors.length) {
    console.error(`\nFAIL — ${errors.length} problem${errors.length === 1 ? '' : 's'} in ${entries.length} record file${entries.length === 1 ? '' : 's'}:\n`);
    console.error(formatErrors(errors));
    console.error('');
    process.exit(1);
  }

  const live = records.filter((r) => r.superseded_by === null).length;
  console.log(
    `OK — ${records.length} record${records.length === 1 ? '' : 's'} valid ` +
      `(${live} current, ${records.length - live} superseded).`,
  );
}

if (isMain(import.meta.url)) main();
