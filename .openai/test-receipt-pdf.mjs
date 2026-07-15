import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bravus-bank-frontend');
const outputDirectory = path.resolve(root, '../tmp/pdfs');
const outputPath = path.join(outputDirectory, 'comprovante-bravus-validacao.pdf');
const require = createRequire(path.join(root, 'package.json'));
const viteModule = await import(pathToFileURL(require.resolve('vite')).href);
const createServer = viteModule.createServer || viteModule.default?.createServer;
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });

try {
  const { buildReceiptDocument } = await server.ssrLoadModule('/src/pages/UserDashboard.jsx');
  const document = buildReceiptDocument({
    receiptId: 'BRAVUS-VALIDACAO-001',
    receiptKind: 'COMPROVANTE_LIQUIDACAO_CONFIRMADA',
    transactionId: 'TX-VALIDACAO-001',
    amountCentavos: 1000,
    channel: 'PIX',
    status: 'COMPLETED',
    settlementStatus: 'SETTLED',
    createdAt: '2026-07-15T12:00:00-03:00',
    payer: {
      name: 'Joao Victor Mendonca Guimaraes',
      document: '***.***.***-**',
      bankName: 'Bravus Premium Bank',
      bankCode: '999',
      agency: '0001',
      accountNumber: '000000001',
      accountDigit: '1',
    },
    beneficiary: {
      name: 'Jonathan Pereira Torres Roriz',
      document: '***.***.***-**',
      bankName: 'Bravus Premium Bank',
      bankCode: '999',
      agency: '0001',
      accountNumber: '000000002',
      accountDigit: '2',
    },
    provider: 'BRAVUS_INTERNAL',
    destinationNetwork: 'PIX_BR',
    destinationConfirmationId: 'CONF-VALIDACAO-001',
    description: 'Transferencia Bravus',
  });

  const bytes = Buffer.from(await document.pdf.arrayBuffer());
  assert.equal(document.pdf.type, 'application/pdf');
  assert.equal(path.extname(document.filename), '.pdf');
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal(bytes.subarray(-5).toString('ascii'), '%%EOF');
  assert.ok(bytes.length > 1500, 'receipt PDF must contain a complete printable document');

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, bytes);
  console.log(`receipt PDF: ok (${bytes.length} bytes) -> ${outputPath}`);
} finally {
  await server.close();
}
