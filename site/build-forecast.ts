/**
 * Generates public/forecast.
 *
 * STATIC, and deliberately not interactive. The prototype had sliders; this page
 * does not, for a reason worth stating rather than hiding: there is no live usage
 * telemetry and there will not be (Phase 2 closed). Sliders would imply the page
 * is reading something. It is reading a hand-entered baseline, and it says so.
 *
 * §7.3 is enforced structurally: renderWindowTable() cannot emit a probability
 * without the banner id being present on the page, and a test asserts the banner
 * appears before the first number.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODEX_BASELINE } from '../models/codex.ts';
import { CLAUDE_BASELINE, calendarLabel } from '../models/claudeCode.ts';
import { claudeForecast, codexForecast, pct } from '../models/integrate.ts';
import { CALIBRATION_BANNER, type Regime } from '../models/config.ts';
import { esc, forecastHero, page } from './layout.ts';
import { heroFigures } from './hero-data.ts';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The clock is PINNED and stated. The Claude Code model has a day-of-week
 * calendar term, so an unstated clock would make these numbers unreproducible —
 * which is exactly the failure the §7.2 golden tests exist to prevent.
 */
const PINNED = new Date('2026-07-07T12:00:00Z'); // Tuesday, ordinary weekday hour
const WINDOWS = [12, 24, 48, 72] as const;
const REGIMES: Regime[] = ['quiet', 'normal', 'launch'];

export function renderForecastPage(): string {
  const row = (regime: Regime) => {
    const cx = WINDOWS.map((w) => pct(codexForecast(CODEX_BASELINE, regime, w).probability));
    const cl = WINDOWS.map((w) => pct(claudeForecast(CLAUDE_BASELINE, regime, PINNED, w).probability));
    return `<tr><td>${regime}</td>${cx.map((v) => `<td class="num">${v}%</td>`).join('')}${cl
      .map((v) => `<td class="num">${v}%</td>`)
      .join('')}</tr>`;
  };

  const sched = WINDOWS.map((w) => pct(claudeForecast(CLAUDE_BASELINE, 'launch', PINNED, w).scheduled.probability));
  const cxL = codexForecast(CODEX_BASELINE, 'launch', 48);
  const clL = claudeForecast(CLAUDE_BASELINE, 'launch', PINNED, 48);

  const body = `
${forecastHero(heroFigures())}
<h1>Forecast</h1>
<p class="lede">Two vendors, two methodologies, because they expose different amounts of state.
These are the less trustworthy half of this project — the <a href="/">ledger</a> is the asset.</p>

<div class="banner" id="calibration-banner">
  ${esc(CALIBRATION_BANNER)}
  <p>No number on this page has been checked against an outcome. There is no Brier score because
  there is no labelled sample to compute one from. Do not put an alert behind these.</p>
</div>

<h2>Probability of at least one discretionary reset</h2>
<p class="lede">At the July 2026 baseline — Codex ${CODEX_BASELINE.since}h since its last reset with
${CODEX_BASELINE.prior} resets in the trailing 14 days; Claude Code ${CLAUDE_BASELINE.since}h since
recycle at ${CLAUDE_BASELINE.util}% weekly utilisation — with no live evidence signals.</p>

<table>
  <thead>
    <tr><th rowspan="2">regime</th><th class="num" colspan="4">Codex</th><th class="num" colspan="4">Claude Code</th></tr>
    <tr>${WINDOWS.map((w) => `<th class="num">${w}h</th>`).join('')}${WINDOWS.map((w) => `<th class="num">${w}h</th>`).join('')}</tr>
  </thead>
  <tbody>${REGIMES.map(row).join('\n')}</tbody>
</table>

<h2>Claude Code's scheduled track</h2>
<p class="lede">Reported separately from the discretionary number, because the vendor gives two
knowable things and they answer different questions. <strong>Do not add them.</strong> The scheduled
recycle rides an observed ~72h cadence; at ${CLAUDE_BASELINE.since}h elapsed the next one is due in
~${(72 - CLAUDE_BASELINE.since).toFixed(0)}h.</p>

<table>
  <thead><tr><th>window</th>${WINDOWS.map((w) => `<th class="num">${w}h</th>`).join('')}</tr></thead>
  <tbody><tr><td>scheduled recycle</td>${sched.map((v) => `<td class="num">${v}%</td>`).join('')}</tr></tbody>
</table>

<h2>Instantaneous rates, launch regime</h2>
<table>
  <thead><tr><th>vendor</th><th class="num">λ (events/hour)</th><th class="num">mean wait</th></tr></thead>
  <tbody>
    <tr><td><span class="pill codex">codex</span></td><td class="num">${cxL.lambdaNow.toFixed(4)}</td><td class="num">${Math.round(cxL.meanWaitHours)}h</td></tr>
    <tr><td><span class="pill claude-code">claude-code</span></td><td class="num">${clL.lambdaNow.toFixed(4)}</td><td class="num">${Math.round(clL.meanWaitHours)}h</td></tr>
  </tbody>
</table>

<h2>What these numbers cannot do</h2>
<p class="lede">Three limits, stated because a percentage sign invites more confidence than this
deserves:</p>
<ul class="lede">
  <li><strong>The clock is pinned to ${esc(PINNED.toISOString())}</strong> (${esc(calendarLabel(PINNED))}).
  Claude Code's figures move with the day of week — the calendar term is the only clock-dependent
  part of either model — so an unpinned page would show numbers nobody could reproduce.</li>
  <li><strong>The evidence terms are inert.</strong> Both models carry a weight for a vendor-employee
  social post. Scraping X is out of scope by decision, so those terms can never rise above zero.
  Treat both models as having one fewer input than the formulas suggest.</li>
  <li><strong>Claude Code's utilisation is hand-entered, not measured.</strong> The sentinel that
  would have measured it was closed — no supported channel exposes subscription quota state, and none
  distinguishes a vendor-wide grant from an ordinary rollover. See
  <a href="/methodology#sentinel">Methodology</a>.</li>
</ul>

<p class="lede">Full formulas, every weight and half-life, and the calibration path are on
<a href="/methodology">Methodology</a>.</p>
`;

  const html = page({ title: 'Forecast — Quota Reset Index', current: 'forecast', body });

  // §7.3, enforced at build time rather than trusted: if a probability reaches the
  // page without the banner preceding it, fail the build rather than publish it.
  // Match a RENDERED forecast cell, not any percentage: the stylesheet contains
  // width:100% and friends, which a naive /\d+%/ would flag. The guard firing on
  // its own CSS was the first thing this check caught.
  const bannerAt = html.indexOf('id="calibration-banner"');
  const firstPct = html.search(/<td class="num">\d+%/);
  if (bannerAt < 0 || (firstPct >= 0 && firstPct < bannerAt)) {
    throw new Error('§7.3 violation: a forecast number precedes the calibration banner');
  }
  return html;
}

function main(): void {
  const out = join(ROOT, 'public');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'forecast.html'), renderForecastPage());
  console.log('built public/forecast');
}

if (isMain(import.meta.url)) main();
