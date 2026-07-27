/**
 * Append-only JSONL, written the way a process that may be killed mid-write has
 * to write.
 *
 * Extracted from `capture/observations.mjs` once a second caller needed the same
 * discipline. The reasoning is the point, so it lives here once rather than being
 * re-argued per log:
 *
 *  - **One line, one `appendFileSync` in O_APPEND mode.** No seek, no
 *    read-modify-write, no JSON array on disk. A killed writer either got its line
 *    out or did not; there is never a half-rewritten file to repair.
 *  - **Lines are capped below PIPE_BUF** (512 bytes on macOS, 4096 on Linux), so a
 *    single write is atomic on both and concurrent writers cannot interleave. Over
 *    the cap the line is refused rather than written, because corrupting a
 *    neighbour's line is worse than losing your own.
 *  - **Readers tolerate a torn final line.** Claude Code cancels an in-flight
 *    status line when a new update triggers, so a truncated last line is expected
 *    rather than exceptional. It is skipped, not thrown on.
 *
 * These logs are personal telemetry, never evidence. Nothing here may write into
 * `ledger/`.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Below PIPE_BUF on every platform this runs on. See the note above. */
export const MAX_LINE_BYTES = 512;

/**
 * Append one object as a line. Returns true when written.
 *
 * Never throws. Callers are status lines and pollers where an exception would
 * surface as a broken UI or a failed cron, and the log is always the expendable
 * half of the job.
 */
export function appendLine(file, obj, { maxBytes = MAX_LINE_BYTES } = {}) {
  try {
    const line = JSON.stringify(obj) + '\n';
    if (Buffer.byteLength(line, 'utf8') > maxBytes) return false;
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, line, { encoding: 'utf8', flag: 'a' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read every parseable line, oldest first by `sortKey`.
 *
 * Sorting is explicit because concurrent writers append in per-process order, not
 * global order — two sessions writing at once produce a file whose line order is
 * not its time order.
 */
export function readLines(file, { sortKey = 'observed_at' } = {}) {
  if (!existsSync(file)) return [];
  const out = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      if (o && typeof o === 'object' && typeof o[sortKey] === 'string') out.push(o);
    } catch {
      /* torn or truncated line — skip it rather than fail the whole read */
    }
  }
  return out.sort((a, b) => Date.parse(a[sortKey]) - Date.parse(b[sortKey]));
}
