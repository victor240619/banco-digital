import assert from 'node:assert/strict';
import { buildReceiptModel, formatReceiptAmount, receiptState } from '../bravus-bank-frontend/src/lib/receiptModel.js';
import { downloadReceiptDocument, shareReceiptDocument } from '../bravus-bank-frontend/src/lib/receiptActions.js';
import { receiptFixture } from './receipt-fixture.mjs';
const baseline = JSON.stringify(receiptFixture);
const model = buildReceiptModel(receiptFixture);
assert.equal(model.kind, 'success');
assert.ok(model.amount.includes('1.250,00'));
assert.ok(!JSON.stringify(model).includes('00000000000'));
assert.ok(model.parties[0].account.includes('4821'));
assert.ok(model.date.includes('14:32'));
assert.equal(JSON.stringify(receiptFixture), baseline);
// Synthetic identifiers only: the six middle digits identify each receipt party.
for (const [document, label, expected] of [
  ['00012345600', 'CPF', '***.123.456-**'],
  ['000.123.456-00', 'CPF', '***.123.456-**'],
  [' 000.001.002-00 ', 'CPF', '***.001.002-**'],
  ['00000000000', 'CPF', '***.000.000-**'],
  ['***.123.456-**', 'CPF', '***.123.456-**'],
  ['00000000000000', 'CNPJ', '**.***.***/****-**'],
  ['00.000.000/0000-00', 'CNPJ', '**.***.***/****-**'],
  ['CPF 00012345600', 'Documento', '***.***.***-**'],
  ['000.123456-00', 'Documento', '***.***.***-**'],
  ['123456', 'Documento', '***.***.***-**'],
  ['***.***.***-**', 'Documento', '***.***.***-**'],
  ['', 'Documento', 'Não informado'],
  ['   ', 'Documento', 'Não informado'],
  [null, 'Documento', 'Não informado'],
  [undefined, 'Documento', 'Não informado'],
]) {
  const input = { ...receiptFixture, payer: { ...receiptFixture.payer, document }, beneficiary: { ...receiptFixture.beneficiary, document } };
  const before = JSON.stringify(input);
  for (const party of buildReceiptModel(input).parties) {
    assert.equal(party.documentLabel, label);
    assert.equal(party.document, expected);
  }
  assert.equal(JSON.stringify(input), before);
}
assert.ok(formatReceiptAmount('100000000000000001').includes('1.000.000.000.000.000,01'));
assert.ok(formatReceiptAmount('15013', 'JPY').includes('15.013'));
assert.throws(() => formatReceiptAmount(NaN));
assert.throws(() => formatReceiptAmount(100000000000000001));
assert.throws(() => formatReceiptAmount('-1'));
for (const status of ['PENDING', 'CREATED', 'PROCESSING', 'UNKNOWN']) assert.notEqual(receiptState({ ...receiptFixture, status }).kind, 'success');
for (const status of ['CANCELLED', 'FAILED', 'REJECTED']) assert.equal(receiptState({ ...receiptFixture, status }).kind, 'error');
assert.equal(receiptState({ ...receiptFixture, status: 'REFUNDED' }).kind, 'info');
assert.equal(receiptState({ ...receiptFixture, status: 'SIMULATED' }).kind, 'info');
const external = { ...receiptFixture, channel: 'SWIFT', provider: 'EXTERNAL_TEST' };
assert.equal(receiptState(external).kind, 'pending');
assert.equal(receiptState({ ...external, provider: 'PROVIDER_LIVE', destinationConfirmationId: 'CONF', destinationConfirmedAt: receiptFixture.createdAt }).kind, 'success');
assert.equal(receiptState({ ...external, provider: 'BRAVUS_INTERNAL', destinationConfirmationId: 'CONF', destinationConfirmedAt: receiptFixture.createdAt }).kind, 'pending');
const pdf = new Blob(['%PDF-1.4\nfixture\n%%EOF'], { type: 'application/pdf' });
const document = { pdf, filename: 'comprovante.pdf', title: 'Comprovante', text: 'Resumo' };
let downloaded;
await downloadReceiptDocument(document, { native: false, download: (value) => { downloaded = value; } });
assert.strictEqual(downloaded.pdf, pdf);
let shared;
await shareReceiptDocument(document, { native: false, navigator: { canShare: () => true, share: async (value) => { shared = value; } } });
assert.deepEqual(Buffer.from(await shared.files[0].arrayBuffer()), Buffer.from(await pdf.arrayBuffer()));
assert.equal(shared.url, undefined);
await shareReceiptDocument(document, { native: false, navigator: { canShare: () => false, share: () => { throw Error('must not share a link'); } }, download: (value) => { downloaded = value; } });
assert.strictEqual(downloaded.pdf, pdf);
for (const key of ['saveNative', 'shareNative']) {
  let native;
  const fn = key === 'saveNative' ? downloadReceiptDocument : shareReceiptDocument;
  await fn(document, { native: true, [key]: async (value) => { native = value; return { message: 'ok' }; } });
  assert.strictEqual(native.pdf, pdf);
}
await assert.rejects(shareReceiptDocument(document, { native: false, navigator: { canShare: () => true, share: async () => { throw new DOMException('cancelled', 'AbortError'); } } }), { name: 'AbortError' });
console.log('receipt: precise amount, masked identity, truthful status, immutable input, identical download/share PDF, native dispatch, fallback and cancellation: passed');
