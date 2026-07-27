/**
 * Decode an X post id to its creation instant.
 *
 * The technique `docs/RUNBOOK.md` §5 relies on, in code so it stops being copied
 * out of prose. Ids are Snowflakes: the top 41 bits are milliseconds since a
 * custom epoch, so the timestamp is recoverable by shifting.
 *
 * ⚠️ WHY THIS MATTERS MORE THAN IT LOOKS ⚠️
 *
 * A decode is ARITHMETIC, NOT TESTIMONY. It does not require trusting whoever
 * showed you the id, which is exactly why it is admissible where a mirror's own
 * date label is not. It settled the two largest structural defects in this ledger:
 * one event recorded twice under two timezone conventions, and a tracker row
 * labelled "Jul 21" whose cited id decodes to 2026-07-25T19:17:12Z.
 *
 * ⚠️ AND WHAT IT DOES NOT TELL YOU: when the post was made, never when the reset
 * landed. A post reading "resetting in the next hour" gives an exact announcement
 * and an inexact effect. Downgrade `effective_at_precision`; do not borrow this
 * timestamp for the event.
 */

/** Twitter/X Snowflake epoch, 2010-11-04T01:42:54.657Z. */
export const SNOWFLAKE_EPOCH_MS = 1288834974657n;

/** First id issued under the Snowflake scheme. Below this the arithmetic is meaningless. */
const FIRST_SNOWFLAKE_ID = 29700859247n;

/**
 * Returns a Date, or null when the id is not a decodable Snowflake.
 *
 * Null rather than a throw or a garbage date: callers are cross-checking a claim,
 * and "this id cannot be decoded" is a usable answer where a wrong instant is not.
 */
export function decodePostId(id) {
  let n;
  try {
    n = BigInt(String(id).trim());
  } catch {
    return null;
  }
  if (n < FIRST_SNOWFLAKE_ID) return null;
  const ms = (n >> 22n) + SNOWFLAKE_EPOCH_MS;
  const date = new Date(Number(ms));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Does a claimed timestamp agree with the id's own?
 *
 * `toleranceMs` defaults to a minute, which absorbs rounding in a source that
 * states minutes rather than seconds. A disagreement larger than that is the
 * signal — it is how the four-day mislabelled tracker row was found.
 */
export function idAgreesWith(id, claimedIso, toleranceMs = 60_000) {
  const decoded = decodePostId(id);
  const claimed = Date.parse(claimedIso);
  if (!decoded || Number.isNaN(claimed)) return null;
  return Math.abs(decoded.getTime() - claimed) <= toleranceMs;
}
