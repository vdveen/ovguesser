import postgres from "postgres";

export type Sql = postgres.Sql;

/** Ordered schema changes. Never edit an entry once deployed; append a new one. */
const MIGRATIONS: string[] = [
  `create table ovg_runs (
     id uuid primary key,
     mode text not null,
     pool text not null,
     date_key date not null,
     seed bigint not null,
     total integer not null,
     verified boolean not null,
     data_version text not null,
     started_at timestamptz not null,
     finished_at timestamptz not null,
     received_at timestamptz not null default now()
   );
   create index ovg_runs_daily on ovg_runs (date_key) where mode = 'daily' and verified;
   create table ovg_rounds (
     run_id uuid not null references ovg_runs (id) on delete cascade,
     idx smallint not null,
     station_code text not null,
     outcome text not null,
     attempts smallint not null,
     score integer not null,
     first_distance_m integer,
     duration_ms integer,
     guesses jsonb not null,
     primary key (run_id, idx)
   );
   create index ovg_rounds_station on ovg_rounds (station_code);`,
];

export function connect(url: string): Sql {
  const local = /@(localhost|127\.0\.0\.1|[\w-]+\.railway\.internal)[:/]/.test(url) || url.includes("host=/");
  return postgres(url, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
    ssl: local ? false : "require",
    onnotice: () => {},
  });
}

/** Applies pending migrations inside one transaction, guarded by an advisory lock so replicas don't race. */
export async function migrate(sql: Sql): Promise<number> {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7710042)`;
    await tx`create table if not exists ovg_migrations (version integer primary key, applied_at timestamptz not null default now())`;
    const [{ current }] = await tx<
      { current: number }[]
    >`select coalesce(max(version), 0)::int as current from ovg_migrations`;
    for (let v = current + 1; v <= MIGRATIONS.length; v++) {
      await tx.unsafe(MIGRATIONS[v - 1]);
      await tx`insert into ovg_migrations (version) values (${v})`;
    }
    return MIGRATIONS.length - current;
  });
}
