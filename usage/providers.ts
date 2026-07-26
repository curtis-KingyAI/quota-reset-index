/**
 * Concrete usage providers.
 *
 * ⚠️ THERE IS DELIBERATELY NO OAUTH-ENDPOINT PROVIDER IN THIS FILE.
 *
 * §5.1 required the operator to confirm he had read the terms and was comfortable
 * with a public product deriving from api.anthropic.com/api/oauth/usage. On
 * 2026-07-26 he declined, explicitly: no stability contract, risk transfers to end
 * users, and it compromises the editorial-independence position.
 *
 * Writing one anyway "just so it's ready" would be building the thing that was
 * refused. If an internal-only variant is ever authorised it slots in here as
 * another UsageProvider with `supported: false`, and the resolver below will
 * already refuse to let it reach a public surface.
 */

import {
  UNKNOWN_READING,
  type ProviderCapabilities,
  type UsageProvider,
  type UsageReading,
} from './provider.ts';

/**
 * Operator-entered values. The §5.1 fallback: "The forecast surface must render
 * correctly with the sentinel offline, falling back to operator-entered
 * utilization." Always available, never wrong about its own provenance.
 */
export class OperatorProvider implements UsageProvider {
  readonly id = 'operator';
  readonly capabilities: ProviderCapabilities = {
    weeklyUtilization: true,
    recycleTiming: true,
    passiveObservation: true,
    // A human typing a number is not an integration, but it IS a supported input.
    supported: true,
  };

  // Explicit fields rather than TS parameter properties: Node's strip-only mode
  // rejects those, since they emit code rather than only erasing types.
  readonly #weeklyUtilizationPct: number;
  readonly #hoursSinceRecycle: number;

  constructor(weeklyUtilizationPct: number, hoursSinceRecycle: number) {
    if (weeklyUtilizationPct < 0 || weeklyUtilizationPct > 100) {
      throw new RangeError(`weeklyUtilizationPct must be 0-100, got ${weeklyUtilizationPct}`);
    }
    if (hoursSinceRecycle < 0) throw new RangeError(`hoursSinceRecycle must be >= 0, got ${hoursSinceRecycle}`);
    this.#weeklyUtilizationPct = weeklyUtilizationPct;
    this.#hoursSinceRecycle = hoursSinceRecycle;
  }

  describe(): string {
    return 'Operator-entered. Not measured — a human typed these values.';
  }

  async read(now: Date): Promise<UsageReading> {
    return {
      weeklyUtilizationPct: this.#weeklyUtilizationPct,
      hoursSinceRecycle: this.#hoursSinceRecycle,
      observedAt: now.toISOString(),
      provenance: 'operator',
      providerId: this.id,
      note: null,
    };
  }
}

/**
 * The honest null. Used when no measurement source is authorised or reachable.
 * Exists as a real provider rather than as a null check so that "we do not know"
 * is a first-class, renderable state instead of an absence someone forgets to handle.
 */
export class UnavailableProvider implements UsageProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities = {
    weeklyUtilization: false,
    recycleTiming: false,
    passiveObservation: false,
    supported: true,
  };

  readonly #reason: string;

  constructor(reason: string, id = 'unavailable') {
    this.#reason = reason;
    this.id = id;
  }

  describe(): string {
    return `No usage measurement available: ${this.#reason}`;
  }

  async read(now: Date): Promise<UsageReading> {
    return UNKNOWN_READING(this.id, now, this.#reason);
  }
}

/** The specific unavailability this project is in, stated once. */
export const NO_SUPPORTED_TELEMETRY = new UnavailableProvider(
  'no supported channel exposes Claude Code subscription quota state; the undocumented OAuth endpoint was declined by the operator on 2026-07-26',
  'no-supported-telemetry',
);

export interface ResolveOptions {
  /** True when the reading may reach a public surface. */
  publicSurface: boolean;
}

export interface Resolution {
  provider: UsageProvider;
  reading: UsageReading;
  /** Providers that were skipped, and why. Rendered on the methodology page. */
  skipped: { id: string; why: string }[];
}

/**
 * Pick a provider, in order, and read from it.
 *
 * The one rule with teeth: on a PUBLIC surface an unsupported provider is skipped
 * outright, whatever it could tell us. That is the §5.1 decision expressed as
 * code rather than as a comment, so an internal-only source cannot leak into the
 * public product by someone reordering a list.
 */
export async function resolveUsage(
  providers: UsageProvider[],
  now: Date,
  opts: ResolveOptions,
): Promise<Resolution> {
  const skipped: { id: string; why: string }[] = [];

  for (const p of providers) {
    if (opts.publicSurface && !p.capabilities.supported) {
      skipped.push({ id: p.id, why: 'unsupported source, and this is a public surface' });
      continue;
    }
    let reading: UsageReading;
    try {
      reading = await p.read(now);
    } catch (e) {
      skipped.push({ id: p.id, why: `read threw: ${(e as Error).message}` });
      continue;
    }
    if (reading.weeklyUtilizationPct === null) {
      skipped.push({ id: p.id, why: reading.note ?? 'returned no utilisation' });
      continue;
    }
    return { provider: p, reading, skipped };
  }

  return { provider: NO_SUPPORTED_TELEMETRY, reading: await NO_SUPPORTED_TELEMETRY.read(now), skipped };
}
