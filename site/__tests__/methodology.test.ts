import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMethodology } from '../build-methodology.ts';
import { ALPHA, TAU, CODEX_WEIGHTS, CALIBRATION_BANNER, BASE } from '../../models/config.ts';

const html = renderMethodology();

test('§7.3 — the calibration banner is rendered, unhidden, adjacent to the numbers', () => {
  assert.ok(html.includes(CALIBRATION_BANNER), 'banner text must appear verbatim');
  const bannerAt = html.indexOf('class="banner"');
  const firstWeightAt = html.indexOf('Codex evidence weights');
  assert.ok(bannerAt > 0 && bannerAt < firstWeightAt, 'banner must precede the weights, not follow them');
  assert.ok(!/display\s*:\s*none|hidden|<details/.test(html), 'banner must not be hideable');
});

test('the weights table is GENERATED from config, not transcribed', () => {
  // If someone changes a constant, this page must change with it.
  assert.ok(html.includes(String(ALPHA)), 'ALPHA must appear');
  assert.ok(html.includes(`${TAU}h`), 'TAU must appear');
  assert.ok(html.includes(String(CODEX_WEIGHTS.tibo.w)), 'codex tibo weight must appear');
  assert.ok(html.includes((BASE.launch.codex * 24).toFixed(2)), 'launch base rate must appear');
});

test('the page is schema-independent — it reads no ledger record', () => {
  const src = renderMethodology.toString();
  assert.ok(!/ledger\//.test(src), 'must not read the ledger directory');
  for (const id of ['cx-2026', 'cc-2026']) assert.ok(!html.includes(id), `must not embed record id ${id}`);
});

test('it states plainly that there is no sentinel and why', () => {
  assert.match(html, /There is no sentinel/);
  assert.match(html, /or rate limits/);
  assert.match(html, /cannot establish that the vendor granted/);
});

test('it discloses the audit rather than hiding it', () => {
  assert.match(html, /24 of 29 records/);
});

test('the unreachable X-derived terms are labelled as such', () => {
  assert.match(html, /UNREACHABLE in v1/);
});

test('output is well-formed enough to serve: tags balance', () => {
  for (const tag of ['table', 'tr', 'td', 'pre', 'h2']) {
    const open = (html.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    assert.equal(open, close, `<${tag}> tags unbalanced: ${open} open, ${close} close`);
  }
});
