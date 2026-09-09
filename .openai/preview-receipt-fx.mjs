// Isolated component preview: never authenticates or accesses customer records.
import { createServer as createHttpServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(repository, 'bravus-bank-frontend');
process.chdir(root);
const require = createRequire(join(root, 'package.json'));
const viteModule = await import(pathToFileURL(require.resolve('vite')).href);
const createServer = viteModule.createServer || viteModule.default.createServer;
const vite = await createServer({ root, server: { middlewareMode: true, fs: { allow: [repository] } }, appType: 'mpa' });
const out = join(repository, 'tmp/pdfs/browser-receipt.pdf');
const server = createHttpServer(async (request, response) => {
  try {
    if (request.url === '/') { response.writeHead(302, { Location: '/tests/receipt-preview.html' }); response.end(); return; }
    if (request.url === '/test-pdf' && request.method === 'POST') {
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 2000000) throw Error('too large'); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      if (bytes.subarray(0, 5).toString() !== '%PDF-') throw Error('not PDF');
      await mkdir(dirname(out), { recursive: true }); await writeFile(out, bytes); response.end('ok'); return;
    }
    if (request.url === '/test-pdf' && request.method === 'GET') { response.setHeader('Content-Type', 'application/pdf'); response.end(await readFile(out)); return; }
    vite.middlewares(request, response, () => { response.statusCode = 404; response.end('Not found'); });
  } catch (error) { response.statusCode = 500; response.end(error.message); }
});
server.listen(5186, '127.0.0.1', () => console.log('Isolated receipt/exchange preview: http://127.0.0.1:5186/'));
