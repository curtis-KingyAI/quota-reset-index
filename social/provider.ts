/**
 * The vendor-employee social signal, behind an injected provider.
 *
 * Same shape and same reasoning as `usage/provider.ts`: the interface is derived
 * from WHAT THE MODEL NEEDS, not from any API's response schema. Both models carry
 * a weight for a post by a vendor employee — `tibo` (@thsottiaux) in Model A,
 * `dev` (@ClaudeDevs) in Model B — and each needs exactly two numbers and an honest
 * "I don't know":
 *
 *   - how strong the signal is, 0–100
 *   - how old the post is, in hours
 *   - whether either is actually known
 *
 * Deliberately absent: no `tweet`, no `entities`, no `public_metrics`, no
 * `since_id`. If X redesigns its API, or if the signal one day comes from
 * somewhere else entirely, nothing in this interface changes.
 *
 * ── THE PART THAT IS NOT PLUMBING ───────────────────────────────────────────
 *
 * `tibo` carries w=1.45 — the HIGHEST weight in either model. At full strength and
 * zero age it multiplies λ by about 4.3. It is also a hand-set prior that has never
 * once fired, because §2 kept it unreachable, so no observation has ever tested it.
 *
 * Switching it into the rendered forecast would therefore put the largest lever on
 * the page under the control of an unvalidated weight driven by keyword-matching
 * someone's tweets. That is why `PUBLIC_SURFACE_POLICY` below is `log-only` and why
 * `resolveSocialSignal` refuses to hand a signal to a public surface at all: the
 * signal is collected so it can eventually be calibrated, and it does not move a
 * published number before then.
 *
 * This is the same discipline as `capture/`: observe now, promote on evidence later.
 * Operator decision, 2026-07-27.
 */

/** What a provider can actually do. Makes the gap legible in code, not just prose. */
export interface SocialCapabilities {
  /** Can it establish that a post exists, and which post? */
  postDiscovery: boolean;
  /** Can it read the post's CONTENT, or only its existence and timing? */
  contentAccess: boolean;
  /** Is this a documented, permitted integration, or reverse-engineered? */
  supported: boolean;
  /** Does using it cost money per call? Recorded so a poller cannot quietly spend. */
  metered: boolean;
}

export type SocialProvenance = 'official-api' | 'mirror-locator' | 'unavailable';

export interface SocialReading {
  /** Which account this is about, without the leading @. */
  handle: string;
  /**
   * Signal strength 0–100. NULL means unknown, and never means zero — a silent
   * zero would assert "the account is quiet" on no evidence, which is the same
   * class of defect as the ledger's over-claimed scope fields.
   */
  strengthPct: number | null;
  /** Age of the post in hours. Null when unknown. */
  ageHours: number | null;
  /** The post id, when there is one. Lets any consumer re-derive the time itself. */
  postId: string | null;
  observedAt: string;
  provenance: SocialProvenance;
  providerId: string;
  /** Why it is unavailable or degraded, when it is. */
  note: string | null;
  /**
   * Which classifier terms matched, verbatim.
   *
   * Present so a human can audit the judgment rather than accept a number. A
   * classifier that cannot show its working is not admissible evidence for
   * anything, and this one is not admissible evidence regardless — see the header.
   */
  matchedTerms: string[];
}

export interface SocialProvider {
  readonly id: string;
  readonly handle: string;
  readonly capabilities: SocialCapabilities;
  /** One line, rendered on the methodology page so the dependency is never hidden. */
  describe(): string;
  read(now: Date): Promise<SocialReading>;
}

export const NO_SOCIAL_SIGNAL = (handle: string, providerId: string, now: Date, note: string): SocialReading => ({
  handle,
  strengthPct: null,
  ageHours: null,
  postId: null,
  observedAt: now.toISOString(),
  provenance: 'unavailable',
  providerId,
  note,
  matchedTerms: [],
});

/**
 * Standing policy for anything published.
 *
 * `log-only` until a labelled sample exists to fit the weight against. Encoded as
 * a value rather than a comment so the refusal below can cite it.
 */
export const PUBLIC_SURFACE_POLICY = 'log-only' as const;

export interface ResolveResult {
  reading: SocialReading;
  /** Every provider tried, and why it was skipped. Rendered, not swallowed. */
  skipped: { providerId: string; reason: string }[];
}

/**
 * Try each provider in order.
 *
 * `publicSurface: true` refuses EVERY provider, by policy rather than by accident.
 * That is deliberate and is the enforcement point for the decision in the header:
 * a future caller who wires this into a rendered forecast has to change this
 * function and confront the reason, rather than merely passing a different flag.
 */
export async function resolveSocialSignal(
  providers: SocialProvider[],
  now: Date,
  { publicSurface = false }: { publicSurface?: boolean } = {},
): Promise<ResolveResult> {
  const skipped: { providerId: string; reason: string }[] = [];
  const handle = providers[0]?.handle ?? 'unknown';

  if (publicSurface) {
    for (const p of providers) {
      skipped.push({
        providerId: p.id,
        reason: `policy is ${PUBLIC_SURFACE_POLICY}: the signal is collected for calibration and does not move a published number until its weight is fitted`,
      });
    }
    return {
      reading: NO_SOCIAL_SIGNAL(handle, 'policy', now, `refused on a public surface (${PUBLIC_SURFACE_POLICY})`),
      skipped,
    };
  }

  for (const p of providers) {
    if (!p.capabilities.supported) {
      skipped.push({ providerId: p.id, reason: 'provider is not a supported integration' });
      continue;
    }
    try {
      const reading = await p.read(now);
      if (reading.provenance !== 'unavailable') return { reading, skipped };
      skipped.push({ providerId: p.id, reason: reading.note ?? 'returned no signal' });
    } catch (e) {
      skipped.push({ providerId: p.id, reason: `threw: ${(e as Error).message}` });
    }
  }

  return {
    reading: NO_SOCIAL_SIGNAL(handle, 'none', now, 'every provider was exhausted'),
    skipped,
  };
}

/** True when a reading carries enough to be worth storing. */
export const isUsable = (r: SocialReading): boolean => r.strengthPct !== null && r.ageHours !== null;
