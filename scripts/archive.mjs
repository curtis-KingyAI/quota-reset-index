#!/usr/bin/env node
/**
 * Archive every evidence URL, in three passes.
 *
 *   npm run archive              pass 1 only — read-only, free, no writes anywhere
 *   npm run archive -- --save    passes 1+2 — asks the Wayback Machine to capture misses
 *   npm run archive -- --report  coverage only, no network at all
 *
 * PASS 1  Wayback availability API. Read-only. Populates from captures that
 *         ALREADY EXIST, which for well-covered sites is a meaningful share for
 *         zero cost and zero side effects.
 * PASS 2  Save Page Now, misses only. This WRITES to a third party, so it is
 *         behind an explicit flag. Each capture is VERIFIED by re-querying
 *         availability rather than trusting the response. Verification RETRIES
 *         with backoff: captures routinely take longer than a few seconds to
 *         appear in the availability index, and a single impatient check
 *         manufactures false misses.
 * PASS 3  Sites that block archiving (bot-hostile hosts usually block SPN too)
 *         are recorded with status "blocked". A known-unarchivable source is a
 *         finding; a bare URL that looks fine and is not is the failure mode.
 *
 * Every attempt is appended, successes and failures alike. Nothing is overwritten.
 */

import { fileURLToPath } from 'node:url';
import { collectEntries } from './validate.mjs';
import { appendAttempt, coverage, loadEntry, bestCapture } from '../lib/archive.mjs';
import { isMain } from '../lib/is-main.mjs';

const AVAIL = 'https://archive.org/wayback/available?url=';
const SPN = 'https://web.archive.org/save/';
const UA = 'quota-reset-index/0.1 (ledger archival; +https://github.com/)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

/** Every distinct evidence URL across all records, superseded ones included. */
export function allEvidenceUrls() {
  const urls = new Set();
  for (const e of collectEntries()) {
    for (const ev of JSON.parse(e.raw).evidence) urls.add(ev.url);
  }
  return [...urls].sort();
}

/** PASS 1 — is there already a capture? Read-only. */
async function checkAvailability(url) {
  try {
    const res = await fetch(AVAIL + encodeURIComponent(url), {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { status: 'failed', note: `availability API HTTP ${res.status}` };
    const j = await res.json();
    const snap = j?.archived_snapshots?.closest;
    if (!snap?.available || !snap.url) return { status: 'not_found', note: 'no existing capture' };
    // Wayback timestamps are YYYYMMDDhhmmss.
    const t = String(snap.timestamp ?? '');
    const iso =
      t.length >= 14
        ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`
        : null;
    return { status: 'ok', archive_url: snap.url.replace(/^http:/, 'https:'), archive_timestamp: iso };
  } catch (e) {
    return { status: 'failed', note: `availability: ${e.message}` };
  }
}

/** PASS 2 — request a capture, then VERIFY it rather than trusting the response. */
async function savePageNow(url) {
  try {
    const res = await fetch(SPN + url, {
      headers: { 'user-agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(90_000),
    });
    if (res.status === 403 || res.status === 429) {
      return { status: 'blocked', note: `SPN HTTP ${res.status} — source or archive refused` };
    }
    if (!res.ok) return { status: 'failed', note: `SPN HTTP ${res.status}` };
  } catch (e) {
    return { status: 'failed', note: `SPN: ${e.message}` };
  }

  // Verify rather than trust: SPN can return 200 and produce nothing.
  //
  // ⚠️ BUT DO NOT VERIFY IMPATIENTLY. The 2026-07-26 first run checked once after
  // 4s and recorded 7 failures. A read-only re-check later found ALL SEVEN had
  // captured fine — the captures were real, they simply had not propagated into
  // the availability index yet. A single short check does not distinguish
  // "SPN did nothing" from "SPN has not finished", and defaulting to the first
  // reading manufactures false misses.
  const waits = [5000, 15000, 30000];
  for (const [i, w] of waits.entries()) {
    await sleep(w);
    const verified = await checkAvailability(url);
    if (verified.status === 'ok') {
      return { ...verified, note: `captured via SPN, verified after ${waits.slice(0, i + 1).reduce((a, b) => a + b, 0) / 1000}s` };
    }
  }
  return {
    status: 'failed',
    note: 'SPN accepted the request but no capture was retrievable within 50s — may still land; re-run to re-check',
  };
}

function report() {
  const urls = allEvidenceUrls();
  const c = coverage(urls);
  console.log(`archive coverage: ${c.archived} of ${c.total} distinct evidence URLs\n`);
  if (c.unarchived.length) {
    console.log('unarchived:');
    for (const u of c.unarchived) {
      const last = (loadEntry(u).attempts ?? []).at(-1);
      console.log(`  ${u}`);
      if (last) console.log(`      last: ${last.status} — ${last.note ?? ''} (${last.checked_at.slice(0, 10)})`);
    }
  }
  return c;
}

async function main() {
  const save = process.argv.includes('--save');
  if (process.argv.includes('--report')) {
    report();
    return;
  }

  const urls = allEvidenceUrls();
  console.log(`pass 1 — availability API across ${urls.length} distinct URLs (read-only)\n`);

  let hit = 0;
  for (const url of urls) {
    if (bestCapture(loadEntry(url))) {
      hit++;
      continue; // already have one; do not re-query
    }
    const r = await checkAvailability(url);
    appendAttempt(url, { checked_at: now(), method: 'wayback-availability', ...r });
    if (r.status === 'ok') hit++;
    process.stdout.write(r.status === 'ok' ? '.' : r.status === 'not_found' ? 'o' : '!');
    await sleep(250); // be a good citizen even where no limit is enforced
  }
  console.log(`\n\npass 1 complete — ${hit} of ${urls.length} archived\n`);

  if (!save) {
    const c = coverage(urls);
    if (c.unarchived.length) {
      console.log(`${c.unarchived.length} URLs have no capture. Run with --save to request one.`);
      console.log('That pass WRITES to archive.org, which is why it is behind a flag.');
    }
    return;
  }

  const c = coverage(urls);
  console.log(`pass 2 — Save Page Now for ${c.unarchived.length} misses (writes to archive.org)\n`);
  for (const url of c.unarchived) {
    const r = await savePageNow(url);
    appendAttempt(url, { checked_at: now(), method: 'save-page-now', ...r });
    console.log(`  ${r.status.padEnd(10)} ${url}${r.note ? `\n             ${r.note}` : ''}`);
    // Pace between captures. Configurable because the right value is empirical.
    // ⚠️ Note the 2026-07-26 finding: 7 apparent failures at a 6s pace were NOT
    // throttling — every one had actually captured, and the verify window was the
    // defect. Do not read a batch of failures here as "go slower" without first
    // re-running pass 1, which is free and may simply find them.
    await sleep(Number(process.env.QRI_SPN_DELAY_MS ?? 6000));
  }
  console.log('');
  report();
}

if (isMain(import.meta.url)) await main();
