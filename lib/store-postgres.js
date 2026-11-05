import postgres from 'postgres';

// La despensa en Postgres (Supabase): todo el estado de la demo en una fila JSON.
// Con Supabase usa la cadena del «Transaction pooler» (puerto 6543): es la que aguanta
// funciones que se encienden y apagan. Ese pooler no admite sentencias preparadas.
export function postgresStore(url) {
  if (!url) throw new Error('Falta la variable de entorno DATABASE_URL (cadena de conexión de Supabase).');
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  let ready;
  // Solo toca la tabla si hace falta. Cada arranque en frío pasa por aquí, y un ALTER TABLE pide
  // un bloqueo exclusivo: si dos funciones arrancan a la vez y los dos lo piden, la segunda espera
  // a la primera y la API se queda colgada.
  const init = () =>
    (ready ??= (async () => {
      const [t] = await sql`select c.relrowsecurity as rls from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'pilates_state'`;
      if (t?.rls) return;
      await sql.begin(async (tx) => {
        await tx`create table if not exists pilates_state (id int primary key, data jsonb not null, updated_at timestamptz not null default now())`;
        // En Supabase, una tabla de public sin RLS se puede leer y escribir con la clave anónima.
        // Con RLS y sin políticas, solo entra esta conexión (dueña de la tabla).
        await tx`alter table pilates_state enable row level security`;
      });
    })());
  return {
    async load() {
      await init();
      const rows = await sql`select data from pilates_state where id = 1`;
      return rows[0]?.data ?? null;
    },
    async save(state) {
      await init();
      await sql`insert into pilates_state (id, data) values (1, ${sql.json(state)})
                on conflict (id) do update set data = excluded.data, updated_at = now()`;
    },
  };
}
