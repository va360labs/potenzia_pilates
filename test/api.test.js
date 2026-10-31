import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../lib/api.js';

// Una despensa en memoria: la API no sabe ni le importa dónde se guardan los datos.
const memoryStore = () => {
  let saved = null;
  return { load: async () => (saved ? structuredClone(saved) : null), save: async (s) => { saved = structuredClone(s); }, peek: () => saved };
};
const get = (store, pathname, params = {}) => handleApi(store, { method: 'GET', pathname, query: new URLSearchParams(params), body: {} });
const post = (store, pathname, body) => handleApi(store, { method: 'POST', pathname, query: new URLSearchParams(), body });

test('la primera petición siembra los datos y los guarda', async () => {
  const store = memoryStore();
  const { status, data } = await get(store, '/api/users');
  assert.equal(status, 200);
  assert.equal(data.members.length, 12);
  assert.ok(store.peek());
});

test('una reserva se guarda en la despensa y sobrevive a la siguiente petición', async () => {
  const store = memoryStore();
  await post(store, '/api/clock', { now: '2026-10-22T12:00' });
  const week = (await get(store, '/api/week', { member: 'm1' })).data;
  const libre = week.classes.find((c) => c.confirmed < c.capacity && !c.mine && !c.started);
  const reserva = await post(store, '/api/book', { memberId: 'm1', classId: libre.id });
  assert.equal(reserva.status, 200, JSON.stringify(reserva.data));
  const despues = (await get(store, '/api/week', { member: 'm1' })).data;
  assert.equal(despues.classes.find((c) => c.id === libre.id).mine, 'confirmed');
});

test('una regla que falla devuelve 400 y no toca los datos', async () => {
  const store = memoryStore();
  await get(store, '/api/users');
  const antes = JSON.stringify(store.peek());
  const { status, data } = await post(store, '/api/book', { memberId: 'm1', classId: 'no-existe' });
  assert.equal(status, 400);
  assert.ok(data.error);
  assert.equal(JSON.stringify(store.peek()), antes);
});

test('ruta desconocida, 404', async () => {
  assert.equal((await get(memoryStore(), '/api/nada')).status, 404);
});
