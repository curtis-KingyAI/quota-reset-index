/**
 * The observation log — append-only, one JSON object per line.
 *
 * WHAT THIS IS. A record of what a Claude Code status line saw, on ONE seat, at a
 * series of instants. It is raw instrument output. It is emphatically NOT the
 * ledger, and nothing here may ever write to `ledger/`.
 *
 * ── WHY THE SHAPE IS ENDPOINT-SHAPED, WHEN usage/provider.ts REFUSES TO BE ──
 *
 * `usage/provider.ts` is deliberately not modelled on any endpoint's response,
 * because it is the interface the FORECAST consumes and the forecast should not
 * inherit a vendor's schema. This file is the opposite end of the pipe: it is a
 * transcript of what a documented interface actually emitted. A transcript that
 * paraphrases is worse than one that quotes, so these fields carry the vendor's
 * own names and units. The translation happens downstream, not here.
 *
 * ── OPERATIONAL CONSTRAINTS, FROM THE DOCUMENTED CONTRACT ───────────────────
 *
 * The status line runs on session events, debounced at 300ms, and Claude Code
 * CANCELS an in-flight script when a new update triggers. Several sessions can
 * run concurrently against one account. That rules out any read-modify-write of a
 * shared file, and it rules out a JSON array on disk — a cancelled process
 * mid-rewrite would truncate the file.
 *
 * Hence: one line, one `appendFileSync` in O_APPEND mode, kept far under
 * PIPE_BUF so concurrent appends cannot interleave. A killed process either wrote
 * its line or did not. There is no partial state to repair, and a reader that
 * meets a torn final line skips it rather than throwing.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Default log location is OUTSIDE the repository, and that is a decision.
 *
 * These lines describe one person's account usage over time. They are personal
 * telemetry, not evidence, and a repo whose whole pitch is "check our work" must
 * not invite someone to commit them. `QRI_OBS_LOG` overrides it for tests.
 */
export const DEFAULT_LOG = join(homedir(), '.quota-reset-index', 'observations.jsonl');

export const logPath = () => process.env.QRI_OBS_LOG || DEFAULT_LOG;

/** Per-session sidecar holding the last line written, so the logger need not read the whole log. */
export const statePath = (sessionId) =>
  join(dirname(logPath()), `last-${String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '')}.json`);

/**
 * A line longer than this is not written.
 *
 * PIPE_BUF is 512 bytes on macOS and 4096 on Linux; a single write below the
 * smaller figure is atomic on both, which is what keeps concurrent sessions from
 * interleaving. A well-formed record is ~200 bytes, so hitting this cap means a
 * field arrived unexpectedly huge — dropping that line is better than corrupting
 * a neighbour's.
 */
export const MAX_LINE_BYTES = 512;

/** Only log when something material moved, or when this long has passed anyway. */
export const MIN_INTERVAL_SECONDS = 300;
/** Percentage-point change in a window's usage that counts as material. */
export const MATERIAL_PCT_DELTA = 0.5;

/**
 * Normalise the documented stdin payload into an observation.
 *
 * Returns null when there is nothing to observe. Per the contract, `rate_limits`
 * "appears only for Claude.ai subscribers (Pro/Max) after the first API response
 * in the session", and each of `five_hour` / `seven_day` "may be independently
 * absent". Absence is the normal case at session start, not an error — and a
 * missing window must never be recorded as 0%, which would read as a fresh quota
 * that was never observed.
 */
export function toObservation(payload, nowIso) {
  const rl = payload?.rate_limits;
  if (!rl || typeof rl !== 'object') return null;

  const window = (w) => {
    if (!w || typeof w !== 'object') return undefined;
    const used = typeof w.used_percentage === 'number' ? w.used_percentage : null;
    const resets = typeof w.resets_at === 'number' ? w.resets_at : null;
    if (used === null && resets === null) return undefined;
    return { used_pct: used, resets_at: resets };
  };

  const five = window(rl.five_hour);
  const seven = window(rl.seven_day);
  if (!five && !seven) return null;

  const obs = {
    observed_at: nowIso,
    session: typeof payload.session_id === 'string' ? payload.session_id : null,
    version: typeof payload.version === 'string' ? payload.version : null,
  };
  if (five) obs.five_hour = five;
  if (seven) obs.seven_day = seven;
  return obs;
}

/** Did anything material change since the last logged observation for this session? */
export function isMaterialChange(prev, next) {
  if (!prev) return true;

  const elapsed = (Date.parse(next.observed_at) - Date.parse(prev.observed_at)) / 1000;
  if (!Number.isFinite(elapsed) || elapsed >= MIN_INTERVAL_SECONDS) return true;

  for (const key of ['five_hour', 'seven_day']) {
    const a = prev[key];
    const b = next[key];
    if (!a !== !b) return true;
    if (!a || !b) continue;
    // A moved window boundary is always material: it is the discriminator the
    // detector uses to tell a refill from an ordinary rollover.
    if (a.resets_at !== b.resets_at) return true;
    if (a.used_pct === null || b.used_pct === null) {
      if (a.used_pct !== b.used_pct) return true;
      continue;
    }
    if (Math.abs(b.used_pct - a.used_pct) >= MATERIAL_PCT_DELTA) return true;
  }
  return false;
}

/**
 * Append one observation if it is material. Returns true when a line was written.
 *
 * Never throws: this runs inside the status line, where an exception would show
 * the operator an error where their status bar should be. Failures are silent by
 * design and visible only in that the log stops growing.
 */
export function record(obs, { file = logPath() } = {}) {
  try {
    const sidecar = statePath(obs.session);
    let prev = null;
    try {
      if (existsSync(sidecar)) prev = JSON.parse(readFileSync(sidecar, 'utf8'));
    } catch {
      /* unreadable sidecar means "no previous observation" — log and move on */
    }
    if (!isMaterialChange(prev, obs)) return false;

    const line = JSON.stringify(obs) + '\n';
    if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) return false;

    mkdirSync(dirname(file), { recursive: true });
    // O_APPEND: one syscall, no seek, safe against concurrent sessions.
    appendFileSync(file, line, { encoding: 'utf8', flag: 'a' });
    // Sidecar written AFTER the log, so a crash between the two costs a duplicate
    // line rather than a lost observation. Duplicates are harmless to the
    // detector; a missed drop is not.
    writeFileSync(sidecar, JSON.stringify(obs));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the log, oldest first.
 *
 * Tolerates a torn final line — a cancelled writer is expected, not exceptional —
 * and sorts by `observed_at` because concurrent sessions append in wall-clock
 * order per process, not globally.
 */
export function readObservations({ file = logPath() } = {}) {
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const o = JSON.parse(trimmed);
      if (o && typeof o.observed_at === 'string') out.push(o);
    } catch {
      /* torn or truncated line — skip it rather than fail the whole read */
    }
  }
  return out.sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
}
