#!/usr/bin/env node
/**
 * Server-side append-only enforcement.
 *
 * Re-derives the append-only property from COMMITTED HISTORY, rather than
 * trusting that a pre-commit hook ran. `git commit --no-verify`, or a clone
 * where hooks were never installed, defeats the local hook entirely — this
 * check runs in CI where the author's local flags cannot reach it.
 *
 *   npm run check:history              every commit that ever touched ledger/
 *   npm run check:history -- <range>   e.g. origin/main..HEAD
 *
 * Exits non-zero on any blocking violation. Additions of new fields are
 * reported as warnings, matching the local hook.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { violations, BLOCKING } from '../lib/append-only.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const showOrNull = (ref, path) => {
  try {
    // stderr ignored deliberately: a file that did not exist at `ref` makes git
    // print "fatal: path ... exists on disk, but not in <sha>", which is the
    // EXPECTED case for every newly-added record. Letting it through would fill
    // CI logs with fatals next to an OK result — the worst possible signal.
    return JSON.parse(
      execFileSync('git', ['show', `${ref}:${path}`], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
  } catch {
    return null; // file did not exist at that ref
  }
};

export function checkRange(range) {
  // --reverse so violations are reported oldest-first, which reads as a story.
  const revArgs = ['rev-list', '--reverse', '--no-merges'];
  if (range) revArgs.push(range);
  else revArgs.push('HEAD');
  revArgs.push('--', 'ledger/');

  const commits = git(...revArgs).trim().split('\n').filter(Boolean);
  const found = [];

  for (const sha of commits) {
    const parents = git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1);
    if (parents.length === 0) continue; // root commit: everything in it is an addition

    const parent = parents[0];
    const status = git('diff', '--name-status', '--find-renames', parent, sha, '--', 'ledger/').trim();
    if (!status) continue;

    for (const line of status.split('\n')) {
      const parts = line.split('\t');
      const code = parts[0];
      const path = parts[1];
      if (!path?.endsWith('.json')) continue;

      const before = showOrNull(parent, path);
      const after = code.startsWith('D') ? null : showOrNull(sha, path);
      for (const v of violations(path, before, after, code)) {
        found.push({ sha: sha.slice(0, 8), subject: git('log', '-1', '--format=%s', sha).trim().slice(0, 60), ...v });
      }
    }
  }

  return { commits: commits.length, found };
}

function main() {
  const range = process.argv[2];
  console.log(`append-only history check${range ? ` (${range})` : ' (full history)'}\n`);

  const { commits, found } = checkRange(range);
  const blocking = found.filter((f) => BLOCKING.has(f.kind));
  const warnings = found.filter((f) => !BLOCKING.has(f.kind));

  for (const w of warnings) {
    console.warn(`  warning  ${w.sha}  ${w.path}\n           ${w.message}`);
  }
  if (warnings.length) console.warn('');

  if (blocking.length) {
    console.error(`APPEND-ONLY VIOLATED — ${blocking.length} across ${commits} commit(s):\n`);
    for (const v of blocking) {
      console.error(`  ${v.sha}  "${v.subject}"`);
      console.error(`    ${v.path}`);
      console.error(`    ${v.kind}: ${v.message}\n`);
    }
    console.error('History cannot be corrected by another commit — that is the point of the guarantee.');
    console.error('If a record is wrong, supersede it. If history is wrong, that is an incident.');
    process.exit(1);
  }

  console.log(`OK — ${commits} commit(s) touching ledger/, no sealed field ever modified.`);
}

if (isMain(import.meta.url)) main();
