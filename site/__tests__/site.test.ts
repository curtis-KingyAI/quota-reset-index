import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLedgerPage } from '../build-ledger-page.ts';
import { renderForecastPage } from '../build-forecast.ts';
import { renderHeaders, HEADER_RULES } from '../headers.ts';
import { renderMethodology } from '../build-methodology.ts';
import { renderRobots } from '../robots.ts';
import { renderSitemap } from '../sitemap.ts';
import { collectEntries } from '../../scripts/validate.mjs';

const records = collectEntries().map((e: any) => JSON.parse(e.raw));
const ledger = renderLedgerPage(records);
const forecast = renderForecastPage();

test('superseded records are VISIBLE and traceable, not hidden', () => {
  const dead = records.filter((r: any) => r.superseded_by !== null);
  assert.ok(dead.length > 0, 'fixture check: there should be superseded records');
  for (const r of dead) {
    assert.ok(ledger.includes(`id="${r.id}"`), `${r.id} must be rendered, not dropped`);
    assert.ok(ledger.includes(`href="#${r.superseded_by}"`), `${r.id} must link to what replaced it`);
  }
  // ...and the replacement links back, so the chain is walkable in both directions.
  assert.match(ledger, /← replaces/);
});

test('field_support is rendered per row, so an unattested value cannot pass as attested', () => {
  const withSupport = records.filter((r: any) => r.field_support);
  assert.ok(withSupport.length > 0);
  for (const kind of ['attested', 'inferred', 'unestablished']) {
    assert.ok(ledger.includes(`sup-${kind}`), `marker for "${kind}" must appear`);
  }
  // An unestablished field must read as such, not as a blank cell.
  assert.match(ledger, /class="unset">not established</);
});

test('every filter §8 asks for is present', () => {
  for (const f of ['f-vendor', 'f-kind', 'f-trigger', 'f-confidence']) {
    assert.ok(ledger.includes(`id="${f}"`), `missing filter ${f}`);
  }
});

test('every record links to its evidence', () => {
  for (const r of records) {
    for (const e of r.evidence) {
      assert.ok(ledger.includes(`href="${e.url.replace(/&/g, '&amp;')}"`), `${r.id} must link ${e.url}`);
    }
  }
});

test('§7.3 — the banner precedes every forecast number', () => {
  const banner = forecast.indexOf('id="calibration-banner"');
  const firstNum = forecast.search(/<td class="num">\d+%/);
  assert.ok(banner > 0, 'banner must exist');
  assert.ok(firstNum > banner, 'no forecast number may precede the banner');
});

test('§8 — no page makes a runtime network call or captures input', () => {
  for (const [name, html] of [['ledger', ledger], ['forecast', forecast]] as const) {
    assert.ok(!/fetch\s*\(|XMLHttpRequest|EventSource|sendBeacon/.test(html), `${name} must not call out`);
    assert.ok(!new RegExp('<script[^>]+src=|<' + 'link[^>]+rel="(?:stylesheet|preload|preconnect|dns-prefetch)"[^>]+href="https?:').test(html),
      `${name} must not load third-party assets (rel="canonical" is metadata, not a fetch)`);
    assert.ok(!/<form|type="email"/.test(html), `${name} must not capture input — no email capture in v1`);
  }
});

test('the CORS contract is emitted and covers both data endpoints', () => {
  const h = renderHeaders();
  for (const p of ['/ledger.json', '/ledger.csv']) {
    assert.ok(h.includes(p), `${p} must have a header rule`);
    const rule = HEADER_RULES.find((r) => r.path === p)!;
    assert.equal(rule.headers['Access-Control-Allow-Origin'], '*');
    assert.match(rule.headers['Cache-Control'], /max-age/);
  }
  // The file only works on some hosts; it must say so rather than imply coverage.
  assert.match(h, /INERT on other hosts/);
});

test('the ledger page states the audit rather than presenting a clean face', () => {
  assert.match(ledger, /24 of 29 records/);
});

test('EVERY page emits a canonical link to the canonical origin', () => {
  // The same bytes are served from ledger.kingy.ai AND quota-reset-index.pages.dev.
  // Without this, every page exists twice to a crawler and the wrong hostname can win.
  for (const [name, html] of [
    ['ledger', ledger],
    ['forecast', forecast],
    ['methodology', renderMethodology()],
  ] as [string, string][]) {
    assert.match(html, /<link rel="canonical" href="https:\/\/ledger\.kingy\.ai/, `${name} must declare its canonical URL`);
  }
  // ...and each points at its OWN path, not all at the root.
  assert.match(forecast, /rel="canonical" href="https:\/\/ledger\.kingy\.ai\/forecast"/);
  assert.match(renderMethodology(), /rel="canonical" href="https:\/\/ledger\.kingy\.ai\/methodology"/);
});

test('noindex is available as an explicit opt-out, and is OFF by default', () => {
  // Default flipped 2026-07-27 once the canonical domain went live. The old
  // noindex default protected a staging-only origin; keeping it would have
  // shipped the real site telling crawlers to ignore it.
  assert.ok(!/content="noindex/.test(ledger), 'default build must be indexable');
  assert.ok(!/content="noindex/.test(forecast), 'default build must be indexable');
});

test('robots.txt agrees with the meta tag', () => {
  // These two must never disagree: a crawler getting "allow" from one and
  // "noindex" from the other is the worst of both.
  const r = renderRobots();
  const indexable = !/content="noindex/.test(ledger);
  if (indexable) {
    assert.match(r, /Allow: \//);
    assert.match(r, /Sitemap: https:\/\/ledger\.kingy\.ai\/sitemap\.xml/);
    assert.ok(!/Disallow: \//.test(r), 'must not disallow while pages are indexable');
  } else {
    assert.match(r, /Disallow: \//);
  }
});

test('the sitemap lists only the CANONICAL origin', () => {
  // A sitemap advertising the pages.dev hostname would fight the canonical tags
  // sitting beside it.
  const xml = renderSitemap('2026-07-27');
  assert.ok(!/pages\.dev/.test(xml), 'sitemap must not reference the staging origin');
  for (const p of ['/', '/forecast', '/methodology']) {
    assert.ok(xml.includes(`https://ledger.kingy.ai${p}<`), `sitemap must list ${p}`);
  }
});
