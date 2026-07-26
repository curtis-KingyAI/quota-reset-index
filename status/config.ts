/**
 * Status feed configuration.
 *
 * ⚠️ The spec (§3.3, §6) names status.anthropic.com. It 302-redirects to
 * status.claude.com — observed in Phase 0. The resolved host is used here
 * deliberately: a silent redirect is a dependency you cannot see in a log.
 *
 * ⚠️ The spec's §6 opens "Both vendors run Atlassian Statuspage." That is FALSE
 * for OpenAI, also established in Phase 0. Anthropic is genuine Statuspage
 * (AtlassianEdge, x-statuspage-version header, short page id). OpenAI serves a
 * Statuspage-SHAPED payload from Vercel with no Statuspage headers, a ULID page
 * id, a reduced component schema, and NO `incidents` or `scheduled_maintenances`
 * keys at all. Everything downstream must therefore treat every field beyond
 * `status.indicator` as optional.
 */

export type Vendor = 'codex' | 'claude-code';

export interface FeedConfig {
  vendor: Vendor;
  /** The URL actually fetched, after any redirect observed in Phase 0. */
  url: string;
  /** What the spec said, kept so the divergence stays visible in code. */
  specUrl: string;
  label: string;
}

export const FEEDS: FeedConfig[] = [
  {
    vendor: 'codex',
    url: 'https://status.openai.com/api/v2/summary.json',
    specUrl: 'https://status.openai.com/api/v2/summary.json',
    label: 'OpenAI',
  },
  {
    vendor: 'claude-code',
    url: 'https://status.claude.com/api/v2/summary.json',
    specUrl: 'https://status.anthropic.com/api/v2/summary.json',
    label: 'Claude',
  },
];

/** §6: poll interval. Ten minutes, and nothing tighter. */
export const POLL_INTERVAL_MS = 10 * 60 * 1000;

/** §6: consecutive failures before a feed is marked degraded in the UI. */
export const DEGRADED_AFTER_FAILURES = 3;

/** Fetch timeout. A hung feed must degrade, not block the poll cycle. */
export const FETCH_TIMEOUT_MS = 20_000;
