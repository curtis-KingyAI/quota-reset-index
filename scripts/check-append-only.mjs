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

      if (!code.startsWith('M')) continue; // A / additions are the point of the exercise

      const path = parts[1];
      let before, after;
      try {
        before = JSON.parse(git('show', `HEAD:${path}`));
        after = JSON.parse(git('show', `:${path}`));
      } catch (e) {
        problems.push(`MODIFICATION UNREADABLE: ${path}\n    ${e.message}`);
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
