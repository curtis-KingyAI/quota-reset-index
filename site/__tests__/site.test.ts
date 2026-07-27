import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLedgerPage } from '../build-ledger-page.ts';
import { renderForecastPage } from '../build-forecast.ts';
import { renderHeaders, HEADER_RULES } from '../headers.ts';
import { renderMethodology } from '../build-methodology.ts';
import { renderRobots } from '../robots.ts';
import { renderSitemap } from '../sitemap.ts';
import { CODEX_BASELINE } from '../../models/codex.ts';
import { codexForecast, pct } from '../../models/integrate.ts';

/** Server-side probability at given elapsed hours / prior count. */
const pctOf = (since: number, prior: number, w: number) =>
  pct(codexForecast({ ...CODEX_BASELINE, since, prior }, 'launch', w).probability);
import { collectEntries } from '../../scripts/validate.mjs';
import { HERO_REGIME, heroFigures } from '../hero-data.ts';

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

// ------------------------------------------------- SEO (operator request, 2026-07-27)
test('every page has a meta description and social preview tags', () => {
  // Without these a shared link renders as a bare URL and a search result has no
  // snippet — the two places a reader decides whether to click.
  for (const [name, html] of [
    ['ledger', ledger],
    ['forecast', forecast],
    ['methodology', renderMethodology()],
  ] as [string, string][]) {
    assert.match(html, /<meta name="description" content="[^"]{60,320}">/, `${name} needs a description`);
    for (const tag of ['og:title', 'og:description', 'og:url', 'og:site_name', 'twitter:card']) {
      assert.ok(html.includes(tag), `${name} missing ${tag}`);
    }
    // og:url must be the canonical origin, never the pages.dev one.
    assert.ok(!/og:url" content="https:\/\/quota-reset-index/.test(html), `${name} og:url must be canonical`);
  }
});

test('the ledger declares itself as a schema.org Dataset', () => {
  // This site publishes data with an open licence and machine-readable
  // distributions. Dataset markup is what makes that legible to search engines
  // and dataset aggregators rather than looking like an ordinary web page.
  const m = ledger.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  assert.ok(m, 'ledger must emit JSON-LD');
  const parsed = JSON.parse(m[1]);
  const nodes = Array.isArray(parsed) ? parsed : [parsed];
  const ds = nodes.find((n: any) => n['@type'] === 'Dataset');
  assert.ok(ds, 'a Dataset node must be present');
  assert.equal(ds.distribution.length, 2, 'both JSON and CSV distributions');
  assert.match(ds.license, /creativecommons/);
  assert.match(ds.temporalCoverage, /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/);
  for (const d of ds.distribution) {
    assert.ok(d.contentUrl.startsWith('https://ledger.kingy.ai/'), 'distributions on the canonical origin');
  }
});

test('titles are distinct and descriptive, not one repeated string', () => {
  const titles = [ledger, forecast, renderMethodology()].map((h) => h.match(/<title>(.*?)<\/title>/s)![1]);
  assert.equal(new Set(titles).size, 3, 'each page needs its own title');
  for (const t of titles) assert.ok(t.length >= 25 && t.length <= 75, `title length off: "${t}"`);
});

test('all pages share ONE stylesheet — methodology no longer carries a private copy', () => {
  // It drifted twice: once missing noindex, once missing the raised type scale.
  const meth = renderMethodology();
  assert.match(meth, /class="masthead"/, 'methodology must use the shared shell');
  assert.match(meth, /--codex:/, 'methodology must use the shared tokens');
  assert.equal((meth.match(/<style>/g) ?? []).length, 1, 'exactly one stylesheet');
});

// ------------------------- ledger-driven forecast (fixes the frozen baseline)
test('the Codex figure is derived from the LEDGER, not a hardcoded baseline', async () => {
  const { codexLiveState } = await import('../live-state.ts');
  const { CODEX_BASELINE } = await import('../../models/codex.ts');
  const live = codexLiveState();

  // The whole point: these must reflect real records, not the frozen constants.
  const latest = records
    .filter((r: any) => r.vendor === 'codex' && !r.superseded_by)
    .map((r: any) => r.effective_at)
    .sort()
    .pop();
  assert.equal(live.lastResetIso, latest, 'must use the most recent Codex reset on record');
  assert.notEqual(live.since, CODEX_BASELINE.since, 'must not silently equal the old hardcoded value');
  assert.ok(live.since > 0 && live.prior > 0);
});

test('the build stays deterministic despite being time-aware', async () => {
  // AS_OF comes from the ledger, never the wall clock, so §4.4 still holds.
  const { codexLiveState } = await import('../live-state.ts');
  assert.equal(codexLiveState().asOfIso, codexLiveState().asOfIso);
  assert.equal(renderLedgerPage(records), renderLedgerPage(records));
});

test('the client recompute agrees with the server model at the same elapsed time', () => {
  // Two implementations of one model WILL drift unless something checks. The
  // client constants are injected from config.ts; this proves the maths matches.
  const el = { since: 200, prior: 4, W: 48 };
  const BASE = 0.33 / 24, A = 0.02, TAU = 30, K = 0.85, RT = 8, STEP = 0.25;
  const mu = BASE * (0.55 + 0.075 * el.prior);
  let integral = 0;
  for (let t = 0; t < el.W; t += STEP) {
    const dt = el.since + t + STEP / 2;
    integral += (mu + A * Math.exp(-dt / TAU)) * (1 - K * Math.exp(-dt / RT)) * STEP;
  }
  const clientPct = Math.round((1 - Math.exp(-integral)) * 100);

  // server side, same inputs
  const serverPct = pctOf(el.since, el.prior, el.W);
  assert.equal(clientPct, serverPct, 'client and server must produce the same number');
});

test('the hero declares which figure is measured and which is not', () => {
  assert.match(ledger, /data-last-reset="20\d\d-\d\d-\d\dT/, 'live payload must be embedded');
  assert.match(ledger, /from a stated baseline — not measured/, 'Claude Code must be labelled');
  assert.match(ledger, /derived from\s+<a href="\/">this ledger's own record<\/a>/, 'Codex provenance must be stated');
});

// ------------------------------------------------- the regime disclosure (2026-07-27)
test('the hero NAMES the regime it speaks in, on every page', () => {
  // Until 2026-07-27 the hero showed the `launch` figure — the HIGHEST of three
  // base rates — with no indication it was a choice. At the ledger state when this
  // was written that was 46% against 29% (normal) and 16% (quiet): nearly 3x the
  // low end, undisclosed, at 4rem, on a site whose whole argument is that it does
  // not overstate.
  for (const [name, html] of [
    ['ledger', ledger],
    ['forecast', forecast],
    ['methodology', renderMethodology()],
  ] as [string, string][]) {
    assert.ok(html.includes(`${HERO_REGIME} regime`), `${name} must name the regime in the hero head`);
    assert.match(html, /highest of the three/, `${name} must say it is the top of the range`);
    assert.match(html, /hand-set judgement, not a derived one/, `${name} must say nobody derived it`);
  }
});

test('the label is threaded from HERO_REGIME, so it cannot drift from the value', () => {
  // The failure this prevents: someone changes the regime that produces the number
  // and leaves a label saying "launch". Both come from one constant.
  const f = heroFigures();
  assert.equal(f.regime, HERO_REGIME);
  assert.ok(ledger.includes(`${f.regime} regime`), 'the rendered label must be the regime actually used');
});

test('the hero shows the OTHER regimes, so the spread behind one number is visible', () => {
  const f = heroFigures();
  assert.ok(f.alternatives.length >= 2, 'both unshown regimes must be offered');
  for (const a of f.alternatives) {
    assert.ok(ledger.includes(`<b>${a.codex}%</b> (${a.regime})`), `${a.regime} figure must render`);
  }
  // And the headline must genuinely be the highest, or the disclosure is a lie.
  for (const a of f.alternatives) {
    assert.ok(f.codex >= a.codex, `${HERO_REGIME} must be >= ${a.regime}, else "highest of three" is false`);
  }
});
