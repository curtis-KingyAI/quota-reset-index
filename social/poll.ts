#!/usr/bin/env node
/**
 * Poll the tracked accounts and append what was seen. LOG-ONLY.
 *
 * Nothing here feeds a rendered forecast. That is the operator decision of
 * 2026-07-27 and the reason is in `provider.ts`: `tibo` carries the highest weight
 * in either model (1.45) and has never fired, so wiring it straight through would
 * hand the biggest lever on the page to an unvalidated prior driven by a term
 * matcher. The signal is collected so it can eventually be fitted against
 * outcomes; until there is a labelled sample it moves nothing.
 *
 * Usage:
 *   node social/poll.ts                 poll every tracked handle, append to the log
 *   node social/poll.ts --dry-run       resolve providers and print, write nothing
 *   node social/poll.ts --explain       print the classifier's term list and exit
 *   node social/poll.ts --show          print what has been collected so far
 *
 * Costs nothing and does nothing without QRI_X_BEARER_TOKEN. That is the default.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { appendLine, readLines } from '../lib/jsonl.mjs';
import { isMain } from '../lib/is-main.mjs';
import { explainTerms } from './classify.ts';
import { TOKEN_FILE, xTokenSource } from '../lib/x-token.mjs';
import { TRACKED_HANDLES, XApiProvider } from './x-api.ts';
import { resolveSocialSignal, type SocialReading } from './provider.ts';

/**
 * Outside the repository, like the quota observations and for the same reason:
 * this is collected material, not evidence, and it should not be committable by
 * accident. Override with QRI_SOCIAL_LOG.
 */
export const DEFAULT_LOG = join(homedir(), '.quota-reset-index', 'social.jsonl');
export const logPath = () => process.env.QRI_SOCIAL_LOG || DEFAULT_LOG;

/** Per-handle cursor: the last post id seen, and the cached numeric user id. */
const cursorPath = () => join(dirname(logPath()), 'social-cursor.json');

export function readCursor(): Record<string, { sinceId?: string; userId?: string }> {
  try {
    if (existsSync(cursorPath())) return JSON.parse(readFileSync(cursorPath(), 'utf8'));
  } catch {
    /* a corrupt cursor costs one redundant poll, not a crash */
  }
  return {};
}

function writeCursor(cursor: Record<string, { sinceId?: string; userId?: string }>): void {
  try {
    writeFileSync(cursorPath(), JSON.stringify(cursor, null, 2) + '\n');
  } catch {
    /* losing the cursor costs money, not correctness — but never a crash */
  }
}

/**
 * The stored line.
 *
 * ⚠️ POST TEXT IS DELIBERATELY NOT STORED. Two reasons, and the second is the one
 * that matters: X's terms restrict redisplay of post content, and this project
 * publishes what it holds. Storing the id plus the matched terms keeps the record
 * auditable — anyone can open the post — without this repository becoming a
 * republisher of someone else's text. The id also lets the timestamp be re-derived
 * by arithmetic rather than taken on trust.
 */
export function toLine(r: SocialReading) {
  return {
    observed_at: r.observedAt,
    handle: r.handle,
    post_id: r.postId,
    strength_pct: r.strengthPct,
    age_hours: r.ageHours,
    matched: r.matchedTerms,
    provenance: r.provenance,
    provider: r.providerId,
    note: r.note,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes('--credential')) {
    // Confirms the operator's setup WITHOUT revealing the secret — it reports a
    // source and a length, never content. An agent can verify the plumbing and
    // remain unable to read the credential, which is the point.
    const t = xTokenSource();
    if (t.present) {
      console.log(`credential FOUND via ${t.source} (${t.length} characters — value not shown)`);
      console.log('Run `npm run social:poll -- --dry-run` to make one live call and see what it returns.');
    } else {
      console.log(`no credential: ${t.note}`);
      console.log('\nSet one of:');
      console.log('  export QRI_X_BEARER_TOKEN=...           (this shell only; NOT visible to launchd)');
      console.log(`  printf %s "<token>" > ${TOKEN_FILE} && chmod 600 ${TOKEN_FILE}`);
    }
    return;
  }

  if (process.argv.includes('--explain')) {
    console.log('Classifier terms — hand-set, never validated against an outcome.\n');
    console.log(explainTerms());
    return;
  }

  const file = logPath();

  if (process.argv.includes('--show')) {
    const lines = readLines(file, { sortKey: 'observed_at' });
    if (!lines.length) {
      console.log('Nothing collected yet. Needs QRI_X_BEARER_TOKEN — see social/README.md.');
      return;
    }
    console.log(`${lines.length} observation${lines.length === 1 ? '' : 's'}, ${lines[0].observed_at} → ${lines[lines.length - 1].observed_at}\n`);
    for (const l of lines) {
      console.log(
        `  ${l.observed_at}  @${l.handle}  strength ${l.strength_pct}%  age ${l.age_hours}h  ` +
          `post ${l.post_id}${l.matched?.length ? `  [${l.matched.join(', ')}]` : ''}`,
      );
    }
    console.log('\nLOG-ONLY: none of this feeds a rendered forecast. See social/provider.ts.');
    return;
  }

  const dryRun = process.argv.includes('--dry-run');
  const cursor = readCursor();
  const now = new Date();
  let wrote = 0;

  for (const handle of Object.values(TRACKED_HANDLES)) {
    const state = cursor[handle] ?? {};
    const provider = new XApiProvider({ handle, sinceId: state.sinceId ?? null, userId: state.userId ?? null });
    console.log(`@${handle}: ${provider.describe()}`);

    const { reading, skipped } = await resolveSocialSignal([provider], now);
    for (const s of skipped) console.log(`  skipped ${s.providerId}: ${s.reason}`);

    if (reading.provenance === 'unavailable') {
      console.log(`  no signal: ${reading.note}`);
      continue;
    }

    console.log(
      `  strength ${reading.strengthPct}%  age ${reading.ageHours}h  post ${reading.postId}` +
        `${reading.matchedTerms.length ? `  [${reading.matchedTerms.join(', ')}]` : ''}`,
    );

    if (dryRun) continue;
    if (appendLine(file, toLine(reading))) wrote++;
    // Advance the cursor even on a zero-strength post: it is still seen, and not
    // advancing means paying to re-read it on the next poll.
    cursor[handle] = { sinceId: reading.postId ?? state.sinceId, userId: provider.userId ?? state.userId };
  }

  if (!dryRun) {
    writeCursor(cursor);
    console.log(`\nwrote ${wrote} line${wrote === 1 ? '' : 's'} to ${file}`);
  } else {
    console.log('\n--dry-run: nothing written, no cursor advanced.');
  }
  console.log('LOG-ONLY: this does not move any published number.');
}

if (isMain(import.meta.url)) await main();
