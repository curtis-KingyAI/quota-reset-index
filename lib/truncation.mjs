/**
 * Reject prose that was cut off before it was ever written.
 *
 * ── THE DEFECT THIS EXISTS TO STOP HAPPENING AGAIN ──────────────────────────
 *
 * A survey on 2026-07-27 found **65 truncated prose fields across ~44 of the 48
 * records**. The lengths cluster unmistakably: `scope.notes` at 699–700, `notes` at
 * 975–1200 with many landing on exactly 1200. Whatever authored the Phase 1 and
 * migration-02 records capped its own prose at write time, silently, and nothing
 * caught it.
 *
 * Why that matters more than untidiness: the truncated text is usually the
 * JUSTIFICATION. `cx-2026-06-28-02` explains that its confidence was downgraded
 * after failing one of five adversarial vectors — and is cut off during vector 1,
 * so which one failed is unrecoverable. A record whose reasoning stops mid-sentence
 * cannot be re-audited from itself, which is the one thing this ledger promises.
 *
 * The content is genuinely gone. It was truncated BEFORE reaching disk: the
 * predecessor `cx-2026-06-28-01` carries the same sentence cut at the same point,
 * and no commit in history holds a fuller version. Reconstructing it would be
 * fabrication wearing the costume of evidence, so the 65 stay as they are — sealed,
 * and now themselves part of the audit trail.
 *
 * ── WHY THIS ONLY GUARDS NEW RECORDS ────────────────────────────────────────
 *
 * The 65 are sealed; append-only means they cannot be repaired even in principle.
 * A validation error on them would fail `npm run validate`, the build and CI
 * forever, for a defect nobody is permitted to fix — and a check that cannot be
 * satisfied is one that gets deleted. So this runs in the pre-commit hook against
 * ADDED records only, where the author can simply finish the sentence.
 */

/**
 * Markers of prose stopped mid-thought.
 *
 * The ellipsis is the reliable signal — every one of the 65 ends in U+2026, and a
 * writer who means "and so on" can end the sentence properly instead. Three dots
 * are included because a truncator that lacks the character reaches for them.
 */
export const TRUNCATION_MARKERS = Object.freeze(['…', '...']);

/** The historical caps, recorded so a near-miss is recognisable rather than mysterious. */
export const OBSERVED_CAPS = Object.freeze({ 'scope.notes': 700, notes: 1200 });

const endsTruncated = (s) => {
  if (typeof s !== 'string') return false;
  const t = s.trimEnd();
  return TRUNCATION_MARKERS.some((m) => t.endsWith(m));
};

/**
 * Prose fields on `record` that appear to have been cut off. Returns field paths.
 *
 * Deliberately checks only the TAIL. Guessing at truncation from length alone
 * would fire on any record that happens to be near a cap, and a check that flags
 * correct work is one people learn to route around.
 */
export function truncatedFields(record) {
  const out = [];
  if (!record || typeof record !== 'object') return out;
  if (endsTruncated(record.notes)) out.push('notes');
  if (endsTruncated(record.scope?.notes)) out.push('scope.notes');
  return out;
}

/** Human-readable explanation for the hook. */
export function truncationMessage(path, field, value) {
  const cap = OBSERVED_CAPS[field];
  const len = typeof value === 'string' ? value.length : 0;
  const nearCap = cap && Math.abs(len - cap) <= 25 ? ` — and ${len} chars is at the historical ${cap} cap` : '';
  return (
    `TRUNCATED PROSE: ${path}\n` +
    `    field: ${field} (${len} chars, ends mid-thought)${nearCap}\n` +
    `    Finish the sentence. This field usually carries the JUSTIFICATION, and a\n` +
    `    record whose reasoning stops mid-sentence cannot be re-audited from itself.\n` +
    `    65 existing records already have this defect and are sealed, so it can never\n` +
    `    be repaired there. Do not add the 66th.`
  );
}
