import * as rules from './rules.js';
import { createSeed } from './seed.js';

// Las rutas de la API sin saber dónde se guardan los datos. Cada plataforma le pasa
// su «despensa» (store): un fichero en disco, Postgres (Supabase) o D1 (Cloudflare).
// Un store solo tiene dos métodos: load() → estado o null, y save(estado).

const routes = {
  'GET /api/users': ({ state }) => ({ owner: state.owner, members: state.members.map(({ id, name }) => ({ id, name })) }),
  'GET /api/clock': ({ state, now }) => clockInfo(state, now),
  'GET /api/week': ({ state, now, query }) => rules.memberView(state, query.get('member'), now),
  'GET /api/owner': ({ state, now }) => rules.ownerView(state, now),
  'POST /api/book': ({ mutate, now, body }) => mutate((s) => rules.book(s, body.memberId, body.classId, now)),
  'POST /api/cancel': ({ mutate, now, body }) => mutate((s) => rules.cancel(s, body.memberId, body.classId, now)),
  'POST /api/leave-waitlist': ({ mutate, now, body }) => mutate((s) => rules.leaveWaitlist(s, body.memberId, body.classId, now)),
  'POST /api/notices/seen': ({ mutate, body }) => mutate((s) => rules.markNoticesSeen(s, body.memberId)),
  'POST /api/clock': ({ mutate, body }) => {
    if (body.now && Number.isNaN(new Date(body.now).getTime())) throw new rules.RuleError('Hora no válida.');
    const next = mutate((s) => { s.demoNow = body.now || null; return s; });
    return clockInfo(next, currentTime(next));
  },
  'POST /api/reset': ({ replace }) => {
    replace(createSeed(new Date()));
    return { ok: true };
  },
};

const currentTime = (state) => (state.demoNow ? new Date(state.demoNow) : new Date());
const clockInfo = (state, now) => ({ now: rules.toLocalIso(now), demo: Boolean(state.demoNow) });

export const isApiRoute = (method, pathname) => Boolean(routes[`${method} ${pathname}`]);

/** Devuelve { status, data }. Lanza solo si falla la despensa. */
export async function handleApi(store, { method, pathname, query, body }) {
  const route = routes[`${method} ${pathname}`];
  if (!route) return { status: 404, data: { error: 'No encontrado' } };

  let state = await store.load();
  if (!state) {
    state = createSeed(new Date());
    await store.save(state);
  }

  let changed = null;
  // Cada cambio se aplica sobre una copia: si una regla falla, el estado queda como estaba.
  const mutate = (change) => {
    const draft = structuredClone(state);
    const result = change(draft);
    changed = draft;
    return result;
  };
  const replace = (next) => { changed = next; };

  try {
    const data = route({ state, now: currentTime(state), query, body: body ?? {}, mutate, replace });
    if (changed) await store.save(changed);
    return { status: 200, data };
  } catch (error) {
    if (error instanceof rules.RuleError) return { status: 400, data: { error: error.message } };
    console.error(error);
    return { status: 500, data: { error: 'Error inesperado del servidor.' } };
  }
}
