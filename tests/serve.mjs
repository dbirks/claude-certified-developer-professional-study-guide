// Zero-dependency static file server for Playwright e2e runs.
//   node tests/serve.mjs <dir> <port> <base>
// Serves <dir> under the URL prefix <base> (e.g. /ccdvp-test/), the way GitHub Pages
// serves a project site. Resolves /x/ -> x/index.html, 404s anything outside the base.
import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';

const [, , dirArg, portArg, baseArg] = process.argv;
if (!dirArg || !portArg || !baseArg) {
  console.error('usage: node tests/serve.mjs <dir> <port> <base>');
  process.exit(2);
}

const ROOT = path.resolve(dirArg);
const PORT = Number(portArg);
const BASE = baseArg.endsWith('/') ? baseArg : `${baseArg}/`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Pagefind index/chunk files have extensions like `.pf_fragment` or bare `pf_*` names. */
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext && ext.startsWith('.pf_')) return 'application/octet-stream';
  if (TYPES[ext]) return TYPES[ext];
  if (path.basename(file, ext).startsWith('pf_')) return 'application/octet-stream';
  return 'application/octet-stream';
}

async function statOrNull(p) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

/** Map a request pathname to a file inside ROOT, or null when outside base / escaping root. */
async function resolveFile(pathname) {
  if (!pathname.startsWith(BASE)) return null;
  let rel = decodeURIComponent(pathname.slice(BASE.length));
  // Normalise, then refuse anything that climbed out of the served directory.
  rel = path.posix.normalize(`/${rel}`).slice(1);
  const full = path.resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;

  let st = await statOrNull(full);
  if (st?.isDirectory()) {
    const idx = path.join(full, 'index.html');
    st = await statOrNull(idx);
    return st?.isFile() ? idx : null;
  }
  if (st?.isFile()) return full;
  // Extension-less paths: try `<path>/index.html` (and `/x` for `/x/`).
  if (!path.extname(full)) {
    const idx = path.join(full, 'index.html');
    st = await statOrNull(idx);
    if (st?.isFile()) return idx;
  }
  return null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  void handle(url.pathname, req.method ?? 'GET', res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end('server error');
    else res.destroy();
  });
});

async function handle(pathname, method, res) {
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain' }).end('method not allowed');
    return;
  }
  const file = await resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 not found');
    return;
  }
  const st = await fs.stat(file);
  res.writeHead(200, {
    'content-type': contentType(file),
    'content-length': String(st.size),
    'cache-control': 'no-store',
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

// Redirect bare-origin traffic to the base so the webServer health check on `/`-adjacent
// URLs behaves like GitHub Pages (everything lives under /<repo>/).
server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}${BASE}`);
});
