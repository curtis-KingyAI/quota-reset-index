/**
 * Append-only status store.
 *
 * Layout, per vendor, under status/data/<vendor>/:
 *   log.ndjson            append-only event log — the only source of truth
 *   snapshots/<sha>.json  raw body, written ONCE per distinct response
 *
 * §6 wants a snapshot only when the sha256 of the body changes, and a heartbeat
 * otherwise. Both land in log.ndjson; the snapshot file is written only on first
 * sight of a hash.
 *
 * There is deliberately no mutable `current.json`. Current state is DERIVED by
 * reading the log backwards. That keeps the store strictly append-only (§2: no
 * deletion, ever — same rule for raw telemetry) and removes any chance of a
 * cache disagreeing with its own history. At 144 events/day/vendor the read is
 * trivial, and if it ever stops being trivial, tail the file.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Vendor } from './config.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DATA_DIR = join(ROOT, 'status', 'data');

export type EventType = 'snapshot' | 'heartbeat' | 'failure';

export interface LogEvent {
  ts: string;
  type: EventType;
  /** Present on snapshot and heartbeat; null on failure. */
  sha256: string | null;
  indicator: string | null;
  severity: number | null;
  /** Present on failure only. */
  error: string | null;
  /** HTTP status where we got one. */
  httpStatus: number | null;
}

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

function vendorDir(vendor: Vendor, dataDir = DATA_DIR): string {
  return join(dataDir, vendor);
}

export function readLog(vendor: Vendor, dataDir = DATA_DIR): LogEvent[] {
  const f = join(vendorDir(vendor, dataDir), 'log.ndjson');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LogEvent);
}

export function appendEvent(vendor: Vendor, ev: LogEvent, dataDir = DATA_DIR): void {
  const dir = vendorDir(vendor, dataDir);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'log.ndjson'), JSON.stringify(ev) + '\n');
}

/** Write the raw body once per distinct hash. Returns true if this hash was new. */
export function storeSnapshotBody(vendor: Vendor, body: string, dataDir = DATA_DIR): { hash: string; isNew: boolean } {
  const hash = sha256(body);
  const dir = join(vendorDir(vendor, dataDir), 'snapshots');
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${hash}.json`);
  if (existsSync(f)) return { hash, isNew: false };
  writeFileSync(f, body);
  return { hash, isNew: true };
}

export interface FeedState {
  vendor: Vendor;
  /** Last severity the vendor actually stated, or null if we have never had one. */
  severity: number | null;
  indicator: string | null;
  /** When that reading was taken. */
  asOf: string | null;
  /** How stale it is, in ms, at the `now` passed in. Null when there is no reading. */
  ageMs: number | null;
  /** Consecutive failures since the last successful read. */
  consecutiveFailures: number;
  /** §6: three consecutive failures marks the feed degraded in the UI. */
  degraded: boolean;
  /** True when we have never successfully read this feed at all. */
  neverRead: boolean;
}

/**
 * Current state for a feed, derived from the log.
 *
 * A failed fetch serves the LAST KNOWN value with its age attached (§6). It
 * never serves 0, and it never serves null-as-zero — `severity: null` with
 * `neverRead: true` is a distinct, renderable state meaning "we do not know".
 */
export function currentState(vendor: Vendor, now: Date, dataDir = DATA_DIR): FeedState {
  const log = readLog(vendor, dataDir);

  let last: LogEvent | null = null;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].type !== 'failure' && log[i].severity !== null) {
      last = log[i];
      break;
    }
  }

  let consecutiveFailures = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].type === 'failure') consecutiveFailures++;
    else break;
  }

  return {
    vendor,
    severity: last ? last.severity : null,
    indicator: last ? last.indicator : null,
    asOf: last ? last.ts : null,
    ageMs: last ? now.getTime() - new Date(last.ts).getTime() : null,
    consecutiveFailures,
    degraded: consecutiveFailures >= 3,
    neverRead: last === null,
  };
}

/** Human-readable staleness, for the UI line that §6 requires next to a cached value. */
export function describeAge(ageMs: number | null): string {
  if (ageMs === null) return 'never read';
  const m = Math.floor(ageMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
