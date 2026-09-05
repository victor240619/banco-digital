import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { createAccountAppDetector, accountDestination } from '../bravus-bank-frontend/src/lib/accountApp.js';

const frontend = resolve('bravus-bank-frontend');
process.env.NODE_ENV ||= 'production';
const require = createRequire(resolve(frontend, 'package.json'));
const { build } = require('esbuild');
const browser = (overrides = {}) => ({
  location: { pathname: '/', protocol: 'https:' },
  navigator: { userAgent: 'Mozilla/5.0 Chrome/140.0 Safari/537.36' },
  matchMedia: () => ({ matches: false }),
  sessionStorage: (() => {
    const values = new Map();
    return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  })(),
  ...overrides,
});
assert.equal(createAccountAppDetector()(null), false);
assert.equal(createAccountAppDetector()(browser()), false, 'ordinary website remains institutional');
assert.equal(createAccountAppDetector()(browser({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36' } })), false, 'mobile browser is not automatically an app');
assert.equal(createAccountAppDetector()(browser(), true), true);
assert.equal(createAccountAppDetector()(browser({ navigator: { standalone: true } })), true, 'iOS home-screen install');
assert.equal(createAccountAppDetector()(browser({ matchMedia: (query) => ({ matches: query === '(display-mode: standalone)' }) })), true);
assert.equal(createAccountAppDetector()(browser({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Phone Build/123; wv) Chrome/140 Mobile' } })), true, 'legacy APK fallback');
assert.equal(createAccountAppDetector()(browser({ navigator: { userAgent: 'Mozilla/5.0 VantyxBankApp' } })), true);
const appBrowser = browser({ location: { pathname: '/app' } });
const detector = createAccountAppDetector();
assert.equal(detector(appBrowser), true);
appBrowser.location.pathname = '/empresa/sobre';
assert.equal(detector(appBrowser), true, 'SPA navigation must not leave account-only mode');
assert.equal(createAccountAppDetector()(appBrowser), true, 'reload in same tab preserves account-only mode');
const unavailableStorage = browser({ location: { pathname: '/app' } });
Object.defineProperty(unavailableStorage, 'sessionStorage', { get() { throw Error('disabled'); } });
const noStorageDetector = createAccountAppDetector();
assert.equal(noStorageDetector(unavailableStorage), true);
unavailableStorage.location.pathname = '/';
assert.equal(noStorageDetector(unavailableStorage), true);

const states = [
  { authenticated: false, admin: false, identityEvidenceRequired: false, destination: '/login' },
  { authenticated: false, admin: true, identityEvidenceRequired: true, destination: '/login' },
  { authenticated: true, admin: false, identityEvidenceRequired: false, destination: '/dashboard' },
  { authenticated: true, admin: false, identityEvidenceRequired: true, destination: '/completar-identidade' },
  { authenticated: true, admin: true, identityEvidenceRequired: false, destination: '/admin' },
];
for (const state of states) assert.equal(accountDestination(state), state.destination);

// Execute the real channel module, including Capacitor bridge initialization.
const channelBuild = await build({ entryPoints: [resolve(frontend, 'src/lib/appChannel.js')], bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' } });
function channelFor(win) {
  const context = { ...win, module: { exports: {} }, exports: {}, console };
  context.window = context;
  vm.runInNewContext(channelBuild.outputFiles[0].text, context);
  return context.module.exports;
}
for (const win of [browser(), browser({ location: { pathname: '/app' } }), browser({ navigator: { standalone: true } })]) {
  const channel = channelFor(win);
  channel.isAccountApp();
  assert.equal(channel.getAppClientChannel(), 'WEB', 'presentation mode must not grant a native API channel');
  assert.equal(channel.getAppClientHeader(), null);
}
const android = channelFor(browser({ androidBridge: {} }));
assert.equal(android.isAccountApp(), true, 'bridge must be initialized before first render');
assert.equal(android.isMobileApp(), true);
assert.equal(android.getAppClientChannel(), 'ANDROID_APK');
const ios = channelFor(browser({ webkit: { messageHandlers: { bridge: {} } } }));
assert.equal(ios.isAccountApp(), true);
assert.equal(ios.getAppClientChannel(), 'IOS_APP');

// Render the actual route tree without network, customers or a browser. Lazy page
// bodies are markers; Navbar and all route guards remain the production code.
const reactPath = JSON.stringify(require.resolve('react'));
const routerPath = JSON.stringify(require.resolve('react-router-dom'));
const serverRouterPath = JSON.stringify(require.resolve('react-router-dom/server'));
const appSource = await readFile(resolve(frontend, 'src/App.jsx'), 'utf8');
const result = await build({
  stdin: {
    contents: appSource.replace(/const (\w+) = lazy\(\(\) => import\('([^']+)'\)\);/g, 'import $1 from \'$2\';'),
    resolveDir: resolve(frontend, 'src'), loader: 'jsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'isolated-route-fixtures', setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.path === 'react' || args.path === require.resolve('react')) {
        return { path: require.resolve('react'), external: true };
      }
      if ([require.resolve('react-router-dom'), require.resolve('react-router-dom/server')].includes(args.path)) {
        return { path: args.path, external: true };
      }
    });
    build.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router-fixture', namespace: 'fixture' }));
    build.onResolve({ filter: /\/services\/api$/ }, () => ({ path: 'auth-fixture', namespace: 'fixture' }));
    build.onResolve({ filter: /\/lib\/appChannel$/ }, () => ({ path: 'channel-fixture', namespace: 'fixture' }));
    build.onResolve({ filter: /\.\/pages\// }, (args) => ({ path: args.path, namespace: 'page-fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'page-fixture' }, ({ path }) => ({ contents: `import React from ${reactPath}; export default () => React.createElement('section', { 'data-page': ${JSON.stringify(path)} });` }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'router-fixture'
      ? `import React from ${reactPath}; export * from ${routerPath}; import { StaticRouter } from ${serverRouterPath}; export const BrowserRouter = ({children}) => React.createElement(StaticRouter, {location: globalThis.testPath}, children); export const Navigate = ({to}) => React.createElement('i', {'data-redirect': to});`
      : path === 'auth-fixture'
        ? `export const authService = { isAuthenticated: () => globalThis.testState.authenticated, hasRole: () => globalThis.testState.admin, getCurrentUser: () => globalThis.testState, logout: async () => {} };`
        : `export const isAccountApp = () => globalThis.testApp; export const isMobileApp = () => false;` }));
  } }],
});
const context = { module: { exports: {} }, exports: {}, require, console, process, TextEncoder, TextDecoder, setTimeout, clearTimeout };
vm.runInNewContext(result.outputFiles[0].text, context);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// Use the same React instance as the server renderer (the bundle's React is
// externalized below by module loading through Node's require cache).
const appModule = context.module.exports;
const render = (path, app, state) => {
  context.testPath = path;
  context.testApp = app;
  context.testState = state;
  return renderToStaticMarkup(React.createElement(appModule.default));
};
let routeCases = 0;
for (const state of states) {
  for (const path of ['/', '/app', '/produto/conta-digital', '/empresa/sobre', '/canais-atendimento', '/desconhecida']) {
    const html = render(path, true, state);
    assert.ok(html.includes(`data-redirect="${state.destination}"`), `${path}: ${state.destination}`);
    assert.doesNotMatch(html, /data-page|vantyx-footer|vantyx-nav/);
    routeCases++;
  }
}
const anonymous = states[0];
for (const path of ['/login', '/register', '/redefinir-senha']) {
  const html = render(path, true, anonymous);
  assert.match(html, /data-page/);
  assert.doesNotMatch(html, /vantyx-nav|vantyx-footer/);
}
assert.match(render('/dashboard', true, anonymous), /data-redirect="\/login"/);
assert.match(render('/dashboard', true, states[2]), /data-page="\.\/pages\/UserDashboard"/);
assert.match(render('/login', true, states[2]), /data-redirect="\/dashboard"/);
assert.match(render('/admin', true, states[2]), /data-redirect="\/dashboard"/);
assert.match(render('/', false, anonymous), /data-page="\.\/pages\/Home"/);
assert.match(render('/empresa/sobre', false, anonymous), /data-page="\.\/pages\/InstitutionalPage"/);

const manifest = JSON.parse(await readFile(resolve(frontend, 'public/site.webmanifest'), 'utf8'));
const config = JSON.parse(await readFile(resolve(frontend, 'capacitor.config.json'), 'utf8'));
assert.equal(manifest.id, '/', 'preserve installed PWA identity');
assert.equal(manifest.start_url, '/app');
assert.equal(config.appId, 'com.bravus.bank', 'preserve installed native app identity');
assert.equal(config.server.url, 'https://bravusbank.com');
assert.equal(config.server.appStartPath, manifest.start_url);
assert.equal(config.appendUserAgent, 'VantyxBankApp');
console.log(JSON.stringify({ result: 'ok', routeCases, installedAppDetection: true, webPreserved: true, nativeAuthorizationUnchanged: true }));
