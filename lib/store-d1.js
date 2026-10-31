// La despensa en D1 (SQLite de Cloudflare): todo el estado de la demo en una fila JSON.
// La tabla la crea migrations/0001_estado.sql (wrangler d1 migrations apply).
export function d1Store(db) {
  return {
    async load() {
      const row = await db.prepare('SELECT data FROM pilates_state WHERE id = 1').first();
      return row ? JSON.parse(row.data) : null;
    },
    async save(state) {
      await db
        .prepare('INSERT INTO pilates_state (id, data) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
        .bind(JSON.stringify(state))
        .run();
    },
  };
}
