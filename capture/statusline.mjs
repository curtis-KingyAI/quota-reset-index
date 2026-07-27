#!/usr/bin/env node
/**
 * A Claude Code status line that also records what it saw.
 *
 * ── WHY THIS IS PERMITTED WHERE PHASE 2 WAS NOT ─────────────────────────────
 *
 * `docs/PHASE-2-CLOSED.md` closed the sentinel on four grounds. Three of them
 * still bind and are respected here; the one that does not is what makes this
 * different, and it is worth being precise rather than convenient about it.
 *
 * The quoted prohibition — "Anthropic does not allow third party developers to
 * offer claude.ai login or rate limits FOR THEIR PRODUCTS" — is about supplying a
 * subscription's quota state to other people through a product. That is what the
 * sentinel was: an account instrumented on the site's behalf, on which end users
 * would have depended. This is instead the case that document itself names as the
 * way back in:
 *
 *   > (b) the product is restructured so each user runs it locally against their
 *   > own seat with their own credentials
 *
 * One operator, own seat, own machine, a documented interface, output never served
 * to anyone. No credential is read: Claude Code hands the numbers to a script the
 * operator configured, which is the mechanism working as designed rather than
 * around it. Nothing published depends on it — and that point is load-bearing, so
 * it is enforced rather than promised: this directory is imported by no file in
 * `site/`, `models/` or `scripts/`, and a test asserts exactly that.
 *
 * The ground that still binds is §4, and it is the important one: telemetry shows
 * that a quota moved, never that a vendor granted anything. So this logs, and
 * `detect.mjs` files candidates for a human. Neither writes to `ledger/`.
 *
 * ── AND THE ASYMMETRY, WHICH IS NOT PAPERED OVER ────────────────────────────
 *
 * This works for Claude Code and CANNOT work for Codex. Codex quota state is not
 * observable from outside — that is the stated reason Model A is a Hawkes process
 * over the reset history in the first place. So instrumentation will make the
 * Claude Code side of this project better-evidenced than the Codex side, and the
 * gap is structural, not a backlog item. It must never be presented as coverage of
 * both vendors.
 *
 * ── THE CONTRACT IT READS ───────────────────────────────────────────────────
 *
 * Verified against the status line documentation on 2026-07-27:
 *
 *   rate_limits.five_hour.used_percentage   0–100
 *   rate_limits.five_hour.resets_at         Unix epoch SECONDS
 *   rate_limits.seven_day.used_percentage   0–100
 *   rate_limits.seven_day.resets_at         Unix epoch SECONDS
 *
 * `rate_limits` appears only for Claude.ai subscribers after the first API
 * response in a session, and each window may be independently absent. Absence is
 * the normal early-session state; it renders as "—" and is never recorded as 0%,
 * which would read as a fresh quota nobody observed.
 *
 * ── AND ONE RULE ABOUT FAILING ──────────────────────────────────────────────
 *
 * This process IS the operator's status bar. It must always print a line and never
 * exit non-zero, whatever goes wrong. Rendering is the job; logging is the
 * expendable side effect, and it happens second for that reason.
 */

import { readFileSync } from 'node:fs';
import { record, toObservation } from './observations.mjs';
import { isMain } from '../lib/is-main.mjs';

/**
 * Read the JSON payload from stdin.
 *
 * `readFileSync(0)` reads fd 0 to EOF, which is what Claude Code provides — it
 * pipes one JSON object and closes. Returns '' on any error rather than throwing,
 * because an unreadable stdin still has to produce a status line.
 */
function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

const pct = (v) => (typeof v === 'number' ? `${Math.round(v)}%` : '—');

/**
 * "6d4h", "2h14m", "48m", "now". Compact, because it sits in a status bar.
 *
 * The day form is not cosmetic: the seven-day window is normally more than 24h
 * out, and rendering that as "168h00m" makes the one number a reader wants to
 * skim into something they have to do arithmetic on.
 */
export function until(epochSeconds, nowMs) {
  if (typeof epochSeconds !== 'number') return null;
  const secs = epochSeconds - Math.floor(nowMs / 1000);
  if (secs <= 0) return 'now';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d${h % 24}h`;
  return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * Build the visible line.
 *
 * Deliberately plain — model, the two quota windows with time to reset, and
 * context. No colour escapes, so it renders identically in every terminal and
 * survives being pasted into a bug report.
 */
export function renderStatus(payload, nowMs) {
  // No payload at all means stdin was empty or unparseable. That is a different
  // state from "a payload with no rate_limits yet", and it must not render a
  // quota claim of any kind — not even "—", which would imply we looked and the
  // vendor said nothing.
  if (!payload || typeof payload !== 'object') return 'quota reset index';

  const parts = [];

  const model = payload?.model?.display_name;
  if (model) parts.push(model);

  const rl = payload?.rate_limits;
  if (rl?.five_hour) {
    const t = until(rl.five_hour.resets_at, nowMs);
    parts.push(`5h ${pct(rl.five_hour.used_percentage)}${t ? ` (${t})` : ''}`);
  }
  if (rl?.seven_day) {
    const t = until(rl.seven_day.resets_at, nowMs);
    parts.push(`wk ${pct(rl.seven_day.used_percentage)}${t ? ` (${t})` : ''}`);
  }
  if (!rl) parts.push('quota —');

  const ctx = payload?.context_window?.used_percentage;
  if (typeof ctx === 'number') parts.push(`ctx ${Math.round(ctx)}%`);

  return parts.join(' · ') || 'quota reset index';
}

function main() {
  let payload = null;
  try {
    const raw = readStdin();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch {
    /* unparseable input still gets a rendered line below */
  }

  const nowMs = Date.now();

  // Render FIRST. If recording were to throw or stall, the operator has their
  // status line regardless.
  let line;
  try {
    line = renderStatus(payload, nowMs);
  } catch {
    line = 'quota reset index';
  }
  process.stdout.write(line + '\n');

  try {
    const obs = toObservation(payload, new Date(nowMs).toISOString());
    if (obs) record(obs);
  } catch {
    /* never let the log break the bar */
  }
}

/**
 * ⚠️ THE GUARD IS LOAD-BEARING, NOT BOILERPLATE.
 *
 * Without it, merely IMPORTING this module runs main(), which calls
 * `readFileSync(0)` and blocks until EOF on whatever stdin the importing process
 * happens to have. The test runner's stdin never closes, so the whole suite hung
 * — which is how this was found. Any importer would inherit the same hang.
 */
if (isMain(import.meta.url)) main();
