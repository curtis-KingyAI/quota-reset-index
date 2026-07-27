/**
 * Tests for X credential handling.
 *
 * The two that matter: a world-readable token file is REFUSED rather than warned
 * about, and nothing here can leak the value — `xTokenSource()` exists so the
 * operator can verify their setup while an agent remains unable to read the secret.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { isPrivate, readXToken, xTokenSource } from '../x-token.mjs';

const SECRET = 'AAAAAAAAAAAAAAAAAAAAA-fake-bearer-for-tests';

const withFile = (contents, mode, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'qri-tok-'));
  const file = join(dir, 'x-token');
  writeFileSync(file, contents);
  chmodSync(file, mode);
  try {
    return fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('the environment wins over the file — explicit beats ambient', () => {
  withFile(SECRET, 0o600, (file) => {
    assert.equal(readXToken({ file, env: { QRI_X_BEARER_TOKEN: 'from-env' } }), 'from-env');
    assert.equal(xTokenSource({ file, env: { QRI_X_BEARER_TOKEN: 'from-env' } }).source, 'QRI_X_BEARER_TOKEN');
  });
});

test('a mode-600 file is read, and whitespace is trimmed', () => {
  withFile(`  ${SECRET}\n`, 0o600, (file) => {
    assert.equal(readXToken({ file, env: {} }), SECRET);
  });
});

test('⚠️ a group/world-readable token file is REFUSED, not warned about', () => {
  // A credential others can read is worse than none, because it looks secure. A
  // warning on a secret is a line someone scrolls past; a refusal is not.
  for (const mode of [0o644, 0o640, 0o604, 0o666]) {
    withFile(SECRET, mode, (file) => {
      assert.equal(readXToken({ file, env: {} }), null, `mode ${mode.toString(8)} must be refused`);
      const s = xTokenSource({ file, env: {} });
      assert.equal(s.present, false);
      assert.match(s.note, /readable by group or others — REFUSED/);
      assert.match(s.note, /chmod 600/, 'must say how to fix it');
    });
  }
});

test('isPrivate is the actual owner-only check', () => {
  withFile(SECRET, 0o600, (f) => assert.equal(isPrivate(f), true));
  withFile(SECRET, 0o400, (f) => assert.equal(isPrivate(f), true));
  withFile(SECRET, 0o644, (f) => assert.equal(isPrivate(f), false));
  assert.equal(isPrivate('/nonexistent/qri/x-token'), false, 'a missing file is not "private"');
});

test('missing and empty are distinguished, and both explain themselves', () => {
  const missing = xTokenSource({ file: '/nonexistent/qri/x-token', env: {} });
  assert.equal(missing.present, false);
  assert.match(missing.note, /no QRI_X_BEARER_TOKEN in the environment and no file/);

  withFile('   \n', 0o600, (file) => {
    const empty = xTokenSource({ file, env: {} });
    assert.equal(empty.present, false);
    assert.match(empty.note, /exists but is empty/);
  });
});

test('THE SECRET NEVER APPEARS IN WHAT xTokenSource RETURNS', () => {
  // The whole point of that function: an operator can confirm their setup works
  // without ever showing the credential to an agent. If this ever fails, the
  // verification path has become an exfiltration path.
  withFile(SECRET, 0o600, (file) => {
    const s = xTokenSource({ file, env: {} });
    assert.equal(s.present, true);
    assert.equal(s.length, SECRET.length, 'length is reported — that is not the value');
    const serialised = JSON.stringify(s);
    assert.ok(!serialised.includes(SECRET), 'the token leaked into xTokenSource output');
    assert.ok(!serialised.includes(SECRET.slice(0, 12)), 'even a prefix of the token must not appear');
  });

  const fromEnv = xTokenSource({ file: '/nonexistent', env: { QRI_X_BEARER_TOKEN: SECRET } });
  assert.ok(!JSON.stringify(fromEnv).includes(SECRET), 'the env token leaked');
});

test('the provider reports PRESENCE, never content', async () => {
  const { XApiProvider } = await import('../../social/x-api.ts');
  const p = new XApiProvider({ handle: 'thsottiaux', token: SECRET });
  assert.ok(!p.describe().includes(SECRET));
  assert.match(p.describe(), /Credential present\./);
  assert.ok(!JSON.stringify(Object.entries(p)).includes(SECRET), 'must not be enumerable on the instance');
});
