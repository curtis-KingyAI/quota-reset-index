/**
 * SEO and social metadata.
 *
 * Separated from layout so the head is auditable in one place rather than
 * scattered through template strings.
 *
 * The structured data matters more here than on a typical site: this publishes a
 * dataset with an open licence and machine-readable distributions, and
 * schema.org/Dataset is what makes that legible to search engines and to dataset
 * aggregators. A site whose entire pitch is "check our work" should be
 * discoverable as data, not just as pages.
 */

import { CANONICAL_ORIGIN, esc } from './layout.ts';

export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  /** Emit schema.org/Dataset markup. Only true for the ledger itself. */
  dataset?: { records: number; evidence: number; earliest: string; latest: string };
}

export const SITE_NAME = 'Quota Reset Index';

/** Rendered into <head>. Keep every absolute URL on the canonical origin. */
export function seoHead(o: SeoOptions): string {
  const url = `${CANONICAL_ORIGIN}${o.path}`;
  const parts = [
    `<meta name="description" content="${esc(o.description)}">`,
    `<link rel="canonical" href="${url}">`,
    // Open Graph — without these a shared link renders as a bare URL.
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(o.title)}">`,
    `<meta name="twitter:description" content="${esc(o.description)}">`,
    `<meta name="theme-color" content="#12161a">`,
  ];

  const ld: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: CANONICAL_ORIGIN,
      description: o.description,
    },
  ];

  if (o.dataset) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: SITE_NAME,
      description:
        'An append-only, evidence-linked record of discretionary AI quota resets by OpenAI (Codex) and ' +
        'Anthropic (Claude Code). Every record cites its sources and carries a confidence grade.',
      url: CANONICAL_ORIGIN,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      isAccessibleForFree: true,
      creator: { '@type': 'Organization', name: 'Kingy AI', url: 'https://kingy.ai' },
      temporalCoverage: `${o.dataset.earliest}/${o.dataset.latest}`,
      variableMeasured: [
        'discretionary quota reset events',
        'evidence sources per event',
        'confidence grade',
        'scope provenance',
      ],
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/json',
          contentUrl: `${CANONICAL_ORIGIN}/ledger.json`,
        },
        {
          '@type': 'DataDownload',
          encodingFormat: 'text/csv',
          contentUrl: `${CANONICAL_ORIGIN}/ledger.csv`,
        },
      ],
    });
  }

  parts.push(`<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld)}</script>`);
  return parts.join('\n');
}

/** Page descriptions. Written for a human reading a result, not for a keyword count. */
export const DESCRIPTIONS = {
  ledger:
    'Every discretionary AI quota reset we can evidence — OpenAI Codex and Anthropic Claude Code. ' +
    'Sourced, append-only, and free to download as JSON or CSV.',
  forecast:
    'Probability of the next discretionary quota reset for Codex and Claude Code, from a self-exciting ' +
    'model and a renewal hazard. Uncalibrated and clearly labelled as such.',
  methodology:
    'The formulas, weights and evidence rules behind the Quota Reset Index — including what it cannot ' +
    'do and how the sentinel would fail.',
} as const;
