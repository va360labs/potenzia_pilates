import pg from 'pg';

// La despensa en Postgres (Supabase): todo el estado de la demo en una fila JSON.
// Con Supabase usa la cadena del «Transaction pooler» (puerto 6543): es la que aguanta
// funciones que se encienden y apagan. Ese pooler no admite sentencias preparadas con nombre,
// y pg no las usa salvo que se lo pidas.
export function postgresStore(url) {
  if (!url) throw new Error('Falta la variable de entorno DATABASE_URL (cadena de conexión de Supabase).');
  // Una sola conexión por instancia: la función se enciende, atiende y se apaga.
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
    // El certificado del pooler de Supabase no está en el almacén de Node: se cifra, pero no se verifica.
    ssl: { rejectUnauthorized: false },
  });
  let ready;
  // Solo toca la tabla si hace falta. Cada arranque en frío pasa por aquí, y un ALTER TABLE pide
  // un bloqueo exclusivo: si dos funciones arrancan a la vez, la segunda espera a la primera.
  const init = () =>
    (ready ??= (async () => {
      const { rows } = await pool.query(
        `select c.relrowsecurity as rls from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'pilates_state'`);
      if (rows[0]?.rls) return;
      await pool.query(`create table if not exists pilates_state (id int primary key, data jsonb not null, updated_at timestamptz not null default now())`);
      // En Supabase, una tabla de public sin RLS se puede leer y escribir con la clave anónima.
      // Con RLS y sin políticas, solo entra esta conexión (dueña de la tabla).
      await pool.query(`alter table pilates_state enable row level security`);
    })());
  return {
    async load() {
      await init();
      const { rows } = await pool.query('select data from pilates_state where id = 1');
      return rows[0]?.data ?? null;
    },
    async save(state) {
      await init();
      await pool.query(
        `insert into pilates_state (id, data) values (1, $1::jsonb)
         on conflict (id) do update set data = excluded.data, updated_at = now()`,
        [JSON.stringify(state)]);
    },
  };
}
