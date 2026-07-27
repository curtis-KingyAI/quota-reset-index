/**
 * Generates public/compare — how this ledger differs from the other Codex reset trackers.
 *
 * OUR OWN COLUMN IS COMPUTED, NOT TYPED. Every figure in the "this project" column is derived from
 * the records on disk at build time. A comparison page that hand-writes its own side is the same
 * defect as a hand-written weights table on /methodology: it drifts the moment the data changes,
 * and it drifts in the flattering direction, because nobody revisits a number that makes them look
 * good. The competitors' column is necessarily hand-checked — hence CHECKED_ON and the staleness
 * guard below.
 *
 * The page is deliberately not a scoreboard. It leads with what the other trackers do WELL and
 * where they beat us, because the single claim being made here is auditability, and a page that
 * cannot be checked is a poor advertisement for a project whose whole pitch is checkability.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEntries } from '../scripts/validate.mjs';
import { bestCapture, urlKey } from '../lib/archive.mjs';
import { esc, forecastHero, page } from './layout.ts';
import { DESCRIPTIONS, seoHead } from './seo.ts';
import { heroFigures } from './hero-data.ts';
import { codexLiveState, coverageSpan } from './live-state.ts';
import { heroScript } from './hero-script.ts';
import { AHEAD_OF_US, CHECKED_ON, STALE_AFTER_DAYS, THE_CLAIM, TRACKERS, type Cell } from './compare-data.ts';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export interface OurNumbers {
  current: number;
  superseded: number;
  codex: number;
  claudeCode: number;
  earliest: string;
  latest: string;
  evidenceUrls: number;
  archivedUrls: number;
  archivedPct: string;
  confidence: Record<string, number>;
}

/** Our side of the table, read off the ledger. */
export function ourNumbers(): OurNumbers {
  const records = collectEntries().map((e: { raw: string }) => JSON.parse(e.raw));
  const current = records.filter((r: any) => r.superseded_by === null);

  const urls = new Set<string>();
  for (const r of current) for (const ev of r.evidence ?? []) if (ev.url) urls.add(ev.url);

  let archived = 0;
  for (const u of urls) {
    const f = join(ROOT, 'archive', `${urlKey(u)}.json`);
    if (existsSync(f) && bestCapture(JSON.parse(readFileSync(f, 'utf8')))) archived++;
  }

  const confidence: Record<string, number> = {};
  for (const r of current) confidence[r.confidence] = (confidence[r.confidence] ?? 0) + 1;

  const span = coverageSpan();
  return {
    current: current.length,
    superseded: records.length - current.length,
    codex: current.filter((r: any) => r.vendor === 'codex').length,
    claudeCode: current.filter((r: any) => r.vendor === 'claude-code').length,
    earliest: span.earliest,
    latest: span.latest,
    evidenceUrls: urls.size,
    archivedUrls: archived,
    archivedPct: urls.size ? ((archived / urls.size) * 100).toFixed(1) : '0.0',
    confidence,
  };
}

const MARK: Record<Cell, string> = {
  yes: '<span class="c-yes" aria-label="yes">✓</span>',
  no: '<span class="c-no" aria-label="no">✗</span>',
  partial: '<span class="c-part" aria-label="partial">◐</span>',
};

const ROWS: {
  label: string;
  /** Emphasised rows are the ones where the answer elsewhere is categorically "not offered". */
  key: keyof typeof TRACKERS[number] & string;
  ours: (n: OurNumbers) => string;
  emphasis?: boolean;
}[] = [
  { label: 'Forecasts the next reset', key: 'forecast', ours: () => `${MARK.yes} two models, labelled uncalibrated` },
  { label: 'Lists past events', key: 'history', ours: (n) => `${MARK.yes} ${n.current} current, ${n.earliest} → ${n.latest}` },
  {
    label: 'Covers Anthropic Claude Code',
    key: 'claudeCode',
    ours: (n) => `${MARK.yes} ${n.claudeCode} records`,
    emphasis: true,
  },
  { label: 'Links a source per event', key: 'sources', ours: (n) => `${MARK.yes} ${n.evidenceUrls} sources` },
  {
    label: 'Archived copies of those sources',
    key: 'archived',
    ours: (n) => `${MARK.yes} ${n.archivedUrls} of ${n.evidenceUrls} (${n.archivedPct}%)`,
    emphasis: true,
  },
  {
    label: 'Confidence graded per event',
    key: 'confidence',
    ours: (n) =>
      `${MARK.yes} ${Object.entries(n.confidence)
        .sort()
        .map(([k, v]) => `${v} ${k}`)
        .join(', ')}`,
    emphasis: true,
  },
  {
    label: 'Corrections visible',
    key: 'corrections',
    ours: (n) => `${MARK.yes} ${n.superseded} superseded records, still on the page`,
    emphasis: true,
  },
  {
    label: 'Machine-readable download',
    key: 'download',
    ours: () => `${MARK.yes} <a href="/ledger.json">JSON</a> and <a href="/ledger.csv">CSV</a>, CC BY 4.0`,
    emphasis: true,
  },
  {
    label: 'Method published with its parameters',
    key: 'methodology',
    ours: () => `${MARK.yes} <a href="/methodology">every weight and half-life</a>, generated from the code`,
  },
];

/** Days between two ISO dates. Pure arithmetic — no clock is read. */
export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

export function renderComparePage(): string {
  const n = ourNumbers();
  const asOf = codexLiveState().asOfIso.slice(0, 10);

  // Staleness is a build failure. A comparison page ageing quietly into falsehood is worse than no
  // comparison, because a reader cannot distinguish a stale row from a dishonest one.
  const drift = daysBetween(CHECKED_ON, asOf);
  if (drift > STALE_AFTER_DAYS) {
    throw new Error(
      `comparison is ${drift} days behind the ledger (limit ${STALE_AFTER_DAYS}). ` +
        'Re-fetch all three sites, correct site/compare-data.ts, then bump CHECKED_ON.',
    );
  }

  const head = (t: (typeof TRACKERS)[number]): string =>
    `<th scope="col"><a href="${t.url}" rel="nofollow noopener">${esc(t.name)}</a></th>`;

  const body = `${forecastHero(heroFigures())}

<h1>Compared with the other reset trackers</h1>
<p class="lede">Three other sites track Codex quota resets. They are good, they are faster than this
one, and two of them have been running longer. Here is what each does, checked by opening them
on ${CHECKED_ON} — and the one thing this project does that none of them offers.</p>

<div class="banner">
  <p class="banner-lead">Read this first, because it is the part most comparison pages leave out.</p>
  <p>An earlier draft of this page said the other trackers had no event history and published no
  forecast. <strong>Both were false</strong>, and both were disproved by opening their sites. Those
  rows are gone. What is left is narrower and it is the only difference that actually held up.</p>
</div>

<h2>What they do</h2>
${TRACKERS.map(
  (t) => `<div class="tracker">
  <h3><a href="${t.url}" rel="nofollow noopener">${esc(t.name)}</a></h3>
  <p>${esc(t.blurb)}</p>
  <ul>
    <li><strong>Forecast:</strong> ${esc(t.forecastNote)}</li>
    <li><strong>History:</strong> ${esc(t.historyNote)}</li>
    <li><strong>Sources:</strong> ${esc(t.sourcesNote)}</li>
    <li><strong>Data:</strong> ${esc(t.downloadNote)}</li>
    <li><strong>Method:</strong> ${esc(t.methodologyNote)}</li>
  </ul>
</div>`,
).join('\n')}

<h2>Side by side</h2>
<p>Entry counts are deliberately absent as a differentiator: they move daily, and on the date checked
two reads of one tracker disagreed about its own total. The rows below are structural, so they stay
true between checks.</p>

<div class="table-scroll">
<table class="compare">
  <thead>
    <tr><th scope="col">&nbsp;</th>${TRACKERS.map(head).join('')}<th scope="col" class="ours">this project</th></tr>
  </thead>
  <tbody>
  ${ROWS.map(
    (r) => `<tr${r.emphasis ? ' class="em"' : ''}>
      <th scope="row">${esc(r.label)}</th>
      ${TRACKERS.map((t) => `<td>${MARK[t[r.key] as Cell]}</td>`).join('')}
      <td class="ours">${r.ours(n)}</td>
    </tr>`,
  ).join('\n')}
  </tbody>
</table>
</div>
<p class="table-key">✓ offered · ◐ described but not published in full · ✗ not offered</p>

<h2 id="ahead">Where they beat us</h2>
<p>Stated plainly, because a comparison with no losing rows is an advertisement.</p>
<ol class="ahead">
${AHEAD_OF_US.map((a) => `  <li><strong>${esc(a.claim)}</strong> ${esc(a.detail)}</li>`).join('\n')}
</ol>

<h2>So what is the actual difference</h2>
<p>Not speed, and not the number of events — we lose the first outright and do not clearly win the
second. It is this:</p>
<blockquote>${esc(THE_CLAIM)}</blockquote>
<p>None of the three grades its confidence, and none shows a correction history, so an error on those
sites leaves no trace. Errors do happen — including here. This ledger carries
<strong>${n.superseded} superseded records</strong>, and both halves of every correction stay on the
page precisely so you can see what we got wrong. That, plus two things nobody else offers at all:
<strong>Claude Code coverage</strong> and <strong>a download</strong>.</p>

<p class="fineprint">All three sites were fetched and read on ${CHECKED_ON}; the ledger figures in the
right-hand column are computed from the records as at ${asOf}. These are live products and their
pages change — if a row here is wrong, it is wrong on our side, and
<a href="https://github.com/curtis-KingyAI/quota-reset-index/issues">the correction belongs in the
issue tracker</a>. Nothing on this page is affiliated with OpenAI or Anthropic.</p>`;

  return page({
    title: 'Codex reset trackers compared',
    path: '/compare',
    current: 'compare',
    coverage: coverageSpan().label,
    body,
    script: heroScript(),
    extraStyles: `
  .tracker { border-left:3px solid var(--rule); padding:.1rem 0 .1rem 1.1rem; margin:1.5rem 0 }
  .tracker h3 { margin:0 0 .3rem; font-size:1.05rem }
  .tracker ul { margin:.5rem 0 0; padding-left:1.1rem }
  .tracker li { margin:.28rem 0 }
  .table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch }
  table.compare { min-width:46rem }
  table.compare th[scope=row] { text-align:left; font-weight:500 }
  table.compare tr.em th[scope=row] { font-weight:700 }
  table.compare td { text-align:center; vertical-align:top }
  table.compare td.ours, table.compare th.ours { text-align:left; font-size:.9rem }
  .c-yes { color:var(--good); font-weight:700 }
  .c-no  { color:var(--faint) }
  .c-part{ color:var(--warn); font-weight:700 }
  .table-key { font-size:.84rem; color:var(--faint); margin-top:.5rem }
  ol.ahead li { margin:.6rem 0 }
  blockquote { border-left:3px solid var(--accent); margin:1.2rem 0; padding:.2rem 0 .2rem 1.1rem; font-size:1.05rem }
  .fineprint { font-size:.84rem; color:var(--faint); margin-top:2rem }`,
    head: seoHead({
      title: 'Codex reset trackers compared — and where they beat us',
      description: DESCRIPTIONS.compare,
      path: '/compare',
    }),
  });
}

function main(): void {
  const out = join(ROOT, 'public');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'compare.html'), renderComparePage());
  console.log('built public/compare');
}

if (isMain(import.meta.url)) main();
