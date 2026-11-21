import assert from 'node:assert/strict';
import { probeOriginalLogin } from './diagnostics/original-login-probe.mjs';
let calls = [];
let result = await probeOriginalLogin(' fixture ', 'fake-password', async (url, options) => {
  calls.push({ url, options });
  if (calls.length === 1) return new Response(JSON.stringify({ token: 'fixture-token', roles: ['ROLE_ADMIN'], balance: 999 }), { status: 200 });
  return new Response('{}', { status: 200 });
});
assert.deepEqual(result, { result: 'matched', administrator: true, sessionClosed: true });
assert.equal(calls.length, 2);
assert.equal(calls[0].url, 'https://bravusbank.com/api/auth/login');
assert.deepEqual(JSON.parse(calls[0].options.body), { username: 'fixture', password: 'fake-password', clientChannel: 'WEB' });
assert.equal(calls[1].url, 'https://bravusbank.com/api/auth/logout');
assert.equal(calls[1].options.headers.Authorization, 'Bearer fixture-token');
for (const c of calls) {
  assert.equal(c.options.credentials, 'omit');
  assert.equal(c.options.redirect, 'error');
  assert(!/password\/|transfer|reset/.test(c.url));
}
let attempts = 0;
result = await probeOriginalLogin('fixture', 'fake', async () => { attempts++; throw new Error('synthetic timeout'); });
assert.deepEqual(result, { result: 'unavailable' }); assert.equal(attempts, 1);
result = await probeOriginalLogin('fixture', 'fake', async () => new Response(JSON.stringify('Invalid username or password'), { status: 400 }));
assert.deepEqual(result, { result: 'rejected' });
result = await probeOriginalLogin('fixture', 'fake', async () => new Response(JSON.stringify({ code: 'INITIAL_PASSWORD_CHANGE_REQUIRED', initialPasswordChangeToken: 'never-return-this' }), { status: 403 }));
assert.deepEqual(result, { result: 'matched_restricted' });
calls = [];
result = await probeOriginalLogin('fixture', 'fake', async (url) => { calls.push(url); return calls.length === 1 ? new Response(JSON.stringify({ token: 'fixture-token' })) : new Response('{}', { status: 503 }); });
assert.deepEqual(result, { result: 'matched', administrator: false, sessionClosed: false });
assert.equal(calls.length, 2);
console.log('PASS: original login probe, fixed recipient, no token/data returned, test-session logout, no retries, failure and restriction paths.');
