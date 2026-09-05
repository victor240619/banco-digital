import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

// Execute the packaged worker, with no network or production database.
const { default: worker } = await import(pathToFileURL(join(tmpdir(), 'bravus-sites-embedded-artifact/index.mjs')));
const hosts = ['vantyxbank.com', 'www.vantyxbank.com', 'bravusbank.com', 'www.bravusbank.com'];
const noDatabase = { get DB() { throw new Error('Static routes must not touch account data'); } };
let pages = 0;
for (const host of hosts) {
  for (const path of ['/', '/app', '/login', '/register', '/dashboard', '/redefinir-senha']) {
    for (const userAgent of ['Mozilla/5.0', 'Mozilla/5.0 VantyxBankApp']) {
      const response = await worker.fetch(new Request(`https://${host}${path}`, { headers: { 'user-agent': userAgent } }), noDatabase);
      assert.equal(response.status, 200, `${host}${path}`);
      assert.equal(response.headers.get('location'), null, 'legacy WebViews must not leave their origin');
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal(response.headers.get('permissions-policy'), 'camera=(self)');
      assert.match(await response.text(), /<title>Vantyx Bank/);
      pages++;
    }
  }
  // Missing persistence must still fail closed through the API, never redirect
  // requests or turn an error into a successful HTML page.
  for (const method of ['GET', 'POST', 'OPTIONS']) {
    const response = await worker.fetch(new Request(`https://${host}/api/auth/login`, { method }), {});
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('location'), null);
    assert.equal((await response.json()).code, 'D1_UNAVAILABLE');
    assert.match(response.headers.get('access-control-allow-headers'), /authorization/);
  }
}

for (const method of ['GET', 'HEAD']) {
  for (const path of ['/', '/app', '/login?next=%2Fdashboard', '//external.invalid/path?x=1']) {
    const response = await worker.fetch(new Request(`https://preview.chatgpt.site${path}`, { method }), noDatabase);
    assert.equal(response.status, 308);
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.origin, 'https://vantyxbank.com');
    assert.equal(destination.pathname + destination.search, path);
  }
}
const technicalApi = await worker.fetch(new Request('https://preview.chatgpt.site/api/auth/login', { method: 'POST' }), {});
assert.equal(technicalApi.status, 503);
assert.equal(technicalApi.headers.get('location'), null);

// Run the real frontend URL selection and native channel detection with a
// network-free Axios fixture. Environment overrides keep their precedence.
const frontend = resolve('bravus-bank-frontend');
const require = createRequire(join(frontend, 'package.json'));
const { build } = require('esbuild');
async function buildApi(env) {
  const result = await build({
    entryPoints: [join(frontend, 'src/services/api.js')], bundle: true,
    write: false, platform: 'browser', format: 'cjs',
    define: { 'import.meta.env': JSON.stringify(env) },
    plugins: [{ name: 'network-free-axios', setup(builder) {
      builder.onResolve({ filter: /^axios$/ }, () => ({ path: 'axios', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents:
        'export default { create: defaults => ({ defaults, interceptors: { request: { use() {} }, response: { use() {} } } }) };',
      }));
    } }],
  });
  return (host, native = false) => {
    const context = { module: { exports: {} }, exports: {}, console,
      location: { hostname: host, protocol: 'https:', pathname: '/' },
      navigator: { userAgent: 'Mozilla/5.0' },
      ...(native ? { androidBridge: {} } : {}),
    };
    context.window = context;
    vm.runInNewContext(result.outputFiles[0].text, context);
    return context.module.exports.default.defaults.baseURL;
  };
}
const apiFor = await buildApi({});
for (const host of hosts) {
  assert.equal(apiFor(host), 'https://vantyxbank.com/api');
  assert.equal(apiFor(host, true), 'https://vantyxbank.com/api');
}
assert.equal(apiFor('localhost'), 'http://localhost:9000/api');
assert.equal(apiFor('127.0.0.1'), 'http://127.0.0.1:9000/api');
const explicitApi = await buildApi({ VITE_API_URL: 'https://api.example.invalid/api' });
assert.equal(explicitApi('vantyxbank.com'), 'https://api.example.invalid/api');
assert.equal(explicitApi('bravusbank.com', true), 'https://api.example.invalid/api');
const mobileApi = await buildApi({ VITE_MOBILE_API_URL: 'https://mobile.example.invalid/api' });
assert.equal(mobileApi('bravusbank.com', true), 'https://mobile.example.invalid/api');
assert.equal(mobileApi('vantyxbank.com'), 'https://vantyxbank.com/api');

console.log(JSON.stringify({ result: 'ok', pages, legacyWebViewPreserved: true, canonicalRedirectSafe: true, apiOriginVerified: true, overridesPreserved: true, noProductionDataUsed: true }));
