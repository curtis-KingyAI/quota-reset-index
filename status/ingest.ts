/**
 * One poll cycle: fetch each vendor's summary.json, record what happened.
 *
 * Deliberately NOT scheduled from inside this file. Building the pipeline is in
 * scope; running it against anything is a deploy action, and §2 puts that behind
 * Phase 5 approval. `npm run status:poll` runs exactly one cycle.
 */

import { FEEDS, FETCH_TIMEOUT_MS, DEGRADED_AFTER_FAILURES, type FeedConfig } from './config.ts';
import { parseSummary } from './severity.ts';
import { appendEvent, storeSnapshotBody, currentState, describeAge, DATA_DIR, type LogEvent } from './store.ts';
import { isMain } from '../lib/is-main.mjs';

export interface PollOutcome {
  vendor: string;
  result: 'snapshot' | 'heartbeat' | 'failure';
  detail: string;
}

/** Injectable so tests never touch the network. */
export type Fetcher = (url: string) => Promise<{ status: number; body: string }>;

const realFetch: Fetcher = async (url) => {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  return { status: res.status, body: await res.text() };
};

export async function pollFeed(
  feed: FeedConfig,
  now: Date,
  fetcher: Fetcher = realFetch,
  dataDir = DATA_DIR,
): Promise<PollOutcome> {
  const ts = now.toISOString();
  const fail = (error: string, httpStatus: number | null): PollOutcome => {
    const ev: LogEvent = { ts, type: 'failure', sha256: null, indicator: null, severity: null, error, httpStatus };
    appendEvent(feed.vendor, ev, dataDir);
    return { vendor: feed.vendor, result: 'failure', detail: error };
  };

  let res: { status: number; body: string };
  try {
    res = await fetcher(feed.url);
  } catch (e) {
    return fail(`fetch threw: ${(e as Error).message}`, null);
  }

  if (res.status < 200 || res.status >= 300) {
    return fail(`HTTP ${res.status}`, res.status);
  }

  const parsed = parseSummary(res.body);
  if (!parsed.ok) {
    // A shape change is a failure, not a zero. It keeps the last known value live.
    return fail(`unparseable: ${parsed.reason}`, res.status);
  }

  const { hash, isNew } = storeSnapshotBody(feed.vendor, res.body, dataDir);
  const ev: LogEvent = {
    ts,
    type: isNew ? 'snapshot' : 'heartbeat',
    sha256: hash,
    indicator: parsed.indicator,
    severity: parsed.severity,
    error: null,
    httpStatus: res.status,
  };
  appendEvent(feed.vendor, ev, dataDir);

  return {
    vendor: feed.vendor,
    result: isNew ? 'snapshot' : 'heartbeat',
    detail: `${parsed.indicator} (severity ${parsed.severity})${isNew ? ' — body changed' : ''}`,
  };
}

export async function pollAll(now: Date, fetcher: Fetcher = realFetch, dataDir = DATA_DIR): Promise<PollOutcome[]> {
  // Sequential, not parallel: two requests every ten minutes needs no concurrency,
  // and serialising keeps us visibly polite to both vendors.
  const out: PollOutcome[] = [];
  for (const feed of FEEDS) out.push(await pollFeed(feed, now, fetcher, dataDir));
  return out;
}

async function main(): Promise<void> {
  const now = new Date();
  const outcomes = await pollAll(now);
  for (const o of outcomes) console.log(`${o.vendor.padEnd(12)} ${o.result.padEnd(9)} ${o.detail}`);

  console.log('\ncurrent state:');
  let anyDegraded = false;
  for (const feed of FEEDS) {
    const s = currentState(feed.vendor, now);
    const sev = s.severity === null ? 'UNKNOWN' : String(s.severity);
    const flag = s.degraded ? `  ** DEGRADED (${s.consecutiveFailures} consecutive failures) **` : '';
    if (s.degraded) anyDegraded = true;
    console.log(`  ${feed.vendor.padEnd(12)} severity=${sev.padEnd(8)} ${s.indicator ?? '—'} · ${describeAge(s.ageMs)}${flag}`);
  }

  if (anyDegraded) {
    console.error(`\nAt least one feed has ${DEGRADED_AFTER_FAILURES}+ consecutive failures. §6 requires this be reported.`);
    process.exit(2);
  }
}

if (isMain(import.meta.url)) await main();
