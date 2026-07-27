#!/usr/bin/env node
/**
 * npm run backtest — score the published Codex forecaster against the ledger.
 *
 * Reads the ledger, runs the walk-forward evaluation in models/backtest.ts, and
 * prints the result. Writes nothing: this is a measurement, and what to publish on
 * the strength of it is a separate decision.
 */

import { collectEntries } from './validate.mjs';
import { bootstrapSkill, calibrationInTheLarge, run, skill } from '../models/backtest.ts';
import { HERO_REGIME } from '../site/hero-data.ts';
import { isMain } from '../lib/is-main.mjs';

const RESET = new Set(['global_reset', 'banked_reset']);
const pct = (x) => `${(x * 100).toFixed(1)}%`;

export function loadEvents() {
  const recs = collectEntries()
    .map((e) => JSON.parse(e.raw))
    .filter((r) => r.superseded_by === null);
  const of = (vendor) =>
    recs
      .filter((r) => r.vendor === vendor && (r.effects ?? [r.kind]).some((k) => RESET.has(k)))
      .map((r) => Date.parse(r.effective_at))
      .sort((a, b) => a - b);
  return { codex: of('codex'), claudeCode: of('claude-code') };
}

function main() {
  const { codex, claudeCode } = loadEvents();
  const stride = process.argv.includes('--non-overlapping') ? 2 : 1;

  const { series, days, positives } = run(codex, claudeCode, ['quiet', 'normal', 'launch'], { strideDays: stride });

  console.log('Walk-forward backtest — Codex, 48h windows');
  console.log(`  ${codex.length} reset events · ${days} scored days · ${positives} positive windows` +
    ` (${pct(positives / days)})${stride === 2 ? ' · NON-OVERLAPPING' : ''}`);
  console.log('  Nothing is fitted. At each day the model sees only records strictly before it.\n');

  const ref = series.find((s) => s.regime === 'baseline-climatology');
  const rows = [...series].sort((a, b) => a.brier - b.brier);

  console.log('  rank  series                 Brier   skill vs climatology   mean forecast   observed');
  for (const [i, s] of rows.entries()) {
    const c = calibrationInTheLarge(s.rows);
    const sk = s === ref ? '—' : skill(s.brier, ref.brier).toFixed(3).padStart(6);
    console.log(
      `  ${String(i + 1).padStart(4)}  ${s.regime.padEnd(22)}${s.brier.toFixed(4).padStart(6)}` +
        `${String(sk).padStart(22)}   ${pct(c.meanForecast).padStart(13)}   ${pct(c.observedFrequency).padStart(8)}`,
    );
  }

  // ⚠️ NOT hardcoded. This said `'launch'` and kept calling it "the published
  // configuration" after the site had moved to `normal` on the strength of this very
  // backtest — the label drifting from the value, again.
  const published = series.find((s) => s.regime === HERO_REGIME);
  const ci = bootstrapSkill(published.rows, ref.rows);
  const s = skill(published.brier, ref.brier);
  console.log(
    `\n  PUBLISHED CONFIGURATION (${HERO_REGIME} regime): skill ${s.toFixed(3)}` +
      ` · 95% block-bootstrap CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]`,
  );
  console.log(
    s > 0 && ci.lo > 0
      ? '  → beats the baseline, and the interval excludes zero.'
      : s > 0
        ? '  → nominally better, but the interval INCLUDES ZERO: not distinguishable from the baseline.'
        : '  → WORSE than simply predicting the historical base rate.',
  );
}

if (isMain(import.meta.url)) main();
