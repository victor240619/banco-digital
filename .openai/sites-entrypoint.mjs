import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const rootDir = ".";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolveStaticPath(url) {
  const pathname = new URL(url).pathname;
  const decoded = decodeURIComponent(pathname);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const relative = clean === "/" ? "index.html" : clean.replace(/^[/\\]+/, "");
  return join(rootDir, relative);
}

async function serveFile(path, fallbackToIndex = true) {
  try {
    const body = await readFile(path);
    const type = contentTypes[extname(path).toLowerCase()] || "application/octet-stream";
    return new Response(body, { headers: { "content-type": type } });
  } catch {
    if (!fallbackToIndex) {
      return new Response("Not found", { status: 404 });
    }
    return serveFile(join(rootDir, "index.html"), false);
  }
}

export default {
  fetch(request) {
    return serveFile(resolveStaticPath(request.url));
  },
};
