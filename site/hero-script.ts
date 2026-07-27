/**
 * Client-side recompute of the Codex figure against the real clock.
 *
 * The static render is deterministic (computed at the ledger's own AS_OF, so two
 * builds of the same ledger agree byte for byte). This makes the number move as
 * real time passes, without a rebuild and without any network call — it is
 * arithmetic over data already embedded in the page, which keeps it inside §8's
 * prohibition on client-side calls to vendor endpoints.
 *
 * ⚠️ THE CONSTANTS ARE INJECTED FROM models/config.ts, NOT TRANSCRIBED. A second
 * hand-written copy of the model would drift from the real one the first time a
 * weight changed, and the page would quietly publish a different model from the
 * one the methodology page documents.
 *
 * Progressive enhancement: if this never runs, the server-rendered figure stands.
 * It is a real number from the ledger, only slightly staler.
 */

import { ALPHA, BASE, MU_INTERCEPT, MU_PER_PRIOR_RESET, REFR_K, REFR_T, STEP_HOURS, TAU } from '../models/config.ts';

export function heroScript(): string {
  return `
(function(){
  var el = document.querySelector('.hero[data-last-reset]');
  if (!el) return;
  var out = document.getElementById('cx-pct');
  var note = document.getElementById('cx-since');
  if (!out) return;

  var now = Date.now();
  var since = (now - Date.parse(el.dataset.lastReset)) / 3600000;
  if (!isFinite(since) || since < 0) return;   // leave the server value alone
  var W = Number(el.dataset.window) || 48;

  // Recompute 'prior' against the real clock rather than trusting the build-time
  // value. A frozen 'prior' drifts in ONE direction only: resets age OUT of the
  // trailing fortnight and none can appear, so a stale count always OVER-states
  // the probability. Fixing it is cheap; disclosing a known upward bias is not
  // good enough when the list of dates is already sitting in the page.
  // NOTE: no backticks in comments here — this whole block lives inside a
  // template literal, and a backtick would close it. That is how this broke.
  var prior;
  try {
    var isos = JSON.parse(el.dataset.resets || '[]');
    var cutoff = now - 14 * 24 * 3600000;
    prior = isos.filter(function (d) { return Date.parse(d) >= cutoff; }).length;
  } catch (e) {
    prior = Number(el.dataset.prior) || 0;   // fall back to the server value
  }

  // Constants injected from models/config.ts at build time.
  var BASE=${BASE.launch.codex}, A=${ALPHA}, TAU=${TAU}, K=${REFR_K}, RT=${REFR_T}, STEP=${STEP_HOURS};
  var mu = BASE * (${MU_INTERCEPT} + ${MU_PER_PRIOR_RESET} * prior);

  // lambda(t) = (mu + alpha*e^-(dt/tau)) * (1 - k*e^-(dt/rt))
  // Evidence terms are all inert here: the incident and mirroring inputs are
  // zero on a static page, and the social-post term is unreachable by design.
  function lambda(t){
    var dt = since + t;
    return (mu + A * Math.exp(-dt / TAU)) * (1 - K * Math.exp(-dt / RT));
  }
  var integral = 0;
  for (var t = 0; t < W; t += STEP) integral += lambda(t + STEP / 2) * STEP;
  var p = Math.round((1 - Math.exp(-integral)) * 100);

  out.textContent = p + '%';

  if (note) {
    var label = since < 1 ? 'less than an hour ago'
              : since < 48 ? Math.round(since) + ' hours ago'
              : Math.round(since / 24) + ' days ago';
    note.textContent = 'last reset ' + label + ' \\u00b7 ' + prior + ' in the past fortnight';
  }

  // ---------------------------------------------------------------- freshness
  //
  // THE INSTRUMENT THAT MAKES THE "OPERATE IT" DECISION HONEST.
  //
  // The operator chose to operate this ledger rather than declare it a snapshot.
  // The failure mode of that choice is decay in silence: a ledger nobody is
  // maintaining still renders an as-of date, and a reader has no way to tell a
  // genuinely quiet fortnight from an abandoned project. So the page says how long
  // it has been, measured against the READER's clock rather than the build's, and
  // escalates on its own without anyone having to remember to update it.
  //
  // Thresholds are MEASURED, not chosen: 21 days is just past the longest quiet
  // period Codex has ever produced in this corpus (20 days), so it cannot fire on
  // any gap the record actually contains. 45 exceeds both vendors' observed maxima,
  // including Claude Code's 37.
  //
  // Fails silent, deliberately: with no JS the static "last reviewed" date still
  // stands. It is simply less pointed, and it is never WRONG.
  var fresh = document.getElementById('freshness');
  if (fresh && el.dataset.reviewed) {
    var days = (now - Date.parse(el.dataset.reviewed)) / 86400000;
    if (isFinite(days) && days >= 0) {
      var STALE = Number(el.dataset.staleDays) || 21;
      var GONE = Number(el.dataset.abandonedDays) || 45;
      var d = Math.floor(days);
      var human = d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
      if (days >= GONE) {
        fresh.className = 'freshness bad';
        fresh.textContent = 'Last reviewed ' + human + '. That is longer than any quiet period either'
          + ' vendor has produced in this record, so this ledger may no longer be maintained.'
          + ' Treat it as a snapshot.';
      } else if (days >= STALE) {
        fresh.className = 'freshness warn';
        fresh.textContent = 'Last reviewed ' + human + ', which is longer than the longest gap between'
          + ' Codex resets on record (' + STALE + 'd). Either the pattern changed or nobody has looked.';
      } else {
        fresh.className = 'freshness ok';
        fresh.textContent = 'Last reviewed ' + human + '.';
      }
    }
  }
})();`;
}
