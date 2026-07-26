/**
 * Deterministic serialisation helpers.
 *
 * Everything the build emits must be byte-identical across runs and machines
 * (spec §4.4). That means: fixed key order, fixed indentation, LF line endings,
 * exactly one trailing newline, and no locale- or clock-dependent values.
 */

/** Canonical key order for a reset-event record. Mirrors the schema. */
export const FIELD_ORDER = [
  'id',
  'vendor',
  'kind',
  'effects',
  'effective_at',
  'effective_at_precision',
  'observed_at',
  'scope',
  'trigger',
  'confidence',
  'evidence',
  'recorded_by',
  'superseded_by',
  'notes',
  // Optional, added 2026-07-26. Absent on every record written before that date.
  'field_support',
  'status',
  'links',
];

const SCOPE_ORDER = ['windows', 'plans', 'partial', 'notes'];
const EVIDENCE_ORDER = ['type', 'url', 'author', 'captured_at', 'archive_url'];

function pick(obj, order) {
  const out = {};
  for (const k of order) if (k in obj) out[k] = obj[k];
  // Anything not in the canonical order still gets emitted, so a schema drift
  // can never silently drop data on a round-trip.
  for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
  return out;
}

/** Reorder a record's keys canonically, recursing into scope and evidence. */
export function canonicalRecord(rec) {
  const out = pick(rec, FIELD_ORDER);
  if (out.scope && typeof out.scope === 'object') out.scope = pick(out.scope, SCOPE_ORDER);
  if (Array.isArray(out.evidence)) out.evidence = out.evidence.map((e) => pick(e, EVIDENCE_ORDER));
  return out;
}

/** Record -> the exact bytes we store on disk. 2-space indent, one trailing LF. */
export function serialiseRecord(rec) {
  return JSON.stringify(canonicalRecord(rec), null, 2) + '\n';
}

/**
 * Stable total order for records: by effective_at, then id.
 * id alone would be enough (it embeds the date) but sorting on the real
 * timestamp keeps same-day events in chronological order rather than in
 * whatever order the sequence numbers were assigned.
 */
export function compareRecords(a, b) {
  if (a.effective_at !== b.effective_at) return a.effective_at < b.effective_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Comparison key for detecting an edit to a sealed field. */
export function stableKey(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}
