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
})();`;
}
