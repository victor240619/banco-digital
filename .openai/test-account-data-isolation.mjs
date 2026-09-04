import assert from 'node:assert/strict';
import { sanitizeAccountSnapshot } from '../bravus-bank-frontend/src/lib/accountDataIsolation.js';

const currentUser = { username: 'cliente-a' };
const ownSnapshot = {
  profile: { username: 'cliente-a', cpf: '11144477735', accountNumber: '123456', email: 'a@example.test' },
  me: { username: 'cliente-a' },
  transactions: [
    { id: 1, username: 'cliente-a', amount: 100 },
    { id: 2, username: 'cliente-b', amount: 999999 },
  ],
  externalOrders: [
    { id: 10, payerUsername: 'cliente-a' },
    { id: 11, payerUsername: 'cliente-b' },
  ],
};

const sanitized = sanitizeAccountSnapshot(ownSnapshot, currentUser);
assert.deepEqual(sanitized.transactions.map((item) => item.id), [1]);
assert.deepEqual(sanitized.externalOrders.map((item) => item.id), [10]);

assert.throws(
  () => sanitizeAccountSnapshot({ ...ownSnapshot, profile: { username: 'cliente-b' } }, currentUser),
  /ACCOUNT_DATA_OWNERSHIP_MISMATCH/,
  'a response for another authenticated account must be rejected in full',
);

assert.throws(
  () => sanitizeAccountSnapshot({ ...ownSnapshot, profile: null }, currentUser),
  /ACCOUNT_DATA_OWNER_MISSING/,
  'account data without an explicit owner must fail closed',
);

console.log(JSON.stringify({ result: 'ok', accountDataIsolationVerified: true }));
