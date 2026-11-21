import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../bravus-bank-frontend/package.json', import.meta.url));
const { build } = require('esbuild');
const directory = await mkdtemp(path.join(tmpdir(), 'vantyx-login-test-'));
const originalWindow = globalThis.window;
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

try {
  globalThis.window = { location: { hostname: 'localhost', protocol: 'http:', pathname: '/login' },
    localStorage: storage(), sessionStorage: storage() };
  const outfile = path.join(directory, 'api.cjs');
  await build({ entryPoints: [path.join(root, 'bravus-bank-frontend/src/services/api.js')],
    bundle: true, platform: 'node', format: 'cjs', outfile, define: { 'import.meta.env': '{}' } });
  const { default: api, authService } = require(outfile);
  let calls = 0;
  api.defaults.adapter = async (config) => {
    calls++;
    assert.equal(config.headers.Authorization, undefined, 'old tokens must not reach login');
    // Render production startup observed at 87 seconds. Simulate its timeout boundary without waiting.
    assert.ok(config.timeout > 87000, 'login must survive the observed cold start');
    return { data: { token: 'synthetic-session', username: 'fixture', roles: ['ROLE_ADMIN'] },
      status: 200, statusText: 'OK', config, headers: {} };
  };
  api.defaults.headers.common.Authorization = 'Bearer stale-synthetic-token';
  const result = await authService.login('fixture', 'synthetic-password');
  assert.deepEqual(result.roles, ['ROLE_ADMIN']);
  assert.equal(calls, 1, 'login must not be retried automatically');
  assert.equal(api.defaults.timeout, 20000, 'banking operations keep their existing timeout');

  for (const code of ['ECONNABORTED', 'ERR_NETWORK']) {
    calls = 0;
    const failure = Object.assign(new Error('synthetic connection failure'), { code });
    api.defaults.adapter = async () => { calls++; throw failure; };
    await assert.rejects(authService.login('fixture', 'synthetic-password'), (error) => error === failure);
    assert.equal(calls, 1, 'failed authentication requests must not be replayed');
    assert.equal(authService.isAuthenticated(), false, 'failed login must not preserve an old session');
  }
  console.log('PASS: cold-start login, admin response, no replay, stale-token isolation, failed-session cleanup');
} finally {
  globalThis.window = originalWindow;
  await rm(directory, { recursive: true, force: true });
}
