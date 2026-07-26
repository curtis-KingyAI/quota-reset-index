/**
 * The append-only rule itself, in one place.
 *
 * Extracted 2026-07-26 so the pre-commit hook and the server-side history check
 * apply *identical* rules. Two implementations of this rule would eventually
 * disagree, and the one that disagreed in the permissive direction would be the
 * one nobody noticed.
 *
 * ⚠️ WHY A SERVER-SIDE CHECK EXISTS AT ALL. A pre-commit hook runs where the
 * author controls it. `git commit --no-verify`, or a clone where
 * `npm run hooks:install` was never run, bypasses it completely. For a ledger
 * whose entire value proposition is verifiability, enforcement that lives inside
 * the actor's own control is not enforcement — it is an honour system with a
 * script attached. The history check re-derives the property from committed
 * history, where a local flag cannot reach.
 */

import { stableKey } from './canonical.mjs';

/**
 * Compare two versions of one record and return every append-only violation.
 *
 * @param {string} path      repo-relative path, for the message
 * @param {object|null} before  the record as previously committed, or null if new
 * @param {object|null} after   the record now, or null if deleted
 * @param {string} status     git name-status letter: A, M, D, R…
 * @returns {{path:string, kind:string, message:string}[]}
 */
export function violations(path, before, after, status) {
  const out = [];
  const add = (kind, message) => out.push({ path, kind, message });

  if (status.startsWith('D')) {
    add('DELETION', 'ledger records are never deleted — supersede instead');
    return out;
  }
  if (status.startsWith('R')) {
    add('RENAME', 'the filename carries the record id; renaming rewrites identity');
    return out;
  }
  if (!status.startsWith('M') || !before || !after) return out;

  // A provisional record is explicitly unsealed and may still be edited.
  // Sealing is one-way.
  if (before.status === 'provisional') {
    if (after.status === 'provisional' || after.status === 'sealed') return out;
    add('INVALID_PROMOTION', `status went "provisional" -> ${JSON.stringify(after.status)}`);
    return out;
  }
  if (after.status === 'provisional' && before.status !== 'provisional') {
    add('UNSEALING', 'a sealed record cannot be made provisional again');
    return out;
  }

  for (const field of Object.keys(before)) {
    if (field === 'superseded_by') continue; // the one mutable field
    if (before[field] === null) continue; // sealed only once it holds a value

    if (!(field in after)) {
      add('FIELD_REMOVED', `sealed field "${field}" was removed`);
      continue;
    }
    if (stableKey(before[field]) !== stableKey(after[field])) {
      add(
        'FIELD_MODIFIED',
        `sealed field "${field}" changed\n      was: ${stableKey(before[field]).slice(0, 300)}\n      now: ${stableKey(after[field]).slice(0, 300)}`,
      );
    }
  }

  // Adding a field modifies no existing non-null value, so the rule permits it.
  // It is still material and must never be silent.
  const added = Object.keys(after).filter((f) => !(f in before));
  for (const field of added) {
    add('FIELD_ADDED', `new field "${field}" on a sealed record — permitted, but must be in an approved migration`);
  }

  return out;
}

/** Which violation kinds block, as opposed to warn. */
export const BLOCKING = new Set(['DELETION', 'RENAME', 'INVALID_PROMOTION', 'UNSEALING', 'FIELD_REMOVED', 'FIELD_MODIFIED']);
