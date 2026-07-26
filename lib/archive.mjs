/**
 * The archive index — a sidecar, deliberately not a field on the records.
 *
 * WHY A SIDECAR. Populating `evidence[].archive_url` on a committed record is a
 * MUTATION, not an append: `evidence` is a top-level non-null array, so the hook
 * compares it whole and rejects any change inside it. Verified against the real
 * hook before this was designed.
 *
 * The three ways out, and why this is the one:
 *
 *   - Loosen the hook to permit nested null->value. Creates a general exemption
 *     to the append-only rule in order to protect one thing that is not a claim.
 *     The next person uses that exemption for something that IS a claim.
 *   - Supersede all 47 records. Doubles the ledger for a non-semantic change and
 *     destroys the meaning of the supersede chain, which currently says "this
 *     record was corrected". An archive backfill corrects nothing.
 *   - A sidecar. Record files never change; the guarantee stays absolute.
 *
 * And the sidecar is better on the merits, not merely safer. An archive is not a
 * claim about the event — it is a durability measure for a citation, with its own
 * lifetime. A single `archive_url` field holds ONE capture; an append-only
 * attempts log holds a SERIES, which is what supports the claim actually worth
 * making: "as of date X, source Y said Z". Failures are recorded too, so a source
 * that cannot be archived is a known state rather than a silent gap.
 *
 * Layout: archive/<sha256(url)>.json, one file per evidence URL, attempts append.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const ARCHIVE_DIR = join(ROOT, 'archive');

export const urlKey = (url) => createHash('sha256').update(url, 'utf8').digest('hex');

/** Attempt statuses. `blocked` means the source refuses archiving, which is a finding. */
export const STATUSES = ['ok', 'not_found', 'failed', 'blocked'];

export function loadEntry(url, dir = ARCHIVE_DIR) {
  const f = join(dir, `${urlKey(url)}.json`);
  if (!existsSync(f)) return { url, attempts: [] };
  return JSON.parse(readFileSync(f, 'utf8'));
}

/** Append an attempt. Never rewrites an earlier one. */
export function appendAttempt(url, attempt, dir = ARCHIVE_DIR) {
  const entry = loadEntry(url, dir);
  if (entry.url !== url) entry.url = url; // first write
  entry.attempts.push(attempt);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${urlKey(url)}.json`), JSON.stringify(entry, null, 2) + '\n');
  return entry;
}

/** The capture a consumer should use: the most recent successful one. */
export function bestCapture(entry) {
  const ok = (entry.attempts ?? []).filter((a) => a.status === 'ok' && a.archive_url);
  if (!ok.length) return null;
  return ok.reduce((a, b) => (a.archive_timestamp >= b.archive_timestamp ? a : b));
}

/** url -> best capture, for the whole index. */
export function loadIndex(dir = ARCHIVE_DIR) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const entry = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    map.set(entry.url, { entry, best: bestCapture(entry) });
  }
  return map;
}

/** Coverage summary, for reporting and for the deploy preflight. */
export function coverage(urls, dir = ARCHIVE_DIR) {
  const index = loadIndex(dir);
  let archived = 0;
  const unarchived = [];
  for (const u of urls) {
    const hit = index.get(u);
    if (hit?.best) archived++;
    else unarchived.push(u);
  }
  return { total: urls.length, archived, unarchived };
}
