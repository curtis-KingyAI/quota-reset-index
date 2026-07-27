/**
 * Where the X API bearer token comes from.
 *
 * ── WHY A FILE AS WELL AS AN ENV VAR ────────────────────────────────────────
 *
 * The env var alone has a failure mode this project has already been bitten by in
 * another form: **a shell-profile export is invisible to launchd.** If the poller is
 * ever scheduled the way `scripts/weekly-check.sh` is, an env-var-only token means
 * the job runs, finds no credential, reports "inert", and costs nothing — silently,
 * every week, looking exactly like "the accounts were quiet". A mode-600 file in the
 * operator's home directory is readable by a scheduled job and by an interactive
 * shell alike.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
 *
 * It never logs, prints, returns-for-display or writes the token anywhere. Callers
 * get the value to put in one `Authorization` header and nothing else. `describe()`
 * on the provider reports only PRESENCE, never content, and `source()` below exists
 * so the operator can confirm their setup works **without ever showing the secret to
 * an agent** — which is the point: an agent should be able to verify the plumbing
 * and remain unable to read the credential.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const TOKEN_FILE = join(homedir(), '.quota-reset-index', 'x-token');

/**
 * Read the token, or null.
 *
 * Order: environment first (explicit beats ambient, and makes one-off overrides
 * obvious), then the file.
 */
export function readXToken({ file = TOKEN_FILE, env = process.env } = {}) {
  const fromEnv = env.QRI_X_BEARER_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  if (!existsSync(file)) return null;
  if (!isPrivate(file)) return null; // refused — see source() for the reason shown
  const contents = readFileSync(file, 'utf8').trim();
  return contents || null;
}

/**
 * Is the file readable only by its owner?
 *
 * ⚠️ A token file that group or others can read is worse than no token file,
 * because it looks secure. Refused rather than warned: a warning on a credential is
 * a message someone scrolls past.
 */
export function isPrivate(file) {
  try {
    return (statSync(file).mode & 0o077) === 0;
  } catch {
    return false;
  }
}

/**
 * Where the token came from, and why it is missing when it is — WITHOUT the value.
 *
 * This is what the operator runs to check their own setup. It must stay incapable of
 * revealing the secret: it returns a source name and a length, never content.
 */
export function xTokenSource({ file = TOKEN_FILE, env = process.env } = {}) {
  const fromEnv = env.QRI_X_BEARER_TOKEN?.trim();
  if (fromEnv) return { present: true, source: 'QRI_X_BEARER_TOKEN', length: fromEnv.length, note: null };

  if (!existsSync(file)) {
    return {
      present: false,
      source: null,
      length: 0,
      note: `no QRI_X_BEARER_TOKEN in the environment and no file at ${file}`,
    };
  }
  if (!isPrivate(file)) {
    return {
      present: false,
      source: null,
      length: 0,
      note: `${file} is readable by group or others — REFUSED. Fix with: chmod 600 ${file}`,
    };
  }
  const contents = readFileSync(file, 'utf8').trim();
  if (!contents) return { present: false, source: null, length: 0, note: `${file} exists but is empty` };
  return { present: true, source: file, length: contents.length, note: null };
}
