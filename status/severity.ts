/**
 * Indicator -> severity mapping, and the parsing that guards it.
 *
 * THE LOAD-BEARING DECISION IN THIS FILE: an indicator we do not recognise
 * resolves to "unavailable", NOT to 0.
 *
 * The prototype does `sev[j.status?.indicator] ?? 0`, which silently turns a
 * renamed field, a new indicator value, or a malformed body into "everything is
 * fine". §6 forbids exactly that shape of failure — "Never serve a silent stale
 * zero" — and the same reasoning applies to a silent FRESH zero, which is worse
 * because it carries no age to give it away. Severity 0 must mean "the vendor
 * said none", never "we could not tell".
 */

/** §6: none=0, minor=45, major=80, critical=100. */
export const SEVERITY: Readonly<Record<string, number>> = Object.freeze({
  none: 0,
  minor: 45,
  major: 80,
  critical: 100,
});

export interface ParsedStatus {
  ok: true;
  indicator: string;
  severity: number;
  description: string | null;
  /** Present on Anthropic, absent on OpenAI. Never assume it exists. */
  incidentCount: number | null;
  componentCount: number | null;
}

export interface ParseFailure {
  ok: false;
  reason: string;
  /** The raw indicator we saw, when there was one — useful when a vendor adds a value. */
  sawIndicator: string | null;
}

export type ParseResult = ParsedStatus | ParseFailure;

/**
 * Parse a Statuspage-shaped summary body. Every field access is defensive:
 * a schema change degrades to "unavailable", never to a crash and never to a
 * wrong reading.
 */
export function parseSummary(body: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (e) {
    return { ok: false, reason: `body is not valid JSON: ${(e as Error).message}`, sawIndicator: null };
  }

  if (typeof json !== 'object' || json === null) {
    return { ok: false, reason: `body is ${json === null ? 'null' : typeof json}, expected an object`, sawIndicator: null };
  }

  const obj = json as Record<string, unknown>;
  const status = obj.status;
  if (typeof status !== 'object' || status === null) {
    return { ok: false, reason: 'no `status` object in body', sawIndicator: null };
  }

  const indicator = (status as Record<string, unknown>).indicator;
  if (typeof indicator !== 'string') {
    return { ok: false, reason: '`status.indicator` is missing or not a string', sawIndicator: null };
  }

  if (!Object.prototype.hasOwnProperty.call(SEVERITY, indicator)) {
    // A new indicator value. Do NOT guess a number for it.
    return {
      ok: false,
      reason: `unrecognised status.indicator "${indicator}" — refusing to guess a severity`,
      sawIndicator: indicator,
    };
  }

  const description = (status as Record<string, unknown>).description;
  const incidents = obj.incidents;
  const components = obj.components;

  return {
    ok: true,
    indicator,
    severity: SEVERITY[indicator],
    description: typeof description === 'string' ? description : null,
    // OpenAI omits these keys entirely; null means "the feed does not carry it".
    incidentCount: Array.isArray(incidents) ? incidents.length : null,
    componentCount: Array.isArray(components) ? components.length : null,
  };
}
