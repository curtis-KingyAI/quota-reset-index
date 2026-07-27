import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLedgerPage } from '../build-ledger-page.ts';
import { renderForecastPage } from '../build-forecast.ts';
import { renderHeaders, HEADER_RULES } from '../headers.ts';
import { renderMethodology } from '../build-methodology.ts';
import { renderRobots } from '../robots.ts';
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
    assert.ok(!/<script[^>]+src=|<link[^>]+href="https?:/.test(html), `${name} must not load third-party assets`);
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

test('EVERY page carries noindex by default — a staging origin must not be indexable', () => {
  // methodology.html renders its own document rather than using the shared shell,
  // so it silently missed the noindex meta on first implementation. This test is
  // the reason that cannot recur.
  for (const [name, html] of [
    ['ledger', ledger],
    ['forecast', forecast],
    ['methodology', renderMethodology()],
  ] as [string, string][]) {
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/, `${name} must be noindex by default`);
  }
});

test('robots.txt agrees with the meta tag', () => {
  assert.match(renderRobots(), /Disallow: \//);
});

// ------------------------------------- forecast hero (operator decision, 2026-07-27)
test('the forecast hero appears on EVERY page, with its caveat inseparable from it', () => {
  // The hero promotes uncalibrated numbers to the most prominent element on the
  // site. §7.3's requirement therefore binds harder, not softer: a large
  // percentage reads as authoritative, and these have never been checked against
  // an outcome. Numbers and caveat are emitted by one function so a template edit
  // cannot separate them — this test is what keeps that true.
  for (const [name, html] of [
    ['ledger', renderLedgerPage(records)],
    ['forecast', renderForecastPage()],
    ['methodology', renderMethodology()],
  ] as [string, string][]) {
    assert.match(html, /class="hero"/, `${name} must carry the hero`);
    assert.match(html, /class="hero-caveat"/, `${name} hero must carry its caveat`);
    assert.match(html, /<strong>Uncalibrated\.<\/strong>/, `${name} must say Uncalibrated in the hero`);
    assert.match(html, /never been checked against an outcome|not been checked against an outcome|none has been checked against an outcome/i,
      `${name} must state the numbers are unchecked`);

    // The caveat must not be hideable or deferred.
    // NOTE: match the RENDERED element, not the bare class name — "hero-caveat"
    // also appears in the <style> block, which precedes all markup and made an
    // earlier version of this test compare a CSS rule against the section.
    const heroAt = html.indexOf('<section class="hero"');
    const caveatAt = html.indexOf('<p class="hero-caveat"');
    assert.ok(caveatAt > heroAt, `${name}: caveat must sit inside the hero block`);
    assert.ok(!/<details|display:\s*none/.test(html.slice(heroAt, caveatAt + 400)), `${name}: caveat must not be collapsible`);
  }
});

test('the hero appears BEFORE the page heading — it leads, per the operator', () => {
  const html = renderLedgerPage(records);
  assert.ok(html.indexOf('class="hero"') < html.indexOf('<h1>'), 'hero must precede the h1');
});

test('all three pages show the SAME hero figures', () => {
  // One source of truth. A ledger page claiming 55% while the forecast page says
  // something else would undermine both.
  const grab = (h: string) => (h.match(/hero-num[^>]*"><b>(\d+)%/g) ?? []).join('|');
  const a = grab(renderLedgerPage(records));
  assert.ok(a.length > 0, 'hero numbers must render');
  assert.equal(grab(renderForecastPage()), a);
  assert.equal(grab(renderMethodology()), a);
});
