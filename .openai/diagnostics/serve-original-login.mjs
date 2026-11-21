import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([
  ['/', ['original-login.html', 'text/html; charset=utf-8']],
  ['/ui.mjs', ['original-login-ui.mjs', 'application/javascript; charset=utf-8']],
  ['/probe.mjs', ['original-login-probe.mjs', 'application/javascript; charset=utf-8']],
]);
const server = http.createServer(async (req, res) => {
  const file = files.get(new URL(req.url, 'http://127.0.0.1').pathname);
  if (req.method !== 'GET' || !file) { res.writeHead(405); res.end(); return; }
  try {
    const bytes = await readFile(new URL(file[0], import.meta.url));
    res.writeHead(200, {
      'Content-Type': file[1], 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; connect-src https://bravusbank.com; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    });
    res.end(bytes);
  } catch { res.writeHead(500); res.end(); }
});
server.listen(53121, '127.0.0.1', () => console.log('Local support page: http://127.0.0.1:53121/'));
