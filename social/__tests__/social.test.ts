/**
 * Tests for the social-signal path. No network call anywhere — `fetch` is injected.
 *
 * The two that are not ordinary unit tests, and are the reason this file exists:
 *
 *  - **"a public surface gets no signal"** enforces the log-only decision in code.
 *    `tibo` carries the highest weight in either model and has never fired, so a
 *    future caller must confront that rather than pass a flag.
 *  - **"the bearer token never leaves the provider"** checks the one failure that
 *    would be unrecoverable: a credential in a log line or an error message.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { HINT_ONLY_CEILING, TERMS, WEIGHTS, classify, explainTerms } from '../classify.ts';
import { MAX_RESULTS, TRACKED_HANDLES, XApiProvider } from '../x-api.ts';
import { NO_SOCIAL_SIGNAL, PUBLIC_SURFACE_POLICY, isUsable, resolveSocialSignal } from '../provider.ts';
import { toLine } from '../poll.ts';
import { decodePostId, idAgreesWith } from '../../lib/snowflake.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const NOW = new Date('2026-07-27T12:00:00Z');

/** A post id that decodes to a known instant. From RUNBOOK §5. */
const KNOWN_ID = '2078320950488297917';
const KNOWN_UTC = '2026-07-18T03:28:22Z';

/** Build a fake fetch over a scripted set of responses. */
function fakeFetch(routes: Record<string, unknown>, { status = 200 }: { status?: number } = {}) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    if (status !== 200) return { ok: false, status, json: async () => ({}) } as unknown as Response;
    return { ok: true, status: 200, json: async () => routes[key] } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const USER_ROUTE = { '/users/by/username/': { data: { id: '99', username: 'thsottiaux' } } };

// ------------------------------------------------------------------ snowflake
test('a post id decodes to its own creation instant', () => {
  // Arithmetic, not testimony — which is why it is admissible where a mirror's
  // date label is not. This exact id was recorded twice under two timezone
  // conventions before the decode caught it.
  // To the second: sources state these to the second and the decode carries
  // milliseconds (…22.589Z). Pinning the ms would assert a digit no source claims.
  assert.equal(decodePostId(KNOWN_ID)?.toISOString().slice(0, 19), KNOWN_UTC.slice(0, 19));
  assert.equal(idAgreesWith(KNOWN_ID, KNOWN_UTC), true);
});

test('the decode catches a mislabelled tracker row', () => {
  // The real case: a tracker row labelled "Jul 21" cited an id decoding to Jul 25.
  assert.equal(idAgreesWith('2081096447718723984', '2026-07-21T17:47:00Z'), false);
  // Compared to the second, which is the precision sources actually state. The
  // decode carries milliseconds (…12.695Z); asserting those would pin a digit no
  // source claims and no reader cares about.
  assert.equal(decodePostId('2081096447718723984')?.toISOString().slice(0, 19), '2026-07-25T19:17:12');
});

test('an undecodable id returns null rather than a wrong instant', () => {
  for (const bad of ['', 'not-a-number', '12', null, undefined, {}]) {
    assert.equal(decodePostId(bad as never), null, `must not decode ${JSON.stringify(bad)}`);
  }
  assert.equal(idAgreesWith('nope', KNOWN_UTC), null);
});

// ------------------------------------------------------------------ classifier
test('an explicit reset statement scores strongly', () => {
  const c = classify('Resetting usage limits for all Codex users right now');
  assert.ok(c.strengthPct >= WEIGHTS.strong, `expected >= ${WEIGHTS.strong}, got ${c.strengthPct}`);
  assert.ok(c.matchedTerms.includes('reset usage limits') || c.matchedTerms.includes('resetting usage limits'));
  assert.ok(c.groups.includes('strong'));
});

test('a vaguepost is capped, because a hint is not an event', () => {
  const c = classify('something nice for you tomorrow 👀');
  assert.ok(c.strengthPct > 0, 'the register is genuinely predictive of something');
  assert.ok(c.strengthPct <= HINT_ONLY_CEILING, `hint-only must cap at ${HINT_ONLY_CEILING}, got ${c.strengthPct}`);
  assert.deepEqual(c.groups, ['hint']);
});

test('an unrelated post scores zero and matches nothing', () => {
  const c = classify('Beautiful weather in San Francisco today');
  assert.equal(c.strengthPct, 0);
  assert.deepEqual(c.matchedTerms, []);
});

test('a strength is never produced without its working', () => {
  // The audit discipline: a number nobody can inspect is not admissible.
  for (const text of ['resetting limits now', 'quota', 'stay tuned', 'nothing here']) {
    const c = classify(text);
    if (c.strengthPct > 0) assert.ok(c.matchedTerms.length > 0, `strength with no matched terms: ${text}`);
  }
});

test('a lower-group term inside a matched higher-group term is not counted twice', () => {
  // "usage limit" (moderate) is a substring of "resetting usage limits" (strong).
  // Counting both inflated every explicit reset statement by +20 and reported two
  // findings where there was one phrase.
  const c = classify('Resetting usage limits for everyone');
  assert.deepEqual(c.matchedTerms, ['resetting usage limits']);
  assert.deepEqual(c.groups, ['strong']);
  assert.equal(c.strengthPct, WEIGHTS.strong);

  // ...but a genuinely separate moderate term still counts.
  const both = classify('Resetting usage limits — your weekly limit too');
  assert.ok(both.matchedTerms.includes('weekly limit'));
  assert.ok(both.strengthPct > WEIGHTS.strong);
});

test('repeating a phrase is not new evidence', () => {
  const once = classify('quota').strengthPct;
  const twice = classify('quota and allowance').strengthPct;
  assert.ok(twice > once, 'a second distinct term adds something');
  assert.ok(twice < once * 2, 'but not a full second helping');
});

test('scoring is bounded to 0-100 even when everything matches', () => {
  const kitchenSink = [...TERMS.strong, ...TERMS.moderate, ...TERMS.hint].join(' ');
  const c = classify(kitchenSink);
  assert.ok(c.strengthPct <= 100 && c.strengthPct >= 0, `out of range: ${c.strengthPct}`);
});

test('the term list is printable, so the scorer can be audited', () => {
  const out = explainTerms();
  for (const g of ['strong', 'moderate', 'hint']) assert.match(out, new RegExp(g));
  assert.match(out, /reset usage limits/);
});

test('classify tolerates junk input', () => {
  for (const bad of [null, undefined, 42, {}]) {
    const c = classify(bad as never);
    assert.equal(c.strengthPct, 0);
  }
});

// ------------------------------------------------------------------ the provider
test('with no token, no request is made and nothing is spent', () => {
  const { impl, calls } = fakeFetch(USER_ROUTE);
  const p = new XApiProvider({ handle: 'thsottiaux', token: undefined, fetchImpl: impl });
  return p.read(NOW).then((r) => {
    assert.equal(r.provenance, 'unavailable');
    assert.match(r.note ?? '', /QRI_X_BEARER_TOKEN is not set/);
    assert.match(r.note ?? '', /nothing was spent/);
    assert.equal(calls.length, 0, 'a metered API must not be called without a credential');
    assert.match(p.describe(), /NO CREDENTIAL — inert/);
  });
});

test('a post is read, scored, and dated from its own id', async () => {
  const { impl, calls } = fakeFetch({
    ...USER_ROUTE,
    '/tweets': { data: [{ id: KNOWN_ID, text: 'Resetting usage limits for everyone', created_at: 'ignored' }] },
  });
  const p = new XApiProvider({ handle: 'thsottiaux', token: 'test-token', fetchImpl: impl });
  const r = await p.read(NOW);

  assert.equal(r.provenance, 'official-api');
  assert.equal(r.postId, KNOWN_ID);
  assert.ok(r.strengthPct !== null && r.strengthPct >= WEIGHTS.strong);
  // Age comes from the DECODE, not from created_at, which was deliberately junk.
  const expected = (NOW.getTime() - Date.parse(KNOWN_UTC)) / 3_600_000;
  assert.ok(Math.abs((r.ageHours as number) - expected) < 0.02, `age ${r.ageHours} vs ${expected}`);
  assert.ok(isUsable(r));
  assert.ok(calls.some((c) => c.includes('max_results=' + MAX_RESULTS)), 'must bound what it pays to read');
  assert.ok(calls.some((c) => c.includes('exclude=retweets')));
});

test('since_id is sent, so a quiet interval costs nothing', async () => {
  const { impl, calls } = fakeFetch({ ...USER_ROUTE, '/tweets': { data: [] } });
  const p = new XApiProvider({ handle: 'thsottiaux', token: 't', fetchImpl: impl, sinceId: '123', userId: '99' });
  const r = await p.read(NOW);
  assert.ok(calls.some((c) => c.includes('since_id=123')));
  assert.ok(!calls.some((c) => c.includes('/users/by/username/')), 'a cached user id must skip the metered lookup');
  assert.equal(r.provenance, 'unavailable');
  assert.match(r.note ?? '', /no posts newer than since_id/);
});

test('an empty poll is NOT reported as strength zero', async () => {
  // "The account has posted nothing new" says nothing about how old the newest
  // post is, which is what the model needs. A silent zero would assert quiet.
  const { impl } = fakeFetch({ ...USER_ROUTE, '/tweets': { data: [] } });
  const r = await new XApiProvider({ handle: 'thsottiaux', token: 't', fetchImpl: impl, userId: '99' }).read(NOW);
  assert.equal(r.strengthPct, null);
  assert.equal(r.ageHours, null);
});

test('the strongest post in a burst wins', async () => {
  const { impl } = fakeFetch({
    ...USER_ROUTE,
    '/tweets': {
      data: [
        { id: '2078320950488297918', text: 'thanks everyone' },
        { id: KNOWN_ID, text: 'Resetting usage limits now' },
      ],
    },
  });
  const r = await new XApiProvider({ handle: 'thsottiaux', token: 't', fetchImpl: impl, userId: '99' }).read(NOW);
  assert.equal(r.postId, KNOWN_ID);
});

test('an API error degrades to no signal rather than throwing', async () => {
  const { impl } = fakeFetch({ ...USER_ROUTE, '/tweets': {} }, { status: 429 });
  const r = await new XApiProvider({ handle: 'thsottiaux', token: 't', fetchImpl: impl, userId: '99' }).read(NOW);
  assert.equal(r.provenance, 'unavailable');
  assert.match(r.note ?? '', /429/);
});

test('the bearer token never leaves the provider', async () => {
  // The one unrecoverable failure. Checked on the reading, the stored line, and
  // the human-readable description.
  const TOKEN = 'super-secret-bearer-value';
  const { impl } = fakeFetch({ ...USER_ROUTE, '/tweets': {} }, { status: 401 });
  const p = new XApiProvider({ handle: 'thsottiaux', token: TOKEN, fetchImpl: impl, userId: '99' });
  const r = await p.read(NOW);

  assert.ok(!JSON.stringify(r).includes(TOKEN), 'token must not appear in the reading');
  assert.ok(!JSON.stringify(toLine(r)).includes(TOKEN), 'token must not appear in the stored line');
  assert.ok(!p.describe().includes(TOKEN), 'token must not appear in describe()');
  assert.ok(!JSON.stringify(Object.entries(p)).includes(TOKEN), 'token must not be enumerable on the instance');
});

test('capabilities declare that this costs money', () => {
  const p = new XApiProvider({ handle: 'thsottiaux', token: 't' });
  assert.equal(p.capabilities.metered, true, 'a scheduler must be able to see the cost');
  assert.equal(p.capabilities.supported, true);
});

test('both weighted accounts are tracked', () => {
  // Model A carries `tibo` (@thsottiaux) and Model B carries `dev` (@ClaudeDevs).
  // Building only the first would leave Model B's term dead for no reason.
  assert.equal(TRACKED_HANDLES.codex, 'thsottiaux');
  assert.equal(TRACKED_HANDLES.claudeCode, 'ClaudeDevs');
});

// ------------------------------------------------------------------ the policy
test('a public surface gets NO signal, whatever the provider says', async () => {
  // THE LOG-ONLY DECISION, ENFORCED. tibo is w=1.45, the highest weight in either
  // model, and has never fired — so it must not move a published number before a
  // labelled sample exists to fit it against.
  const { impl, calls } = fakeFetch({
    ...USER_ROUTE,
    '/tweets': { data: [{ id: KNOWN_ID, text: 'Resetting usage limits for everyone' }] },
  });
  const p = new XApiProvider({ handle: 'thsottiaux', token: 't', fetchImpl: impl, userId: '99' });

  const { reading, skipped } = await resolveSocialSignal([p], NOW, { publicSurface: true });
  assert.equal(reading.strengthPct, null);
  assert.equal(reading.provenance, 'unavailable');
  assert.match(reading.note ?? '', new RegExp(PUBLIC_SURFACE_POLICY));
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /does not move a published number/);
  assert.equal(calls.length, 0, 'and it should not even spend money to be refused');
});

test('resolution reports why each provider was skipped', async () => {
  const unsupported = {
    id: 'scraper',
    handle: 'thsottiaux',
    capabilities: { postDiscovery: true, contentAccess: true, supported: false, metered: false },
    describe: () => 'not a supported integration',
    read: async () => NO_SOCIAL_SIGNAL('thsottiaux', 'scraper', NOW, 'should never be called'),
  };
  const { reading, skipped } = await resolveSocialSignal([unsupported], NOW);
  assert.equal(reading.provenance, 'unavailable');
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /not a supported integration/);
});

test('a throwing provider is skipped, not fatal', async () => {
  const thrower = {
    id: 'boom',
    handle: 'thsottiaux',
    capabilities: { postDiscovery: true, contentAccess: true, supported: true, metered: false },
    describe: () => 'throws',
    read: async () => {
      throw new Error('network down');
    },
  };
  const { reading, skipped } = await resolveSocialSignal([thrower], NOW);
  assert.equal(reading.provenance, 'unavailable');
  assert.match(skipped[0].reason, /network down/);
});

// ------------------------------------------------------------------ what gets stored
test('post TEXT is never stored, only the id and the matched terms', async () => {
  // X's terms restrict redisplay of post content, and this project publishes what
  // it holds. The id keeps it auditable without becoming a republisher.
  const TEXT = 'Resetting usage limits for everyone, enjoy the weekend';
  const { impl } = fakeFetch({ ...USER_ROUTE, '/tweets': { data: [{ id: KNOWN_ID, text: TEXT }] } });
  const r = await new XApiProvider({ handle: 'thsottiaux', token: 't', fetchImpl: impl, userId: '99' }).read(NOW);
  const line = JSON.stringify(toLine(r));

  assert.ok(!line.includes('enjoy the weekend'), 'post prose must not be stored');
  assert.ok(line.includes(KNOWN_ID), 'the id must be, so the post can be opened');
  assert.ok(line.includes('resetting usage limits'), 'matched terms must be, so the score is auditable');
  // The stored terms are the phrases the scorer keyed on, verbatim, not paraphrases.
  assert.ok(r.matchedTerms.includes('resetting usage limits'));
  for (const t of r.matchedTerms) assert.ok(TEXT.toLowerCase().includes(t), `not verbatim: ${t}`);
});

test('the published site does not depend on social/', () => {
  // Same invariant as capture/: nothing served to anyone may depend on this path
  // while the signal is log-only.
  const pattern = String.raw`(from|import|require)\s*\(?\s*['"][^'"]*\.\./social/|(from|import)\s+['"][^'"]*social/`;
  const hits = spawnSync(
    'grep',
    ['-rnE', '--include=*.ts', '--include=*.mjs', pattern, 'site', 'models', 'scripts', 'status', 'usage'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(hits.stdout.trim(), '', `nothing outside social/ may import it yet:\n${hits.stdout}`);
});
