import postgres from 'postgres';

// La despensa en Postgres (Supabase): todo el estado de la demo en una fila JSON.
// Con Supabase usa la cadena del «Transaction pooler» (puerto 6543): es la que aguanta
// funciones que se encienden y apagan. Ese pooler no admite sentencias preparadas.
export function postgresStore(url) {
  if (!url) throw new Error('Falta la variable de entorno DATABASE_URL (cadena de conexión de Supabase).');
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20 });
  let ready;
  const init = () =>
    (ready ??= sql.begin(async (tx) => {
      await tx`create table if not exists pilates_state (id int primary key, data jsonb not null, updated_at timestamptz not null default now())`;
      // En Supabase, una tabla de public sin RLS se puede leer y escribir con la clave anónima.
      // Con RLS y sin políticas, solo entra esta conexión (dueña de la tabla).
      await tx`alter table pilates_state enable row level security`;
    }));
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
