import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isUsable, type UsageProvider, type UsageReading } from '../provider.ts';
import { OperatorProvider, UnavailableProvider, NO_SUPPORTED_TELEMETRY, resolveUsage } from '../providers.ts';
import { CLAUDE_BASELINE } from '../../models/claudeCode.ts';
import { claudeForecast, pct } from '../../models/integrate.ts';

const NOW = new Date('2026-07-26T12:00:00Z');

test('the interface is not shaped around the OAuth response schema', async () => {
  // Operator constraint, 2026-07-26. If any of these keys ever appear, the
  // interface has been re-coupled to the endpoint that was declined.
  const r = await new OperatorProvider(62, 25).read(NOW);
  for (const forbidden of ['seven_day', 'five_hour', 'resets_at', 'utilization', 'seven_day_utilization']) {
    assert.ok(!(forbidden in r), `UsageReading must not carry endpoint-shaped key "${forbidden}"`);
  }
  assert.deepEqual(Object.keys(r).sort(), [
    'hoursSinceRecycle',
    'note',
    'observedAt',
    'provenance',
    'providerId',
    'weeklyUtilizationPct',
  ]);
});

test('an unavailable reading is null, never zero', async () => {
  const r = await NO_SUPPORTED_TELEMETRY.read(NOW);
  assert.equal(r.weeklyUtilizationPct, null);
  assert.notEqual(r.weeklyUtilizationPct, 0);
  assert.equal(r.provenance, 'unavailable');
  assert.equal(isUsable(r), false);
  assert.match(r.note ?? '', /declined by the operator/);
});

test('the operator provider validates its inputs', () => {
  assert.throws(() => new OperatorProvider(-1, 0), RangeError);
  assert.throws(() => new OperatorProvider(101, 0), RangeError);
  assert.throws(() => new OperatorProvider(50, -5), RangeError);
  assert.doesNotThrow(() => new OperatorProvider(0, 0));
  assert.doesNotThrow(() => new OperatorProvider(100, 999));
});

test('resolution falls back through providers and records why each was skipped', async () => {
  const dead = new UnavailableProvider('sentinel offline', 'sentinel');
  const res = await resolveUsage([dead, new OperatorProvider(62, 25)], NOW, { publicSurface: true });
  assert.equal(res.provider.id, 'operator');
  assert.equal(res.reading.weeklyUtilizationPct, 62);
  assert.deepEqual(res.skipped, [{ id: 'sentinel', why: 'sentinel offline' }]);
});

test('an UNSUPPORTED provider is refused on a public surface, however good its data', async () => {
  // This is the §5.1 decision expressed in code. Reordering the list must not
  // let an internal-only source reach the public product.
  const internalOnly: UsageProvider = {
    id: 'oauth-internal',
    capabilities: { weeklyUtilization: true, recycleTiming: true, passiveObservation: true, supported: false },
    describe: () => 'internal only',
    read: async (now): Promise<UsageReading> => ({
      weeklyUtilizationPct: 88,
      hoursSinceRecycle: 3,
      observedAt: now.toISOString(),
      provenance: 'telemetry',
      providerId: 'oauth-internal',
      note: null,
    }),
  };

  const pub = await resolveUsage([internalOnly, new OperatorProvider(62, 25)], NOW, { publicSurface: true });
  assert.equal(pub.provider.id, 'operator', 'public surface must not use an unsupported source');
  assert.equal(pub.reading.weeklyUtilizationPct, 62);
  assert.equal(pub.skipped[0].why, 'unsupported source, and this is a public surface');

  const internal = await resolveUsage([internalOnly, new OperatorProvider(62, 25)], NOW, { publicSurface: false });
  assert.equal(internal.provider.id, 'oauth-internal', 'internal surface may use it');
  assert.equal(internal.reading.weeklyUtilizationPct, 88);
});

test('a throwing provider is skipped, not fatal', async () => {
  const broken: UsageProvider = {
    id: 'broken',
    capabilities: { weeklyUtilization: true, recycleTiming: true, passiveObservation: true, supported: true },
    describe: () => 'broken',
    read: async () => {
      throw new Error('connection reset');
    },
  };
  const res = await resolveUsage([broken, new OperatorProvider(70, 10)], NOW, { publicSurface: true });
  assert.equal(res.provider.id, 'operator');
  assert.match(res.skipped[0].why, /connection reset/);
});

test('with every provider exhausted, resolution still returns a renderable state', async () => {
  const res = await resolveUsage([new UnavailableProvider('a'), new UnavailableProvider('b', 'b')], NOW, { publicSurface: true });
  assert.equal(res.reading.weeklyUtilizationPct, null);
  assert.equal(res.provider.id, 'no-supported-telemetry');
  assert.equal(res.skipped.length, 2);
});

test('§5.1 — the forecast renders correctly with the sentinel offline', async () => {
  // Falling back to operator-entered utilisation must reproduce the baseline
  // forecast exactly. If it does not, the fallback path is not equivalent.
  const res = await resolveUsage([new UnavailableProvider('offline'), new OperatorProvider(62, 25)], NOW, {
    publicSurface: true,
  });
  const state = {
    ...CLAUDE_BASELINE,
    util: res.reading.weeklyUtilizationPct!,
    since: res.reading.hoursSinceRecycle!,
  };
  const pinned = new Date('2026-07-07T12:00:00Z');
  assert.equal(pct(claudeForecast(state, 'launch', pinned, 48).probability), 27);
  assert.equal(pct(claudeForecast(CLAUDE_BASELINE, 'launch', pinned, 48).probability), 27);
});

test('capabilities make the coverage gap legible', () => {
  // passiveObservation is the one that decides whether the §5.3 detection rule
  // ("utilisation dropped while the account issued no requests") is possible at all.
  assert.equal(NO_SUPPORTED_TELEMETRY.capabilities.passiveObservation, false);
  assert.equal(NO_SUPPORTED_TELEMETRY.capabilities.weeklyUtilization, false);
  assert.match(NO_SUPPORTED_TELEMETRY.describe(), /No usage measurement available/);
});
