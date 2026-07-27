/**
 * The as-of anchor and the coverage span.
 *
 * WHY THESE ARE PINNED. A hand-curated ledger's headline number is only honest if a reader can see
 * what period it covers and when it was last touched. Both are DERIVED from the records — a
 * transcribed span goes stale the first time an event is added, which is the same class of defect
 * as the frozen `since: 38` baseline this project already shipped once and had to fix.
 *
 * The direction-of-error assertion is the load-bearing one. Disclosure alone is not enough: a stale
 * ledger must make the published figure read LOW, never high, so the failure mode is understatement.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLedgerPage } from '../build-ledger-page.ts';
import { renderForecastPage } from '../build-forecast.ts';
import { renderMethodology } from '../build-methodology.ts';
import { codexLiveState, coverageSpan } from '../live-state.ts';
import { collectEntries } from '../../scripts/validate.mjs';

const records = collectEntries().map((e: any) => JSON.parse(e.raw));
const html = renderLedgerPage(records);

test('the hero states the coverage span, derived from the ledger', () => {
  const span = coverageSpan();
  assert.match(html, /<p class="hero-asof">/);
  assert.ok(html.includes(`Ledger covers <strong>${span.label}</strong>`), 'hero must state the span');
  assert.ok(span.earliest <= span.latest, 'span must not be inverted');
  // Derived, not transcribed: the endpoints have to be real record dates.
  assert.match(span.earliest, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(span.latest, /^\d{4}-\d{2}-\d{2}$/);
});

test('the static figure is anchored to the ledger observed_at, not the wall clock', () => {
  const { asOfIso } = codexLiveState();
  assert.ok(html.includes(`datetime="${asOfIso}"`), 'as-of must be the ledger-derived anchor');
  assert.ok(
    html.includes(`${asOfIso.slice(0, 16).replace('T', ' ')} UTC`),
    'the anchor must also be readable, not machine-only',
  );
});

test('the hero states the DIRECTION of staleness — a missing reset reads low, not high', () => {
  assert.match(
    html,
    /reads\s*<em>low<\/em>, not high/,
    'understatement is the safe failure; the page must say which way it fails',
  );
});

test('every page carries the coverage span in the masthead', () => {
  const { label } = coverageSpan();
  for (const [name, rendered] of [
    ['ledger', html],
    ['forecast', renderForecastPage()],
    ['methodology', renderMethodology()],
  ] as const) {
    assert.ok(rendered.includes(`Covers <strong>${label}</strong>`), `${name} masthead is missing the span`);
  }
});

test('the labelling sits BELOW the numbers — the forecast stays the most salient thing', () => {
  // Curtis asked for the forecast at the top of every page and easy to read. A caveat paragraph
  // wedged between the heading and the figures pushes them down the fold, so ordering here is a
  // requirement, not a style preference.
  const nums = html.indexOf('class="hero-nums"');
  const asof = html.indexOf('class="hero-asof"');
  assert.ok(nums > 0 && asof > 0, 'both blocks must render');
  assert.ok(nums < asof, 'the numbers must precede the provenance line');
});
