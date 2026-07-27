#!/usr/bin/env node
/**
 * Pre-commit gate. Two jobs:
 *
 *   1. Validate every ledger record *as staged* (not as it sits in the working
 *      tree — those can differ, and the commit is what gets published).
 *   2. Enforce append-only: a commit may add records and may set superseded_by.
 *      It may not modify any other non-null field of an existing record, and it
 *      may not delete or rename one.
 *
 * The git history is the audit trail (spec §4.1). If records can be quietly
 * rewritten, the history proves nothing, so this hook is the load-bearing part
 * of the whole trust argument.
 *
 * Escape hatch: none. If a record is wrong, supersede it.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, validateEntries, formatErrors } from '../lib/validate-core.mjs';
import { stableKey } from '../lib/canonical.mjs';
import { truncatedFields, truncationMessage } from '../lib/truncation.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCHEMA = join(ROOT, 'schema', 'reset-event.schema.json');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const gitOrNull = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

function hasHead() {
  return gitOrNull('rev-parse', '--verify', 'HEAD') !== null;
}

/** Every ledger record in the index, read from the staged blob. */
function stagedEntries() {
  const listed = git('ls-files', '--cached', '--', 'ledger/').trim();
  if (!listed) return [];
  return listed
    .split('\n')
    .filter((p) => p.endsWith('.json'))
    .sort()
    .map((path) => ({ path, raw: git('show', `:${path}`) }));
}

function main() {
  const problems = [];

  // ---- 1. staged records must validate ----
  const entries = stagedEntries();
  const { errors } = validateEntries(entries, loadSchema(SCHEMA));
  if (errors.length) {
    problems.push(
      `${errors.length} validation problem${errors.length === 1 ? '' : 's'} in the staged ledger:\n\n${formatErrors(errors)}`,
    );
  }

  // ---- 2. append-only ----
  if (hasHead()) {
    const status = git('diff', '--cached', '--name-status', '--find-renames', 'HEAD', '--', 'ledger/').trim();
    for (const line of status ? status.split('\n') : []) {
      const parts = line.split('\t');
      const code = parts[0];

      if (code.startsWith('D')) {
        problems.push(
          `DELETION REJECTED: ${parts[1]}\n    Ledger records are never deleted. If it is wrong, add a new record and\n    point the old one at it with superseded_by.`,
        );
        continue;
      }

      if (code.startsWith('R')) {
        problems.push(
          `RENAME REJECTED: ${parts[1]} -> ${parts[2]}\n    The filename carries the record id. Renaming a record rewrites its identity.`,
        );
        continue;
      }

      // ---- 3. a NEW record may not ship prose that stops mid-sentence ----
      //
      // Additions are the point of the exercise, so they skip the append-only
      // checks — but they get this one. 65 fields across ~44 existing records were
      // silently truncated at write time (see lib/truncation.mjs); those are sealed
      // and unrepairable, which is exactly why the gate belongs here, where the
      // author can still finish the sentence.
      if (code.startsWith('A')) {
        const path = parts[1];
        try {
          const rec = JSON.parse(git('show', `:${path}`));
          for (const field of truncatedFields(rec)) {
            const value = field === 'notes' ? rec.notes : rec.scope?.notes;
            problems.push(truncationMessage(path, field, value));
          }
        } catch {
          /* unparseable: step 1 already reports it against this file */
        }
        continue;
      }

      if (!code.startsWith('M')) continue;

      const path = parts[1];
      let before, after;
      try {
        before = JSON.parse(git('show', `HEAD:${path}`));
        after = JSON.parse(git('show', `:${path}`));
      } catch (e) {
        problems.push(`MODIFICATION UNREADABLE: ${path}\n    ${e.message}`);
        continue;
      }

      // A PROVISIONAL record is explicitly unsealed (schema `status`, added
      // 2026-07-26). It marks an open question rather than asserting an answer,
      // so it may still be edited. Sealing is one-way: once the COMMITTED version
      // says "sealed" — or omits status, which every pre-2026-07-26 record does —
      // the seal applies and this exemption is gone.
      if (before.status === 'provisional') {
        if (after.status === 'provisional') {
          console.warn(`  note: ${path} is provisional and was edited (permitted until it is sealed)`);
          continue;
        }
        if (after.status === 'sealed') {
          console.warn(`  note: ${path} promoted provisional -> sealed; it is now append-only`);
          continue;
        }
        problems.push(
          `INVALID PROMOTION: ${path}\n    status went "provisional" -> ${JSON.stringify(after.status)}\n` +
            `    A provisional record may only stay provisional or become sealed.`,
        );
        continue;
      }

      if (after.status === 'provisional' && before.status !== 'provisional') {
        problems.push(
          `UNSEALING REJECTED: ${path}\n    A sealed record cannot be made provisional.\n` +
            `    If it is wrong, add a new record and point this one at it with superseded_by.`,
        );
        continue;
      }

      for (const field of Object.keys(before)) {
        if (field === 'superseded_by') continue; // the one mutable field
        if (before[field] === null) continue; // sealed only once it holds a value

        if (!(field in after)) {
          problems.push(`SEALED FIELD REMOVED: ${path}\n    field: ${field}\n    was: ${stableKey(before[field])}`);
          continue;
        }
        if (stableKey(before[field]) !== stableKey(after[field])) {
          problems.push(
            `SEALED FIELD MODIFIED: ${path}\n    field: ${field}\n` +
              `    committed: ${stableKey(before[field])}\n` +
              `    staged:    ${stableKey(after[field])}\n` +
              `    Only superseded_by may change on an existing record.`,
          );
        }
      }

      // A field ADDED to a sealed record modifies no existing non-null field, so
      // the append-only rule as written permits it. It is still a material change
      // to a sealed record, and it must never happen silently.
      for (const field of Object.keys(after)) {
        if (field in before) continue;
        console.warn(
          `  ⚠️  ${path}: NEW FIELD "${field}" added to a SEALED record. Permitted by the\n` +
            `      append-only rule (it modifies no existing non-null field) but it changes what\n` +
            `      the record asserts. This must appear in an approved migration plan.`,
        );
      }

      // superseded_by is exempt by spec, but silently repointing an existing
      // correction is worth saying out loud even though it is allowed.
      if (before.superseded_by !== null && before.superseded_by !== after.superseded_by) {
        console.warn(
          `  warning: ${path} repoints superseded_by ` +
            `"${before.superseded_by}" -> "${after.superseded_by}" (permitted, but check it is deliberate)`,
        );
      }
    }
  }

  if (problems.length) {
    console.error(`\nCOMMIT REJECTED — ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`);
    for (const p of problems) console.error(`  ${p}\n`);
    process.exit(1);
  }

  console.log(`append-only check passed (${entries.length} record${entries.length === 1 ? '' : 's'} staged)`);
}

if (isMain(import.meta.url)) main();
