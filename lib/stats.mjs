/**
 * Every published figure about this repository, computed from the repository.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 *
 * `site/build-methodology.ts` already states the principle and applies it to the
 * weights table: "A hand-written table is a second source of truth that silently
 * goes stale the first time a constant changes." The markdown never got the same
 * treatment, and it showed — on 2026-07-27 `README.md` claimed 175 tests and 47
 * records while the repo held 200 and 48, having been corrected by hand THREE HOURS
 * EARLIER in the same session. Anything a human must remember to update goes stale
 * here faster than it can be fixed.
 *
 * So the figures are generated, and `npm run build` plus CI's dirty-tree check turn
 * a stale count into a build failure. No new enforcement was invented; the existing
 * guarantee was extended to the docs.
 *
 * ── WHAT MAY AND MAY NOT GO IN A GENERATED BLOCK ────────────────────────────
 *
 * ⚠️ ONLY FIGURES DERIVED FROM COMMITTED FILES. A generated block is checked by
 * rebuilding and diffing, so it must be a pure function of the tree.
 *
 * The commit count is the trap, and it is excluded for a reason worth recording:
 * `git rev-list --count HEAD` increments on the very commit that writes it, so the
 * block would be stale the instant it landed and the tree could NEVER be clean after
 * a build. Any figure that changes without a source change is disqualified the same
 * way — timestamps, run counters, "last updated" wall-clock dates.
 */

import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEntries } from '../scripts/validate.mjs';
import { loadIndex } from './archive.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Reset primitives, mirroring site/live-state.ts. */
const RESET_EFFECTS = new Set(['global_reset', 'banked_reset']);

const tally = (items, key) =>
  items.reduce((m, x) => {
    const k = key(x);
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

/**
 * Count declared tests WITHOUT running them.
 *
 * Executing the suite from the build would be slow and circular — the tests import
 * the build modules. Counting `test(` at the start of a line is exact for this repo:
 * verified equal to the runtime total (200) at the time this was written.
 *
 * ⚠️ It would UNDERCOUNT tests generated in a loop or declared as `test.skip(`.
 * Nothing here does that; if something starts to, prefer deleting this figure over
 * publishing a wrong one.
 *
 * The glob list is read from package.json so adding a test directory there is the
 * only place that has to change.
 */
export function countTests() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  // Every glob token in the test script, and nothing else — the flags and the
  // binary contain no '*'.
  const patterns = (pkg.scripts?.test ?? '').split(/\s+/).filter((t) => t.includes('*'));
  const files = [...new Set(patterns.flatMap((p) => globSync(p, { cwd: ROOT })))];
  let n = 0;
  for (const f of files) {
    for (const line of readFileSync(join(ROOT, f), 'utf8').split('\n')) {
      if (/^test\(/.test(line)) n++;
    }
  }
  return { count: n, files: files.length };
}

/** Every derived figure, in one object. Pure with respect to the committed tree. */
export function stats() {
  const records = collectEntries().map((e) => JSON.parse(e.raw));
  const current = records.filter((r) => r.superseded_by === null);
  const index = loadIndex();

  const evidenceItems = current.flatMap((r) => r.evidence);
  const uniqueUrls = [...new Set(evidenceItems.map((e) => e.url))];
  const archivedItems = evidenceItems.filter((e) => index.get(e.url)?.best).length;
  const archivedUrls = uniqueUrls.filter((u) => index.get(u)?.best).length;

  const dates = current.map((r) => r.effective_at.slice(0, 10)).sort();
  const byVendorCurrent = tally(current, (r) => r.vendor);
  const byVendorAll = tally(records, (r) => r.vendor);

  const support = { attested: 0, inferred: 0, unestablished: 0 };
  let withoutSupport = 0;
  for (const r of current) {
    if (!r.field_support) {
      withoutSupport++;
      continue;
    }
    for (const v of Object.values(r.field_support)) if (v in support) support[v]++;
  }

  const resetBearing = (vendor) =>
    current.filter((r) => r.vendor === vendor && (r.effects ?? [r.kind]).some((e) => RESET_EFFECTS.has(e))).length;

  return {
    records: { total: records.length, current: current.length, superseded: records.length - current.length },
    vendors: {
      codex: { current: byVendorCurrent.codex ?? 0, total: byVendorAll.codex ?? 0, resetBearing: resetBearing('codex') },
      'claude-code': {
        current: byVendorCurrent['claude-code'] ?? 0,
        total: byVendorAll['claude-code'] ?? 0,
        resetBearing: resetBearing('claude-code'),
      },
    },
    span: { earliest: dates[0], latest: dates[dates.length - 1] },
    confidence: tally(current, (r) => r.confidence),
    effects: tally(
      current.flatMap((r) => r.effects ?? [r.kind]),
      (e) => e,
    ),
    evidence: {
      items: evidenceItems.length,
      uniqueUrls: uniqueUrls.length,
      archivedItems,
      archivedUrls,
      // Rounded DOWN. Publishing 98.8 as "99%" is the kind of flattering rounding
      // this page has no business doing.
      itemsPct: (Math.floor((archivedItems / evidenceItems.length) * 1000) / 10).toFixed(1),
      urlsPct: (Math.floor((archivedUrls / uniqueUrls.length) * 1000) / 10).toFixed(1),
    },
    fieldSupport: { ...support, recordsWithNone: withoutSupport },
    tests: countTests().count,
  };
}

const order = (obj, keys) => keys.filter((k) => obj[k]).map((k) => `${k} ${obj[k]}`);

/** The README table body — the short, reader-facing one. */
export function renderReadmeStats(s = stats()) {
  return [
    '| | |',
    '|---|---|',
    `| Records | **${s.records.total}** — ${s.records.current} current, ${s.records.superseded} superseded |`,
    '| Vendors | OpenAI Codex · Anthropic Claude Code |',
    `| Coverage | ${s.span.earliest} → ${s.span.latest} |`,
    `| Evidence | ${s.evidence.items} cited sources on current records — **${s.evidence.archivedItems} carry a dated archive capture** |`,
    `| | (those resolve to ${s.evidence.uniqueUrls} distinct URLs, ${s.evidence.archivedUrls} of them captured) |`,
    `| Tests | ${s.tests} |`,
  ].join('\n');
}

/** The STATUS.md table — the fuller operator-facing one. */
export function renderStatusStats(s = stats()) {
  const conf = order(s.confidence, ['confirmed', 'probable', 'reported']).join(' · ');
  const eff = Object.entries(s.effects)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${k} ${n}`)
    .join(' · ');
  const fs = s.fieldSupport;
  return [
    '| | |',
    '|---|---|',
    `| Records | ${s.records.total} total · **${s.records.current} current** · ${s.records.superseded} superseded |`,
    `| Vendors | codex ${s.vendors.codex.current} current (${s.vendors.codex.total} total) · claude-code ${s.vendors['claude-code'].current} current (${s.vendors['claude-code'].total} total) |`,
    `| Reset-bearing | codex ${s.vendors.codex.resetBearing} · claude-code ${s.vendors['claude-code'].resetBearing} — the constraint on Phase 6 |`,
    `| Span | ${s.span.earliest} → ${s.span.latest} |`,
    `| Confidence | ${conf} |`,
    `| Effects (current) | ${eff} |`,
    `| Evidence | **${s.evidence.items} items** on current records, across **${s.evidence.uniqueUrls} unique URLs** |`,
    `| Archived | **${s.evidence.archivedItems} of ${s.evidence.items} items (${s.evidence.itemsPct}%)** · **${s.evidence.archivedUrls} of ${s.evidence.uniqueUrls} URLs (${s.evidence.urlsPct}%)** |`,
    `| \`field_support\` | attested ${fs.attested} · unestablished ${fs.unestablished} · inferred ${fs.inferred} · **${fs.recordsWithNone} records carry none** (they predate the field) |`,
    `| Tests | **${s.tests}** |`,
  ].join('\n');
}
