/**
 * Generates public/methodology.
 *
 * §8 requires /methodology to carry the formulas, the weights table, the calibration status, and a
 * plain statement of what the sentinel depends on and how it can fail.
 *
 * THE WEIGHTS TABLE IS GENERATED FROM models/config.ts, NOT TRANSCRIBED. A hand-written table is a
 * second source of truth that silently goes stale the first time a constant changes — and the whole
 * point of this page is that the numbers on it are the numbers the model actually uses. If a weight
 * changes, this page changes with it or the build is wrong.
 *
 * Schema-independent by construction: it reads no ledger record. That is why it is the only Phase 5
 * surface shipping ahead of the migration.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALPHA,
  BASE,
  CALENDAR,
  CALIBRATION_BANNER,
  CLAUDE_WEIGHTS,
  CODEX_WEIGHTS,
  DEPLETION_CENTRE,
  DEPLETION_MAX_UPLIFT,
  DEPLETION_SCALE,
  HORIZON_HOURS,
  MU_INTERCEPT,
  MU_PER_PRIOR_RESET,
  PERIOD,
  REFR_K,
  REFR_T,
  SIGMA,
  STEP_HOURS,
  TAU,
} from '../models/config.ts';
import { forecastHero, page } from './layout.ts';
import { DESCRIPTIONS, seoHead } from './seo.ts';
import { heroFigures } from './hero-data.ts';
import { coverageSpan } from './live-state.ts';
import { heroScript } from './hero-script.ts';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface WeightRow {
  term: string;
  w: number;
  hl: number;
  note: string;
}

const codexRows: WeightRow[] = [
  { term: 'Status incident', w: CODEX_WEIGHTS.inc.w, hl: CODEX_WEIGHTS.inc.hl, note: 'OpenAI status severity, 0–100.' },
  { term: '@thsottiaux post', w: CODEX_WEIGHTS.tibo.w, hl: CODEX_WEIGHTS.tibo.hl, note: 'UNREACHABLE in v1 — scraping X is prohibited, so nothing can raise this above 0.' },
  { term: 'Launch proximity', w: CODEX_WEIGHTS.launch.w, hl: CODEX_WEIGHTS.launch.hl, note: 'No decay: proximity to a release is a state, not an event.' },
  { term: 'Anthropic mirroring', w: CODEX_WEIGHTS.mirror.w, hl: CODEX_WEIGHTS.mirror.hl, note: 'Hours since the other vendor acted; ignored beyond 120h.' },
];

const claudeRows: WeightRow[] = [
  { term: 'Status incident', w: CLAUDE_WEIGHTS.inc.w, hl: CLAUDE_WEIGHTS.inc.hl, note: 'Anthropic status severity, 0–100.' },
  { term: '@ClaudeDevs post', w: CLAUDE_WEIGHTS.dev.w, hl: CLAUDE_WEIGHTS.dev.hl, note: 'UNREACHABLE in v1 — same prohibition.' },
  { term: 'Model availability', w: CLAUDE_WEIGHTS.model.w, hl: CLAUDE_WEIGHTS.model.hl, note: 'Restoration or launch in progress.' },
  { term: 'OpenAI mirroring', w: CLAUDE_WEIGHTS.mirror.w, hl: CLAUDE_WEIGHTS.mirror.hl, note: 'Hours since the other vendor acted; ignored beyond 120h.' },
];

const weightTable = (rows: WeightRow[]): string =>
  rows
    .map(
      (r) =>
        `<tr><td>${esc(r.term)}</td><td class="num">${r.w}</td><td class="num">${r.hl >= 1e9 ? '∞' : r.hl + 'h'}</td><td>${esc(r.note)}</td></tr>`,
    )
    .join('\n');

export function renderMethodology(): string {
  const body = `${forecastHero(heroFigures())}

<h1>Methodology</h1>
<p class="lede">How the Quota Reset Index records events and how it forecasts them — including what
it cannot do, and what it would take to fix that.</p>

<div class="banner">
  ${esc(CALIBRATION_BANNER)}
  <p>Every weight on this page is a prior set by hand from the public event record. None has been
  fitted. None has been checked against an outcome. There is no Brier score here because there is no
  labelled sample yet to compute one from. This banner is removed only by replacing it with that
  score — it is not a disclaimer, it is the current state of the instrument.</p>
</div>

<h2>The ledger comes first</h2>
<p>The ledger is the asset. It records discretionary quota resets with evidence links and a
confidence grade, and it makes no predictions, so it cannot be wrong in the way a forecast can.
The forecasts below sit on top of it and are strictly the less trustworthy half of this project.</p>

<p>An audit on 2026-07-26 found that <strong>24 of 29 records carried at least one over-claimed
enrichment field</strong> — a scope or trigger value that no source asserted of that specific event.
The events themselves survived: every record's vendor, date and evidence held up under adversarial
review, and six candidate events were rejected before entry. The defects were in the metadata around
them.</p>

<p><strong>That correction has landed.</strong> Every accepted change was written as a superseding
record; nothing was edited in place and nothing was deleted. Two details worth stating, because they
are the reason to believe the rest:</p>
<ul>
  <li>The 41 proposed corrections were themselves put through an adversarial pass before any record
  moved. <strong>21 of the 41 were wrong</strong> — 11 "corrected" values that were already right,
  and 10 would have replaced a real defect with a different unsupported claim. Had they been applied
  as drafted, the ledger would have looked audited while staying wrong.</li>
  <li>That pass also found two structural defects nobody had asked it to look for: one event recorded
  twice under two timezone conventions, and a citation whose own identifier decoded to a date four
  days from the one it was filed under. Both are fixed; both are visible in the record chain.</li>
</ul>

<p>The root cause was a schema property rather than 24 careless judgments. A required boolean cannot
say "we do not know", so nine records asserted account coverage no source had addressed. Fields can
now be explicitly unestablished, and every enrichment field carries a provenance marker.</p>

<h2>Model A — Codex: self-exciting intensity</h2>
<p>Codex quota state is not observable from outside, so the reset history is the richest signal
available. Resets arrive in bursts, which is the signature of a self-exciting process rather than a
memoryless one — hence a Hawkes intensity with a short refractory dip.</p>

<pre>λ(t) = [ μ + α·e^(−Δt/τ) ] · refractory(Δt) · exp( Σ wⱼ·sⱼ·2^(−ageⱼ/hlⱼ) )

P(reset within W) = 1 − exp( −∫₀^W λ dt )</pre>

<table>
  <tr><th>Constant</th><th class="num">Value</th><th>Meaning</th></tr>
  <tr><td>α (excitation)</td><td class="num">${ALPHA}</td><td>Added intensity per recent reset.</td></tr>
  <tr><td>τ (excitation decay)</td><td class="num">${TAU}h</td><td>How long a burst stays hot.</td></tr>
  <tr><td>Refractory depth</td><td class="num">${REFR_K}</td><td>Suppression immediately after a reset.</td></tr>
  <tr><td>Refractory relaxation</td><td class="num">${REFR_T}h</td><td>How fast that suppression lifts.</td></tr>
  <tr><td>μ intercept</td><td class="num">${MU_INTERCEPT}</td><td>EWMA stand-in: base × (intercept + per-reset × resets/14d).</td></tr>
  <tr><td>μ per prior reset</td><td class="num">${MU_PER_PRIOR_RESET}</td><td>So 6 resets/14d lands exactly on the unmodified base rate.</td></tr>
</table>

<p><strong>The behaviour most likely to look like a bug:</strong> a reset 2 hours ago <em>lowers</em>
the instantaneous rate but <em>raises</em> the 48-hour probability. That is deliberate — excitation
outlives the refractory dip, and same-day repeats happened twice in July 2026. A change that reverses
it is a regression, and a test pins it.</p>

<h3>Codex evidence weights</h3>
<table>
  <tr><th>Term</th><th class="num">weight</th><th class="num">half-life</th><th>Note</th></tr>
  ${weightTable(codexRows)}
</table>

<h2>Model B — Claude Code: renewal hazard with covariates</h2>
<p>Claude Code exposes usage state, so it can in principle be instrumented — which is why it gets a
different model rather than the same one twice. It reports two numbers because the vendor offers two
knowable things: a near-deterministic scheduled recycle, and a genuinely uncertain discretionary
reset. <strong>They are different questions and must never be added together.</strong></p>

<pre>λ(t) = λ₀ · D(utilisation) · K(day, hour) · exp( Σ wⱼ·sⱼ·2^(−ageⱼ/hlⱼ) )

D(u) = 1 + ${DEPLETION_MAX_UPLIFT} / (1 + e^(−(u − ${DEPLETION_CENTRE}) / ${DEPLETION_SCALE}))

scheduled: Φ((W − t_due) / σ),  σ = ${SIGMA}h,  period ≈ ${PERIOD}h</pre>

<table>
  <tr><th>Term</th><th class="num">weight</th><th class="num">half-life</th><th>Note</th></tr>
  ${weightTable(claudeRows)}
</table>

<h3>Calendar term</h3>
<table>
  <tr><th>Window (UTC)</th><th class="num">multiplier</th></tr>
  <tr><td>Friday ${CALENDAR.fridayAfternoon.fromHour}:00–${CALENDAR.fridayAfternoon.toHour}:00</td><td class="num">${CALENDAR.fridayAfternoon.multiplier}</td></tr>
  <tr><td>Monday ${CALENDAR.mondayMorning.fromHour}:00–${CALENDAR.mondayMorning.toHour}:00</td><td class="num">${CALENDAR.mondayMorning.multiplier}</td></tr>
  <tr><td>Weekend</td><td class="num">${CALENDAR.weekend.multiplier}</td></tr>
  <tr><td>Ordinary weekday hour</td><td class="num">${CALENDAR.ordinary.multiplier}</td></tr>
</table>
<p>This is the only clock-dependent term in either model, and it is why the Claude Code figures move
between a Tuesday and a Saturday on otherwise identical inputs.</p>

<h2>Base rates</h2>
<table>
  <tr><th>Regime</th><th class="num">Codex /day</th><th class="num">Claude Code /day</th></tr>
  ${(['quiet', 'normal', 'launch'] as const)
    .map(
      (r) =>
        `<tr><td>${r}</td><td class="num">${(BASE[r].codex * 24).toFixed(2)}</td><td class="num">${(BASE[r].claudeCode * 24).toFixed(2)}</td></tr>`,
    )
    .join('\n  ')}
</table>
<p>Integration is a midpoint rule at ${STEP_HOURS}h steps over a ${HORIZON_HOURS}h horizon. Midpoint
rather than left-endpoint because both models are steep near t=0 and a left-endpoint sum would bias
the short windows.</p>

<h2 id="sentinel">What the sentinel depends on, and how it fails</h2>
<p>§8 requires this stated plainly, so:</p>

<div class="fail">
<p><strong>There is no sentinel, and there will not be one in this form.</strong> It was specified to
poll an undocumented endpoint using a local OAuth token. That was declined on 2026-07-26: no
stability contract, risk transferred to end users, and a conflict with the editorial-independence
position this project depends on.</p>

<p>Investigating alternatives produced a harder finding. Anthropic's own developer documentation
states that, absent prior approval, third-party products may not offer claude.ai login
<em>or rate limits</em>. That applies whichever surface supplies the number — an undocumented
endpoint, scraped terminal output, or the fully documented status-line field. Picking a cleaner
surface changes the engineering and not the permission.</p>

<p><strong>And even a working sentinel would answer the wrong question.</strong> No channel —
supported or otherwise — distinguishes a vendor-wide grant from an ordinary scheduled rollover.
Telemetry can establish that <em>your</em> quota changed. It cannot establish that the vendor granted
anything. That is precisely what this ledger records, which is why the ledger is not the fallback
instrument here. It is the only one.</p>
</div>

<h2 id="data">The data, and how to use it</h2>
<p>Both files are regenerated from the flat record files by a deterministic build — same inputs,
byte-identical output — and are never hand-edited. They are served CORS-open because the point is
for other people to check our work.</p>

<table>
  <tr><th>endpoint</th><th>format</th><th>headers</th></tr>
  <tr><td><a href="/ledger.json"><code>/ledger.json</code></a></td><td>array of record objects</td>
      <td><code>Access-Control-Allow-Origin: *</code><br><code>Cache-Control: public, max-age=3600, stale-while-revalidate=86400</code></td></tr>
  <tr><td><a href="/ledger.csv"><code>/ledger.csv</code></a></td><td>one row per record, RFC 4180</td>
      <td>same</td></tr>
</table>

<p>Four things a consumer needs to know:</p>
<ul>
  <li><strong>Superseded records are included.</strong> Filter on <code>superseded_by === null</code>
  for the current view. They are present rather than removed because the correction chain is the
  audit trail — a ledger that deletes its own history is asking to be believed rather than checked.</li>
  <li><strong><code>field_support</code> tells you what to trust.</strong> Per enrichment field:
  <code>attested</code> (a source states it of that event), <code>inferred</code> (it follows from a
  general statement, nobody asserted it here), <code>unestablished</code> (nothing addresses it).
  A field with no marker predates 2026-07-26 and its provenance was never recorded.</li>
  <li><strong><code>scope.partial: null</code> means unestablished</strong>, and is distinct from
  <code>false</code>. In the CSV it renders as an empty cell rather than the string "false".</li>
  <li><strong>Dates are UTC.</strong> Several widely-cited secondary sources date these events in US
  Pacific, which puts some of them on the previous day. Where a record's identity depends on that,
  the underlying post id and its decoded UTC timestamp are recorded in the notes.</li>
  <li><strong>Evidence carries an archive link where one exists.</strong> Each evidence item may have
  an <code>archive_url</code> and an <code>archive_timestamp</code>, so the claim you can check is
  "as of that date, this source said this" rather than "this URL currently resolves". Where a source
  cannot be archived — some hosts refuse it — the fields are absent rather than faked, and that
  refusal is itself recorded.</li>
</ul>

<h3>Why the archive lives beside the records, not inside them</h3>
<p>The record files are append-only: once committed, every field except
<code>superseded_by</code> is sealed, and a pre-commit hook plus a CI check against full history
enforce it. Writing an archive link into a committed record would be a <em>mutation</em>, and the
hook rejects it.</p>
<p>So archives live in their own append-only index, keyed by URL, and are joined into the published
files at build time. This is not a workaround for the guarantee — it is a better fit for the data.
An archive is not a claim about the event; it is a durability measure for a citation, with its own
lifetime. A single field holds one capture, whereas the index holds a series of attempts, successes
and failures alike. That is what supports a dated claim rather than a current one.</p>

<h2 id="calibration">The first measurement — and it does not flatter us</h2>
<p>The banner at the top of this page said the weights had never been checked against an outcome, and
that it would come off when a Brier score replaced it. On <strong>2026-07-27</strong> that score was
computed for the first time, against the 19 Codex reset events the ledger already held.
<code>npm run backtest</code> reproduces every figure.</p>

<p>For each day, using <strong>only records dated strictly before it</strong>, the model forecast
P(reset in the next 48h); that was scored against what happened. Nothing was fitted — the model was
scored exactly as published, which matters because the priors were hand-set by someone reading this
same record. The baselines are walk-forward too, or beating them would prove nothing.</p>

<table>
  <tr><th>series</th><th class="num">Brier ↓</th><th class="num">skill</th><th class="num">mean forecast</th><th class="num">observed</th></tr>
  <tr><td><strong>normal</strong></td><td class="num"><strong>0.1744</strong></td><td class="num">+0.134</td><td class="num">25.4%</td><td class="num">25.8%</td></tr>
  <tr><td>quiet</td><td class="num">0.1870</td><td class="num">+0.071</td><td class="num">15.8%</td><td class="num">25.8%</td></tr>
  <tr><td><strong>launch</strong> — the one shown on this site</td><td class="num">0.1895</td><td class="num">+0.059</td><td class="num"><strong>38.9%</strong></td><td class="num">25.8%</td></tr>
  <tr><td>baseline: constant rate</td><td class="num">0.1953</td><td class="num">+0.030</td><td class="num">16.5%</td><td class="num">25.8%</td></tr>
  <tr><td>baseline: historical frequency</td><td class="num">0.2013</td><td class="num">—</td><td class="num">16.3%</td><td class="num">25.8%</td></tr>
</table>

<div class="fail">
<p><strong>Finding 1 — the banner stays.</strong> Every 95% bootstrap interval on the skill score
<em>includes zero</em>: the published configuration scores +0.059 with an interval of
[−0.485, +0.302]. <strong>No configuration is statistically distinguishable from simply predicting the
historical base rate.</strong> That is a statement about the sample — 19 events — rather than a verdict
on the model. But the banner has changed meaning: it no longer says "never checked". It says
<em>checked, and not yet distinguishable from a constant rate</em>.</p>

<p><strong>Finding 2 — the regime shown on this site is the wrong one.</strong> The figure at the top of
every page uses the <code>launch</code> regime. It <strong>over-forecasts by about 14 points</strong> —
38.9% predicted against 25.8% observed — and on non-overlapping windows it scores <em>below</em> the
constant-rate baseline. <code>normal</code> is nearly perfectly calibrated in the large and ranks first
under both schemes.</p>

<p>That is published here before it is acted on, because a site that only reports measurements
favourable to itself is not measuring. Note also what it does <em>not</em> establish: being calibrated
in the large is a weak property — a flat 25.8% would achieve it too — so the self-exciting structure
this model is built around remains unevidenced.</p>
</div>

<h2>How this becomes citable rather than interesting</h2>
<p>The remaining constraint is events. At roughly one Codex reset a week, an interval that excludes zero
is plausibly months away rather than the year implied by "40 labelled events per vendor" — a threshold
that was itself hand-set and is now superseded by an actual measurement. Claude Code, with four reset
events, cannot be assessed at all, and that asymmetry is structural. Full working:
<code>docs/CALIBRATION.md</code>.</p>

<footer>
Quota Reset Index · methodology · generated from <code>models/config.ts</code>, so the weights above
are the weights in use. Ledger data at <code>/ledger.json</code> and <code>/ledger.csv</code>,
CORS-open. Corrections welcome against the evidence, not against the conclusions.
`;

  return page({
    title: 'Methodology — how the Quota Reset Index works',
    path: '/methodology',
    current: 'methodology',
    coverage: coverageSpan().label,
    body,
    script: heroScript(),
    head: seoHead({
      title: 'Methodology — Quota Reset Index',
      description: DESCRIPTIONS.methodology,
      path: '/methodology',
    }),
  });
}

function main(): void {
  const out = join(ROOT, 'public');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'methodology.html'), renderMethodology());
  console.log('built public/methodology');
}

if (isMain(import.meta.url)) main();
