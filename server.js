import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, isApiRoute } from './lib/api.js';
import { fileStore } from './lib/store-file.js';

// Servidor de siempre (Coolify, un VPS o tu ordenador): sirve public/ y la API,
// y guarda los datos en data/db.json.
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const store = fileStore(path.join(ROOT, 'data', 'db.json'));
const PORT = Number(process.env.PORT) || 3210;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function serveStatic(pathname, res) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('No encontrado');
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!isApiRoute(req.method, url.pathname)) return serveStatic(url.pathname, res);
    try {
      const body = req.method === 'POST' ? await readJson(req) : {};
      const { status, data } = await handleApi(store, { method: req.method, pathname: url.pathname, query: url.searchParams, body });
      sendJson(res, status, data);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: 'Error inesperado del servidor.' });
    }
  })
  .listen(PORT, () => console.log(`Núcleo Pilates en http://localhost:${PORT}`));
