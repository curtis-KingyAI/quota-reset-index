/**
 * Validation core.
 *
 * Two layers:
 *   1. JSON Schema (schema/reset-event.schema.json) — shape and closed enums.
 *   2. Invariants that JSON Schema cannot express — cross-field and cross-record.
 *
 * Every error names the file and the field, because a validator that says
 * "invalid" without saying where is a validator you stop running.
 *
 * This module is pure: it takes {path, raw} pairs and returns errors. The disk
 * walk lives in scripts/validate.mjs; the staged-blob read lives in
 * scripts/check-append-only.mjs. Both share this code so the commit hook and
 * the CLI can never disagree about what "valid" means.
 */

// The schema is draft 2020-12, so this must be ajv's 2020 build — the default
// export only knows draft-07 and fails with "no schema with key or ref".
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { basename, dirname, sep } from 'node:path';

const VENDOR_PREFIX = { codex: 'cx', 'claude-code': 'cc' };
const CONFIRMING_EVIDENCE = new Set(['vendor_post', 'status_page', 'telemetry']);

export function loadSchema(schemaPath) {
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}

export function makeValidator(schema) {
  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

/**
 * @param {{path: string, raw: string}[]} entries
 * @param {object} schema
 * @returns {{errors: {file: string, field: string, message: string}[], records: object[]}}
 */
export function validateEntries(entries, schema) {
  const validate = makeValidator(schema);
  const errors = [];
  const records = [];
  const err = (file, field, message) => errors.push({ file, field, message });

  // ---- per-record: parse, schema, then cross-field invariants ----
  for (const { path, raw } of entries) {
    let rec;
    try {
      rec = JSON.parse(raw);
    } catch (e) {
      err(path, '<file>', `not valid JSON: ${e.message}`);
      continue;
    }

    if (!validate(rec)) {
      for (const e of validate.errors) {
        const field = e.instancePath ? e.instancePath.slice(1).replace(/\//g, '.') : (e.params?.missingProperty ?? '<root>');
        err(path, field, `${e.message}${e.params?.allowedValues ? ` (allowed: ${e.params.allowedValues.join(', ')})` : ''}`);
      }
      continue; // downstream invariants assume a well-shaped record
    }

    // §4.1 — one record per file at ledger/<vendor>/<id>.json
    const stem = basename(path).replace(/\.json$/, '');
    if (stem !== rec.id) err(path, 'id', `id "${rec.id}" does not match filename stem "${stem}"`);

    const dir = basename(dirname(path.split('/').join(sep)));
    if (dir !== rec.vendor) err(path, 'vendor', `vendor "${rec.vendor}" does not match directory "ledger/${dir}/"`);

    // id internal consistency — not stated in the spec, added because an id that
    // disagrees with its own record is the cheapest possible data-entry bug to catch.
    const expectedPrefix = VENDOR_PREFIX[rec.vendor];
    if (!rec.id.startsWith(expectedPrefix + '-')) {
      err(path, 'id', `vendor "${rec.vendor}" requires id prefix "${expectedPrefix}-", got "${rec.id.slice(0, 3)}"`);
    }
    const idDate = rec.id.slice(3, 13);
    const effDate = rec.effective_at.slice(0, 10);
    if (idDate !== effDate) {
      err(path, 'id', `id date "${idDate}" does not match effective_at date "${effDate}"`);
    }

    // §4.2 — observed_at >= effective_at
    const eff = Date.parse(rec.effective_at);
    const obs = Date.parse(rec.observed_at);
    if (Number.isNaN(eff)) err(path, 'effective_at', `unparseable timestamp "${rec.effective_at}"`);
    if (Number.isNaN(obs)) err(path, 'observed_at', `unparseable timestamp "${rec.observed_at}"`);
    if (!Number.isNaN(eff) && !Number.isNaN(obs) && obs < eff) {
      err(path, 'observed_at', `observed_at (${rec.observed_at}) is before effective_at (${rec.effective_at})`);
    }

    // §4.2 — confirmed requires a vendor, status-page or telemetry source
    if (rec.confidence === 'confirmed') {
      const kinds = rec.evidence.map((e) => e.type);
      if (!kinds.some((k) => CONFIRMING_EVIDENCE.has(k))) {
        err(
          path,
          'confidence',
          `confidence "confirmed" requires at least one evidence item of type ` +
            `${[...CONFIRMING_EVIDENCE].join(', ')} — this record has only: ${kinds.join(', ') || '(none)'}`,
        );
      }
    }

    // Each evidence item must have been captured at or after the event.
    rec.evidence.forEach((e, i) => {
      const cap = Date.parse(e.captured_at);
      if (!Number.isNaN(cap) && !Number.isNaN(eff) && cap < eff) {
        err(path, `evidence.${i}.captured_at`, `captured (${e.captured_at}) before the event it evidences (${rec.effective_at})`);
      }
    });

    records.push({ path, rec });
  }

  // ---- cross-record invariants ----
  const byId = new Map();
  for (const { path, rec } of records) {
    if (byId.has(rec.id)) {
      err(path, 'id', `duplicate id "${rec.id}" — already defined by ${byId.get(rec.id).path}`);
      continue;
    }
    byId.set(rec.id, { path, rec });
  }

  for (const { path, rec } of records) {
    if (rec.superseded_by === null) continue;
    if (rec.superseded_by === rec.id) {
      err(path, 'superseded_by', `record supersedes itself`);
      continue;
    }
    if (!byId.has(rec.superseded_by)) {
      err(path, 'superseded_by', `points at "${rec.superseded_by}", which is not an existing record`);
    }
  }

  // A supersede cycle would make "which record is current" unanswerable.
  for (const { path, rec } of records) {
    const seen = new Set([rec.id]);
    let cur = rec;
    while (cur?.superseded_by && byId.has(cur.superseded_by)) {
      if (seen.has(cur.superseded_by)) {
        err(path, 'superseded_by', `supersede cycle: ${[...seen, cur.superseded_by].join(' -> ')}`);
        break;
      }
      seen.add(cur.superseded_by);
      cur = byId.get(cur.superseded_by).rec;
    }
  }

  return { errors, records: records.map((r) => r.rec) };
}

export function formatErrors(errors) {
  return errors.map((e) => `  ${e.file}\n    field: ${e.field}\n    ${e.message}`).join('\n\n');
}
