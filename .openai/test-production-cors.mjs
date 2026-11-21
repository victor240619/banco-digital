import assert from 'node:assert/strict';

// Standalone Spring API only. The restored bank frontend uses the original
// Sites Worker, whose CORS contract is separate and unchanged by this repair.
// Read-only preflights: never sends credentials, transactions or account data.
const endpoints = [
  'https://bravus-bank-api.onrender.com/api/auth/login',
];
const trusted = [
  'https://vantyxbank.com', 'https://www.vantyxbank.com',
  'https://bravusbank.com', 'https://www.bravusbank.com',
];
for (const endpoint of endpoints) {
  for (const origin of [...trusted, 'https://untrusted.example']) {
    const response = await fetch(endpoint, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-bravus-client',
      },
      signal: AbortSignal.timeout(120_000),
    });
    const allowed = response.headers.get('access-control-allow-origin');
    if (trusted.includes(origin)) {
      assert.equal(response.status, 200, `${endpoint}: ${origin} rejected`);
      if (new URL(endpoint).origin === origin) {
        // Spring's same-origin path needs no CORS response headers.
        assert(allowed === null || allowed === origin);
      } else {
        assert.equal(allowed, origin, 'Only the exact requesting origin may be allowed');
        assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
        const headers = (response.headers.get('access-control-allow-headers') || '').toLowerCase();
        assert(headers.includes('content-type') && headers.includes('x-bravus-client'));
      }
    } else {
      assert.equal(response.status, 403);
      assert.equal(allowed, null, 'Untrusted sites must remain blocked');
    }
    console.log(`${response.status} ${new URL(endpoint).host} <- ${origin}`);
  }
}
console.log('Standalone Spring CORS: 5 read-only checks passed. Real account access is not tested.');
