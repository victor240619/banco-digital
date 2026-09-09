import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer as createHttpServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { receiptFixture } from './receipt-fixture.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bravus-bank-frontend');
const outputDirectory = path.resolve(root, '../tmp/pdfs');
process.chdir(root);
const require = createRequire(path.join(root, 'package.json'));
const vite = await import(pathToFileURL(require.resolve('vite')).href);
const sharp = (await import(pathToFileURL(require.resolve('sharp', { paths: [root, process.env.VANTYX_TEST_DEPENDENCIES || root] })).href)).default;
// An unattached HTTP server keeps this SSR-only test from binding Vite's shared HMR port.
const server = await (vite.createServer || vite.default.createServer)({ root, server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom' });
try {
  const { buildReceiptDocument, iconSvg } = await server.ssrLoadModule('/src/lib/receiptDocument.jsx');
  const logo = new Uint8Array(await readFile(path.join(root, 'public/brand/vantyx-bank-horizontal.png')));
  const icon = new Uint8Array(await sharp(Buffer.from(iconSvg('success'))).png().toBuffer());
  const assets = { logo, icon };
  const cpfFixture = { ...receiptFixture,
    payer: { ...receiptFixture.payer, document: '00012345600' },
    beneficiary: { ...receiptFixture.beneficiary, document: '000.987.654-00' },
  };
  const document = await buildReceiptDocument(cpfFixture, assets);
  const bytes = Buffer.from(await document.pdf.arrayBuffer());
  assert.equal(document.pdf.type, 'application/pdf');
  assert.equal(path.extname(document.filename), '.pdf');
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(bytes.subarray(-10).toString('ascii').includes('%%EOF'));
  assert.ok(bytes.length > 5000);
  assert.ok(document.html.includes('DESTINATÁRIO'));
  assert.ok(document.html.includes('REMETENTE'));
  assert.ok(!document.html.includes('00000000000'));
  for (const masked of ['***.123.456-**', '***.987.654-**']) assert.ok(document.html.includes(masked));
  for (const full of ['00012345600', '000.123.456-00', '00098765400', '000.987.654-00']) assert.ok(!document.html.includes(full));
  const again = await buildReceiptDocument(cpfFixture, assets);
  assert.deepEqual(bytes, Buffer.from(await again.pdf.arrayBuffer()), 'download/share generation must be deterministic');
  const malicious = await buildReceiptDocument({ ...receiptFixture, description: '<img src=x onerror=alert(1)>' }, assets);
  assert.ok(malicious.html.includes('&lt;img'));
  assert.ok(!malicious.html.includes('<img src=x'));
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'comprovante-vantyx-validacao.pdf'), bytes);
  await writeFile(path.join(outputDirectory, 'comprovante-vantyx-validacao.html'), document.html);
  const long = await buildReceiptDocument({ ...receiptFixture, payer: { ...receiptFixture.payer, name: 'João Exemplo da Silva '.repeat(10) }, description: 'Descrição longa de teste para validar a paginação e a preservação dos dados. '.repeat(100) }, assets);
  await writeFile(path.join(outputDirectory, 'comprovante-vantyx-longo.pdf'), Buffer.from(await long.pdf.arrayBuffer()));
  const pending = await buildReceiptDocument({ ...receiptFixture, status: 'PENDING', settlementStatus: 'AGUARDANDO_CONFIRMACAO_MANUAL', channel: 'SWIFT' }, { logo, icon: new Uint8Array(await sharp(Buffer.from(iconSvg('pending'))).png().toBuffer()) });
  await writeFile(path.join(outputDirectory, 'comprovante-vantyx-pendente.pdf'), Buffer.from(await pending.pdf.arrayBuffer()));
  console.log('receipt PDF: valid, deterministic, escaped HTML, masked identity, branded assets; normal/long/pending documents generated');
} finally { await server.close(); }
