import assert from 'node:assert/strict';
import { createAuthSessionStore } from '../bravus-bank-frontend/src/lib/authSessionStore.js';

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const persistent = new MemoryStorage({
  token: 'legacy-native-token',
  user: JSON.stringify({ username: 'legacy.user', token: 'legacy-native-token' }),
});
const transient = new MemoryStorage({
  token: 'legacy-session-token',
  user: JSON.stringify({ username: 'legacy.session' }),
});
let native = true;
const store = createAuthSessionStore({
  isNative: () => native,
  getPersistentStorage: () => persistent,
  getTransientStorage: () => transient,
});

store.initialize();
assert.equal(store.getToken(), null, 'native launch must start without an authenticated session');
assert.equal(persistent.getItem('token'), null, 'native launch must remove legacy persistent tokens');
assert.equal(persistent.getItem('user'), null, 'native launch must remove legacy persistent users');
assert.equal(transient.getItem('token'), null, 'native launch must remove transient tokens');

const loginVersion = store.getVersion();
assert.equal(store.set({
  token: 'volatile-native-token',
  username: 'native.user',
  roles: ['ROLE_USER'],
}, { expectedVersion: loginVersion }), true);
assert.equal(store.getToken(), 'volatile-native-token');
assert.equal(store.getUser().username, 'native.user');
assert.equal(persistent.getItem('token'), null, 'native tokens must never be written to persistent storage');
assert.equal(transient.getItem('token'), null, 'native tokens must never be written to session storage');

const pendingLoginVersion = store.getVersion();
store.clear();
assert.equal(store.set({
  token: 'late-response-token',
  username: 'late.response',
}, { expectedVersion: pendingLoginVersion }), false, 'a login response arriving after background logout must be discarded');

store.set({
  token: 'second-volatile-token',
  username: 'native.user',
}, { expectedVersion: store.getVersion() });
store.initialize();
assert.equal(store.getToken(), null, 'a new native process must require login again');
assert.equal(store.getUser(), null);

native = false;
assert.equal(store.set({
  token: 'web-token',
  username: 'web.user',
  roles: ['ROLE_USER'],
}, { expectedVersion: store.getVersion() }), true);
assert.equal(persistent.getItem('token'), 'web-token', 'web sessions keep the existing browser behavior');
assert.equal(JSON.parse(persistent.getItem('user')).token, undefined, 'the user profile must not duplicate the bearer token');

console.log(JSON.stringify({
  result: 'ok',
  nativePersistentTokenRemoved: true,
  nativeMemoryOnlySessionVerified: true,
  coldStartLoginRequired: true,
  lateLoginResponseDiscarded: true,
  webBehaviorPreserved: true,
}));
