/**
 * Generates public/index.html — the ledger. §8's primary page: it must stand alone.
 *
 * Three operator requirements shape this file:
 *
 *  1. SUPERSEDED RECORDS ARE VISIBLE AND TRACEABLE, not hidden. The supersede chain
 *     is the trust argument — a ledger that quietly drops its own corrections is
 *     asking to be taken on faith. Superseded rows render dimmed, carry a link to
 *     the record that replaced them, and the replacement links back.
 *  2. field_support IS RENDERED PER ROW. A value nobody attested must not look like
 *     one that was. Unestablished fields render as "not established" in italics
 *     rather than as an empty cell, because an empty cell reads as an oversight.
 *  3. No client-side calls to anything. The filter is DOM-only over pre-rendered rows.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEntries } from '../scripts/validate.mjs';
import { compareRecords } from '../lib/canonical.mjs';
import { esc, page } from './layout.ts';
import { isMain } from '../lib/is-main.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

type Support = 'attested' | 'inferred' | 'unestablished' | undefined;

const supportMark = (s: Support): string =>
  s ? `<abbr class="sup sup-${s}" title="${SUPPORT_TITLE[s]}">${SUPPORT_ABBR[s]}</abbr>` : '';

const SUPPORT_ABBR: Record<string, string> = { attested: 'att', inferred: 'inf', unestablished: 'n/e' };
const SUPPORT_TITLE: Record<string, string> = {
  attested: 'Attested — a source states this of this specific event',
  inferred: 'Inferred — follows from a general statement about how resets work, or from a neighbouring event. Nobody asserted it here.',
  unestablished: 'Not established — no source addresses this',
};

/** Render a scope value, making "not established" visible rather than blank. */
function scopeCell(value: string[] | boolean | null, support: Support): string {
  const empty = Array.isArray(value) ? value.length === 0 : value === null;
  if (empty) return `<span class="unset">not established</span>${supportMark(support)}`;
  const text = Array.isArray(value) ? value.map(esc).join(', ') : String(value);
  return `${text}${supportMark(support)}`;
}

function evidenceList(rec: any): string {
  return rec.evidence
    .map((e: any) => {
      let host = e.url;
      try {
        host = new URL(e.url).hostname.replace(/^www\./, '');
      } catch {
        /* keep the raw string */
      }
      return `<li><a href="${esc(e.url)}" rel="nofollow noopener">${esc(host)}</a> <span class="pill">${esc(e.type)}</span></li>`;
    })
    .join('');
}

export function renderLedgerPage(records: any[]): string {
  const byId = new Map(records.map((r) => [r.id, r]));
  const supersedes = new Map<string, string>();
  for (const r of records) if (r.superseded_by) supersedes.set(r.superseded_by, r.id);

  const sorted = records.slice().sort(compareRecords).reverse();
  const current = sorted.filter((r) => r.superseded_by === null);

  const rows = sorted
    .map((r) => {
      const dead = r.superseded_by !== null;
      const fs = r.field_support ?? {};
      const effects = (r.effects ?? [r.kind]) as string[];
      const replaced = supersedes.get(r.id);

      return `<tr class="rec${dead ? ' dead' : ''}"
        data-vendor="${esc(r.vendor)}" data-kind="${esc(effects.join(' '))}"
        data-trigger="${esc(r.trigger)}" data-confidence="${esc(r.confidence)}"
        data-state="${dead ? 'superseded' : 'current'}">
    <td>
      <a id="${esc(r.id)}" href="#${esc(r.id)}"><code>${esc(r.id)}</code></a>
      <div><span class="pill ${esc(r.vendor)}">${esc(r.vendor)}</span>
      ${dead ? `<span class="pill superseded">superseded</span>` : ''}</div>
    </td>
    <td>${esc(r.effective_at.replace('T', ' ').replace('Z', ''))}<br>
        <span class="unset">±${esc(r.effective_at_precision)}</span></td>
    <td>${effects.map((e) => `<div>${esc(e)}</div>`).join('')}</td>
    <td>${esc(r.trigger)}${supportMark(fs.trigger)}</td>
    <td><span class="pill ${esc(r.confidence)}">${esc(r.confidence)}</span></td>
    <td>
      <div><b>windows</b> ${scopeCell(r.scope.windows, fs.scope_windows)}</div>
      <div><b>plans</b> ${scopeCell(r.scope.plans, fs.scope_plans)}</div>
      <div><b>partial</b> ${scopeCell(r.scope.partial, fs.scope_partial)}</div>
    </td>
    <td><ul class="ev">${evidenceList(r)}</ul></td>
    <td class="chain">
      ${r.superseded_by ? `→ corrected by <a href="#${esc(r.superseded_by)}"><code>${esc(r.superseded_by)}</code></a>` : ''}
      ${replaced ? `<div>← replaces <a href="#${esc(replaced)}"><code>${esc(replaced)}</code></a></div>` : ''}
      ${(r.links ?? []).map((l: any) => `<div>${esc(l.relation)} <a href="#${esc(l.id)}"><code>${esc(l.id)}</code></a></div>`).join('')}
    </td>
  </tr>`;
    })
    .join('\n');

  const distinct = (fn: (r: any) => string[]) => [...new Set(records.flatMap(fn))].sort();
  const opts = (vals: string[]) => vals.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

  const body = `
<h1>Quota Reset Index</h1>
<p class="lede">Every discretionary quota reset we can evidence, by OpenAI (Codex) and Anthropic
(Claude Code). Each record links to its sources and carries a confidence grade. This page makes no
predictions — the <a href="/forecast.html">forecast</a> does, and is the less trustworthy half.</p>

<div class="banner">
  ${current.length} current records · ${records.length - current.length} superseded · ${records.length} total
  <p>Superseded records are <strong>shown, not hidden</strong>. Corrections are new records that
  reference the old one; nothing is ever edited in place or deleted. The chain is the audit trail,
  so removing it would defeat the point of keeping one.</p>
</div>

<h2>Reading a row</h2>
<p class="lede">Scope fields carry a provenance marker, because a value nobody asserted must not look
like one that was:
<abbr class="sup sup-attested">att</abbr> a source states it of this specific event ·
<abbr class="sup sup-inferred">inf</abbr> it follows from a general statement about how resets work,
or from a neighbouring event — nobody asserted it here ·
<abbr class="sup sup-unestablished">n/e</abbr> no source addresses it.
An audit on 2026-07-26 found 24 of 29 records carrying at least one field that read as an assertion
while resting on a general statement. Those were corrected by supersession; the markers are what stop
it recurring.</p>

<div class="filters">
  <label>vendor <select id="f-vendor"><option value="">all</option>${opts(distinct((r) => [r.vendor]))}</select></label>
  <label>effect <select id="f-kind"><option value="">all</option>${opts(distinct((r) => r.effects ?? [r.kind]))}</select></label>
  <label>trigger <select id="f-trigger"><option value="">all</option>${opts(distinct((r) => [r.trigger]))}</select></label>
  <label>confidence <select id="f-confidence"><option value="">all</option>${opts(distinct((r) => [r.confidence]))}</select></label>
  <label>state <select id="f-state"><option value="">all</option><option value="current">current</option><option value="superseded">superseded</option></select></label>
  <span id="count"></span>
</div>

<table id="ledger">
  <thead><tr>
    <th>id</th><th>effective (UTC)</th><th>effect</th><th>trigger</th>
    <th>confidence</th><th>scope</th><th>evidence</th><th>chain</th>
  </tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
`;

  const extraStyles = `
  .filters { display:flex; gap:1rem; flex-wrap:wrap; align-items:center; margin:1.25rem 0;
             padding:.75rem; background:var(--well); border:1px solid var(--rule); font-size:.85rem }
  .filters label { display:flex; gap:.35rem; align-items:center; color:var(--soft) }
  .filters select { font:inherit; padding:.15rem }
  #count { margin-left:auto; color:var(--soft); font-variant-numeric:tabular-nums }
  tr.dead td { opacity:.55 }
  ul.ev { margin:0; padding-left:1.1rem; font-size:.82rem }
  ul.ev li { margin-bottom:.15rem }
  td.chain { font-size:.8rem; color:var(--soft) }
  #ledger td:first-child { white-space:nowrap }
  @media (max-width:900px) { table, thead, tbody, tr, td, th { display:block; width:auto }
    thead { display:none } tr.rec { border-bottom:2px solid var(--rule); padding:.75rem 0 } }
  `;

  // DOM-only. Nothing here touches the network.
  const script = `
(function(){
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr.rec'));
  var sel = ['vendor','kind','trigger','confidence','state'].map(function(k){
    return { key:k, el:document.getElementById('f-'+k) };
  });
  var count = document.getElementById('count');
  function apply(){
    var shown = 0;
    rows.forEach(function(row){
      var ok = sel.every(function(s){
        var want = s.el.value;
        if (!want) return true;
        var have = row.getAttribute('data-'+s.key) || '';
        // kind is space-separated because a record may carry several effects
        return s.key === 'kind' ? have.split(' ').indexOf(want) !== -1 : have === want;
      });
      row.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    count.textContent = shown + ' of ' + rows.length + ' shown';
  }
  sel.forEach(function(s){ s.el.addEventListener('change', apply); });
  apply();
})();
`;

  return page({ title: 'Quota Reset Index', current: 'ledger', body, extraStyles, script });
}

function main(): void {
  const records = collectEntries().map((e: any) => JSON.parse(e.raw));
  const out = join(ROOT, 'public');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html'), renderLedgerPage(records));
  console.log(`built public/index.html — ${records.length} records`);
}

if (isMain(import.meta.url)) main();
