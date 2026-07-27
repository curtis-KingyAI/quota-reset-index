#!/usr/bin/env node
/**
 * npm run archive:verify — do the stored captures still resolve?
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `docs/STATUS.md` names link rot as the MOST LIKELY failure of this project, and
 * archiving as the mitigation. 61 of 64 evidence URLs carry a Wayback capture taken
 * between 2026-03-22 and 2026-07-26 — and until now **not one had ever been
 * re-checked**. The `checked_at` field records when we captured, not when we last
 * confirmed the capture still works.
 *
 * So the site tells readers "as of that date, this source said this" on the strength
 * of 61 URLs nobody has pinged since. That is an untested mitigation for the risk
 * the project itself calls most likely, which makes it worth measuring rather than
 * assuming — the same reasoning that produced the first Brier score.
 *
 * ── HOW A RESULT IS RECORDED ────────────────────────────────────────────────
 *
 * As another APPEND to the same per-URL attempts log, with `method: "verify"`.
 * Nothing is rewritten. That is the whole point of the sidecar design: it holds a
 * SERIES of attempts, so "captured on X, still resolving on Y" is expressible, and
 * so is "captured on X, gone by Z".
 *
 * ⚠️ A DEFINITIVE FAILURE MUST DEMOTE THE CAPTURE, or this is theatre — but ONLY a
 * definitive one. `bestCapture()` skips a capture whose most recent verification
 * returned `not_found` (the archive answered; the snapshot is gone). It does NOT
 * skip one that returned `failed` (we could not ask: timeout, refused connection,
 * rate limit).
 *
 * That distinction is not pedantry. The first full run here was throttled into 42
 * "fetch failed" results, and under a rule that demoted on any non-ok verdict the
 * published archive coverage would have dropped from 61 to 18 — a 70% loss caused
 * entirely by our own client having a bad afternoon, and looking exactly like a
 * genuine finding. Re-running at a slower rate resolved 38 of the 42 as fine.
 * INCONCLUSIVE IS NOT DEAD.
 *
 * ── BEING A POLITE CLIENT ───────────────────────────────────────────────────
 *
 * web.archive.org is a free public service being asked 61 questions on our behalf.
 * Requests are serialised with a delay, HEAD is preferred over GET so no bodies are
 * transferred, and a 429 backs off rather than retrying immediately.
 *
 *   npm run archive:verify -- --limit 5     sample a few first
 *   npm run archive:verify -- --dry-run     resolve nothing, just list what would be checked
 *   npm run archive:verify                  all of them, appending results
 */

import { appendAttempt, bestCapture, loadEntry } from '../lib/archive.mjs';
import { collectEntries } from './validate.mjs';
import { isMain } from '../lib/is-main.mjs';

/**
 * 600ms was too fast: the first full run got 42 of 61 throttled into "fetch failed".
 * Those were inconclusive, not dead — but they cost a full re-run, and a stricter
 * demotion rule would have blanked them on the live site. Slower is cheaper.
 */
const DELAY_MS = Number(process.env.QRI_ARCHIVE_DELAY_MS ?? 2000);
const TIMEOUT_MS = 20_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wayback capture URLs embed their timestamp: /web/YYYYMMDDhhmmss/<original>. */
export const timestampOf = (archiveUrl) => archiveUrl.match(/\/web\/(\d{14})/)?.[1] ?? null;

/** Every current-record evidence URL that has a capture to check. */
export function targets() {
  const cur = collectEntries()
    .map((e) => JSON.parse(e.raw))
    .filter((r) => r.superseded_by === null);
  const urls = [...new Set(cur.flatMap((r) => r.evidence.map((e) => e.url)))].sort();
  return urls
    .map((url) => ({ url, best: bestCapture(loadEntry(url)) }))
    .filter((t) => t.best?.archive_url);
}

/**
 * Check one capture.
 *
 * Redirects are FOLLOWED and then compared: Wayback answers a missing timestamp by
 * redirecting to the nearest capture, so a 200 at a different timestamp means our
 * recorded snapshot is gone even though *a* snapshot survives. Recording that as
 * plain success would hide exactly the decay this exists to detect.
 */
export async function checkOne(archiveUrl, fetchImpl = fetch) {
  const wanted = timestampOf(archiveUrl);
  const attempt = async (method) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      return await fetchImpl(archiveUrl, { method, redirect: 'follow', signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  let res;
  try {
    res = await attempt('HEAD');
    // Some Wayback paths dislike HEAD; fall back rather than calling it dead.
    if (res.status === 405 || res.status === 501) res = await attempt('GET');
  } catch (e) {
    return { status: 'failed', http: null, note: `request failed: ${e.name === 'AbortError' ? 'timeout' : e.message}` };
  }

  if (res.status === 429) return { status: 'failed', http: 429, note: 'rate limited — inconclusive, re-run later' };
  if (!res.ok) return { status: 'not_found', http: res.status, note: `capture did not resolve (HTTP ${res.status})` };

  const landed = timestampOf(res.url ?? archiveUrl);
  if (wanted && landed && landed !== wanted) {
    return {
      status: 'not_found',
      http: res.status,
      note: `recorded capture ${wanted} is gone; Wayback served ${landed} instead`,
      landed_timestamp: landed,
    };
  }
  return { status: 'ok', http: res.status, note: 'capture still resolves' };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(args[limitArg + 1]) : Infinity;

  let all = targets();

  // --retry-failed: only URLs whose LATEST verdict was inconclusive. Re-asking a
  // capture that already answered wastes someone else's bandwidth.
  if (args.includes('--retry-failed')) {
    all = all.filter((t) => {
      const verifies = (loadEntry(t.url).attempts ?? []).filter((a) => a.method === 'verify');
      return verifies.length && verifies[verifies.length - 1].status === 'failed';
    });
    console.log('retrying only the inconclusive ones');
  }

  const list = all.slice(0, limit);
  console.log(`${all.length} stored captures on current records; checking ${list.length}\n`);

  if (dryRun) {
    for (const t of list) console.log(`  would check ${timestampOf(t.best.archive_url)}  ${t.url.slice(0, 80)}`);
    return;
  }

  const tally = { ok: 0, not_found: 0, failed: 0 };
  for (const [i, t] of list.entries()) {
    const r = await checkOne(t.best.archive_url);
    tally[r.status]++;
    const mark = r.status === 'ok' ? '  ok  ' : r.status === 'not_found' ? ' DEAD ' : ' ERR  ';
    console.log(`${mark}${String(i + 1).padStart(3)}/${list.length}  ${t.url.slice(0, 72)}`);
    if (r.status !== 'ok') console.log(`        ${r.note}`);

    appendAttempt(t.url, {
      checked_at: new Date().toISOString(),
      method: 'verify',
      status: r.status,
      archive_url: t.best.archive_url,
      archive_timestamp: t.best.archive_timestamp ?? null,
      http: r.http,
      note: r.note,
    });
    if (i < list.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n  ok ${tally.ok} · dead ${tally.not_found} · errors ${tally.failed}`);
  if (tally.not_found) {
    console.log('  ⚠️  Dead captures are now demoted: bestCapture() skips them, so they stop being published.');
    console.log('      Re-run `npm run archive` to attempt fresh captures, then `npm run build`.');
  }
  if (tally.failed) console.log('  Errors are INCONCLUSIVE, not dead. Re-run before concluding anything.');
}

if (isMain(import.meta.url)) await main();
