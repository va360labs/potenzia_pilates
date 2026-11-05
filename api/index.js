import { handleApi } from '../lib/api.js';
import { postgresStore } from '../lib/store-postgres.js';

// Vercel no tiene un servidor encendido: cada petición a /api/* enciende esta función
// y se apaga al responder. El disco no dura entre peticiones, así que los datos viven
// fuera, en Supabase (Postgres). La URL de conexión va en la variable DATABASE_URL.
console.log('[api] DATABASE_URL presente:', !!process.env.DATABASE_URL, 'host:', (process.env.DATABASE_URL||'').split('@')[1]?.split('/')[0]);
const store = postgresStore(process.env.DATABASE_URL);

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  // vercel.json reescribe /api/<ruta> a /api?__route=<ruta>.
  const route = url.searchParams.get('__route');
  url.searchParams.delete('__route');
  const pathname = route ? `/api/${route}` : url.pathname;

  let status = 500;
  let data = { error: 'Error inesperado del servidor.' };
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    ({ status, data } = await handleApi(store, { method: req.method, pathname, query: url.searchParams, body }));
  } catch (error) {
    console.error(error);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
