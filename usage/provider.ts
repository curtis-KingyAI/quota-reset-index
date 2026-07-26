/**
 * Usage data, behind an injected provider interface.
 *
 * OPERATOR CONSTRAINT (2026-07-26), and the reason this file looks the way it does:
 *
 *   "Build both with usage data as an injected provider behind an interface.
 *    Do NOT shape that interface around the OAuth endpoint's response schema.
 *    Assume Phase 2 may be redesigned or dropped."
 *
 * So the shape below is derived from WHAT THE MODEL NEEDS, not from what any
 * particular source returns. Concretely, there is deliberately no `seven_day`,
 * no `five_hour`, no `resets_at`, and no nesting mirroring
 * api.anthropic.com/api/oauth/usage. If that endpoint is redesigned or dropped,
 * nothing in this interface has to change.
 *
 * The model needs exactly two quantities and one honest "I don't know":
 *   - how depleted the weekly allowance is  (drives the depletion covariate)
 *   - how long since the last scheduled recycle (drives the scheduled track)
 *   - whether either is actually known
 *
 * Everything else a source might return is that source's business.
 */

/** What a provider can actually do. Makes the coverage gap legible in code, not just prose. */
export interface ProviderCapabilities {
  /** Can it report how much of the weekly allowance is consumed? */
  weeklyUtilization: boolean;
  /** Can it report time since the last scheduled recycle? */
  recycleTiming: boolean;
  /**
   * Can it observe WITHOUT consuming quota? A source that must issue a request
   * to learn the remaining allowance cannot support the "utilisation dropped
   * while the account made no requests" detection rule at all.
   */
  passiveObservation: boolean;
  /** Is this a documented, supported integration, or reverse-engineered? */
  supported: boolean;
}

export type Provenance = 'operator' | 'telemetry' | 'unavailable';

export interface UsageReading {
  /**
   * Percentage of the weekly allowance consumed, 0-100.
   * NULL means unknown. It never means zero — a forecast rendered from a silent
   * zero would claim a fresh quota the operator does not have.
   */
  weeklyUtilizationPct: number | null;
  /** Hours since the last scheduled recycle. Null when unknown. */
  hoursSinceRecycle: number | null;
  /** When this reading was taken. */
  observedAt: string;
  /** Where it came from. Rendered next to any number derived from it. */
  provenance: Provenance;
  /** Which provider produced it. */
  providerId: string;
  /** Why it is unavailable/degraded, when it is. */
  note: string | null;
}

export interface UsageProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  /** One line, rendered on the methodology page so the dependency is never hidden. */
  describe(): string;
  read(now: Date): Promise<UsageReading>;
}

export const UNKNOWN_READING = (providerId: string, now: Date, note: string): UsageReading => ({
  weeklyUtilizationPct: null,
  hoursSinceRecycle: null,
  observedAt: now.toISOString(),
  provenance: 'unavailable',
  providerId,
  note,
});

/** True when a reading carries enough to drive the discretionary model. */
export const isUsable = (r: UsageReading): boolean => r.weeklyUtilizationPct !== null;
