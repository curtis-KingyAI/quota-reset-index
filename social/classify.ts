/**
 * Turning a post into a signal strength — the weakest link, made auditable.
 *
 * ⚠️ READ THIS BEFORE TRUSTING A NUMBER OUT OF HERE ⚠️
 *
 * This is a term-match scorer. It is not a model of intent, it has never been
 * validated against an outcome, and it will be wrong in both directions: a
 * deliberately vague post ("something nice tomorrow") scores near zero, and an
 * unrelated post using the word "limits" scores above zero.
 *
 * That is precisely the shape of defect the 2026-07-26 audit was about — a general
 * statement read as an event-specific one — so the design concedes it rather than
 * hiding it:
 *
 *  1. **The term list is data, not code.** Printed on demand, so a reader can see
 *     what the scorer actually keys on rather than inferring it.
 *  2. **Every match is returned.** A strength with no `matchedTerms` behind it is
 *     never produced, so no consumer can quote the number without the working.
 *  3. **Strength is a stated function of matches**, not a learned weight. There is
 *     no sample to learn from.
 *  4. **It does not reach a published number.** See `PUBLIC_SURFACE_POLICY`.
 *
 * A future replacement — a real classifier fitted to labelled posts — is a Phase 6
 * job and needs the labelled posts first. Collecting them is what this exists for.
 */

/**
 * Terms, grouped by what they would license if the post is genuine.
 *
 * `strong` — an explicit statement that limits are being reset or lifted.
 * `moderate` — the subject matter, without a stated action.
 * `hint` — the vaguepost register these accounts actually use, which is why the
 *   term exists in the model at all. Deliberately low-scoring: a hint is evidence
 *   that something may be coming, not that anything happened.
 */
export const TERMS = Object.freeze({
  strong: Object.freeze([
    'resetting usage limits',
    'reset usage limits',
    'resetting rate limits',
    'reset rate limits',
    'resetting limits',
    'reset your limits',
    'usage reset',
    'quota reset',
    'limits are reset',
    'removing the limit',
    'removed the limit',
    'lifting the limit',
    'lifted the limit',
    'no rate limits',
    'unlimited for',
    'banked reset',
  ]),
  moderate: Object.freeze([
    'rate limit',
    'usage limit',
    'weekly limit',
    '5h limit',
    'five hour limit',
    'quota',
    'allowance',
    'credits',
  ]),
  hint: Object.freeze([
    'something for you',
    'treat',
    'gift',
    'good news',
    'stay tuned',
    'you will like',
    "you're going to like",
    'tomorrow',
    'later today',
    'soon',
  ]),
});

/** Points per matched group. Hand-set, like every other constant in this project. */
export const WEIGHTS = Object.freeze({ strong: 60, moderate: 20, hint: 10 });

/** A hint on its own cannot exceed this, however many hint terms match. */
export const HINT_ONLY_CEILING = 25;

export interface Classification {
  strengthPct: number;
  matchedTerms: string[];
  /** Which groups fired, for the note that travels with the reading. */
  groups: string[];
}

/**
 * Score one post.
 *
 * Scoring is additive with a ceiling rather than a maximum-of-groups, so a post
 * that both states the action and names the window scores higher than one that
 * only states the action. A hint-only post is capped: the register is genuinely
 * predictive of *something*, and genuinely uninformative about *what*.
 */
export function classify(text: string): Classification {
  const haystack = String(text ?? '').toLowerCase();
  const matched: string[] = [];
  const groups: string[] = [];
  let score = 0;

  for (const group of ['strong', 'moderate', 'hint'] as const) {
    const hits = TERMS[group].filter((t) => {
      if (!haystack.includes(t)) return false;
      // ⚠️ A lower-group term that is a SUBSTRING of an already-matched higher-group
      // term is not independent evidence, and counting it was a real bias: "usage
      // limit" (moderate, +20) sits inside "resetting usage limits" (strong, +60),
      // so every explicit reset statement silently scored 80 rather than 60 and
      // listed both phrases as if two things had been found. Caught by a test that
      // asserted what `matchedTerms` actually contained.
      return !matched.some((already) => already.includes(t));
    });
    if (!hits.length) continue;
    groups.push(group);
    matched.push(...hits);
    // Only the first match in a group scores its full weight; further matches in
    // the same group add a quarter each. Repeating a phrase is not new evidence.
    score += WEIGHTS[group] + (hits.length - 1) * (WEIGHTS[group] / 4);
  }

  const hintOnly = groups.length === 1 && groups[0] === 'hint';
  if (hintOnly) score = Math.min(score, HINT_ONLY_CEILING);

  return { strengthPct: Math.max(0, Math.min(100, Math.round(score))), matchedTerms: matched, groups };
}

/** The term list, for `--explain`. A scorer nobody can inspect is one nobody should use. */
export function explainTerms(): string {
  return (['strong', 'moderate', 'hint'] as const)
    .map((g) => `${g} (+${WEIGHTS[g]} first match, +${WEIGHTS[g] / 4} each after):\n  ${TERMS[g].join('\n  ')}`)
    .join('\n\n');
}
