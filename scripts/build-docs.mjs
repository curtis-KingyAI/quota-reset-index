#!/usr/bin/env node
/**
 * npm run build:docs — regenerate the figure blocks in README.md and docs/STATUS.md.
 *
 * Runs as part of `npm run build`, so CI's dirty-tree check turns a stale count into
 * a build failure. That is the whole mechanism: no new enforcement, just the
 * existing "the tree must be reproducible" guarantee extended past `public/`.
 *
 * ⚠️ EDIT THE BLOCKS AND THE BUILD WILL OVERWRITE YOU. Content between the markers
 * belongs to `lib/stats.mjs`. Everything outside them is yours.
 *
 *   <!-- generated:readme-stats -->
 *   ...replaced on every build...
 *   <!-- /generated:readme-stats -->
 *
 * Idempotent by construction — the markers survive the substitution, so running it
 * twice produces identical bytes. A test asserts that, because a generator that is
 * not idempotent makes the reproducibility check flap instead of catching drift.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReadmeStats, renderStatusStats, stats } from '../lib/stats.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Which block goes where. Adding a target is a line here plus markers in the file. */
export const TARGETS = [
  { file: 'README.md', id: 'readme-stats', render: renderReadmeStats },
  { file: 'docs/STATUS.md', id: 'status-stats', render: renderStatusStats },
];

const open = (id) => `<!-- generated:${id} -->`;
const close = (id) => `<!-- /generated:${id} -->`;

/**
 * Replace one marked block. Returns the new text.
 *
 * Throws when a marker is missing rather than appending or silently doing nothing:
 * a generator that quietly writes nowhere is exactly the failure this replaces.
 */
export function replaceBlock(text, id, body) {
  const a = text.indexOf(open(id));
  const b = text.indexOf(close(id));
  if (a === -1 || b === -1) throw new Error(`missing markers for "${id}" — expected ${open(id)} … ${close(id)}`);
  if (b < a) throw new Error(`markers for "${id}" are inverted`);
  return text.slice(0, a) + open(id) + '\n' + body + '\n' + text.slice(b);
}

export function buildDocs({ write = true } = {}) {
  const s = stats();
  const results = [];
  for (const t of TARGETS) {
    const path = join(ROOT, t.file);
    const before = readFileSync(path, 'utf8');
    const after = replaceBlock(before, t.id, t.render(s));
    if (write && after !== before) writeFileSync(path, after);
    results.push({ file: t.file, changed: after !== before });
  }
  return { stats: s, results };
}

function main() {
  const { stats: s, results } = buildDocs();
  const changed = results.filter((r) => r.changed);
  console.log(
    `built docs — ${s.records.total} records, ${s.evidence.items} evidence items, ${s.tests} tests` +
      (changed.length ? ` (updated ${changed.map((c) => c.file).join(', ')})` : ' (already current)'),
  );
}

if (isMain(import.meta.url)) main();
