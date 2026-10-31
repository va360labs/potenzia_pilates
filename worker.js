import { handleApi } from './lib/api.js';
import { d1Store } from './lib/store-d1.js';

// Cloudflare sirve public/ como ficheros estáticos (gratis e ilimitados) y solo despierta
// este Worker para /api/* (run_worker_first en wrangler.jsonc). No hay disco: los datos
// viven en D1, la base de datos de Cloudflare, enlazada como env.DB.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    let status = 500;
    let data = { error: 'Error inesperado del servidor.' };
    try {
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      ({ status, data } = await handleApi(d1Store(env.DB), { method: request.method, pathname: url.pathname, query: url.searchParams, body }));
    } catch (error) {
      console.error(error);
    }
    return Response.json(data, { status });
  },
};
