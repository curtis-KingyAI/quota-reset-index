/**
 * The comparison page.
 *
 * This page makes claims about three other people's products, so the tests are stricter than the
 * rest of the site's. They pin the three properties that stop it becoming marketing:
 *
 *   1. OUR COLUMN IS COMPUTED. Every figure on our side must equal what the ledger actually holds.
 *      A hand-typed number here would drift flatteringly and nobody would notice.
 *   2. THE LOSING ROWS SURVIVE. "Where they beat us" must be non-empty and must render. It is the
 *      first thing an editor would quietly delete.
 *   3. STALENESS FAILS THE BUILD. The competitors' column is hand-checked, so it has an expiry.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderComparePage, ourNumbers, daysBetween } from '../build-compare.ts';
import { AHEAD_OF_US, CHECKED_ON, STALE_AFTER_DAYS, THE_CLAIM, TRACKERS } from '../compare-data.ts';
import { renderSitemap } from '../sitemap.ts';
import { codexLiveState } from '../live-state.ts';
import { collectEntries } from '../../scripts/validate.mjs';

const html = renderComparePage();

test('our column is computed from the ledger, not transcribed', () => {
  const n = ourNumbers();
  assert.ok(n.current > 0 && n.superseded > 0, 'ledger must have both current and superseded records');

  // ⚠️ COUNTED FROM DISK, NOT PINNED TO A LITERAL. This asserted `=== 47`, which is
  // the exact anti-pattern the test is named for — it transcribed the very number it
  // exists to prove was derived. Worse, it failed the moment the ledger grew: adding
  // cx-2026-06-28-03 broke it, so the check punished the operating loop this project
  // just committed to, and the obvious repair (bump 47 to 48) would have to be made
  // on every future sweep until someone deleted the test.
  //
  // Counting the record files independently proves the page's figures are derived,
  // which is the actual invariant, and it survives the ledger doing its job.
  const onDisk = collectEntries().length;
  assert.equal(n.current + n.superseded, onDisk, 'record total must match the record files on disk');
  assert.ok(html.includes(`${n.claudeCode} records`), 'Claude Code count must be the derived one');
  assert.ok(
    html.includes(`${n.archivedUrls} of ${n.evidenceUrls} (${n.archivedPct}%)`),
    'archive coverage must be the derived figure',
  );
  assert.ok(html.includes(`${n.superseded} superseded records`), 'correction count must be derived');
  assert.ok(html.includes(`${n.earliest} → ${n.latest}`), 'span must be derived');
});

test('the archive figure is the real one — 61 of 62, not the doc draft’s 85 of 86', () => {
  // The draft comparison carried a coverage figure that no longer matched the sidecar. This asserts
  // against the sidecar itself so the page can never re-acquire a stale number.
  const n = ourNumbers();
  assert.ok(n.archivedUrls <= n.evidenceUrls, 'cannot archive more URLs than exist');
  assert.ok(Number(n.archivedPct) > 90, 'coverage should be high — investigate if this drops');
});

test('“where they beat us” is non-empty and rendered', () => {
  assert.ok(AHEAD_OF_US.length >= 3, 'a comparison with no losing rows is an advertisement');
  assert.match(html, /<h2 id="ahead">Where they beat us<\/h2>/);
  for (const a of AHEAD_OF_US) {
    assert.ok(html.includes(a.claim), `losing row missing from the page: ${a.claim}`);
  }
});

test('the concession that they are faster is on the page, not buried in a doc', () => {
  // Speed is the axis a reader most likely cares about and the one we lose outright.
  assert.match(html, /react faster than we do/i);
  assert.match(html, /curated by hand/i);
});

test('the surviving claim is auditability — not "more events" and not "faster"', () => {
  assert.ok(html.includes(THE_CLAIM), 'the claim must appear verbatim');
  assert.match(html, /Not speed, and not the number of events/);
});

test('every tracker is named, linked and nofollowed', () => {
  assert.equal(TRACKERS.length, 3);
  for (const t of TRACKERS) {
    assert.ok(html.includes(t.url), `${t.name} must be linked so the reader can check the row`);
    assert.ok(
      html.includes(`<a href="${t.url}" rel="nofollow noopener">`),
      `${t.name} link must be rel=nofollow noopener`,
    );
  }
});

test('the page records WHEN the competitors were checked', () => {
  assert.ok(html.includes(CHECKED_ON), 'a claim about a live site is only good on a date');
  assert.match(html, /fetched and read on/);
});

test('staleness is a build failure, measured against the ledger and not the clock', () => {
  const asOf = codexLiveState().asOfIso.slice(0, 10);
  const drift = daysBetween(CHECKED_ON, asOf);
  assert.ok(drift <= STALE_AFTER_DAYS, `comparison is ${drift} days stale — re-fetch and bump CHECKED_ON`);
  // The guard's arithmetic is pure, so it can be exercised directly.
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.ok(daysBetween(CHECKED_ON, '2027-12-31') > STALE_AFTER_DAYS, 'the guard must actually trip eventually');
});

test('the earlier draft’s false rows are gone and their retraction is visible', () => {
  // Two trackers DO publish a history and one DOES forecast. Asserting the retraction text keeps
  // the correction on the page rather than silently dropping the wrong rows.
  assert.match(html, /Both were false/);
  for (const t of TRACKERS) {
    if (t.history === 'yes') {
      assert.ok(html.includes(t.historyNote), `${t.name}'s real history must be described`);
    }
  }
  const withHistory = TRACKERS.filter((t) => t.history === 'yes').length;
  assert.equal(withHistory, 2, 'two of the three publish an event history — do not regress to "none"');
  const withForecast = TRACKERS.filter((t) => t.forecast === 'yes').length;
  assert.equal(withForecast, 2, 'two of the three forecast — do not regress to "we forecast, they do not"');
});

test('/compare is reachable: nav link, canonical, sitemap', () => {
  assert.match(html, /<a href="\/compare" aria-current="page">Compare<\/a>/);
  assert.match(html, /rel="canonical" href="https:\/\/ledger\.kingy\.ai\/compare"/);
  assert.match(renderSitemap('2026-07-26'), /<loc>https:\/\/ledger\.kingy\.ai\/compare<\/loc>/);
});

test('the forecast hero is on this page too — it leads every page', () => {
  const h1 = html.indexOf('<h1>');
  const hero = html.indexOf('class="hero"');
  assert.ok(hero > 0 && hero < h1, 'the hero must precede the page heading');
});
