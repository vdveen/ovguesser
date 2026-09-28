import { MAX_RUN_SCORE } from "../src/game/scoring";
import type { Sql } from "./db";
import type { Verification } from "./verify";

type Verified = Extract<Verification, { ok: true }>;

/** Stores a verified run once. A repeated submit of the same run id is a no-op. */
export async function storeRun(sql: Sql, v: Verified): Promise<boolean> {
  return sql.begin(async (tx) => {
    const r = v.run;
    const inserted = await tx`
      insert into ovg_runs (id, mode, pool, date_key, seed, total, verified, data_version, started_at, finished_at)
      values (${r.id}, ${r.mode}, ${r.pool}, ${r.dateKey}, ${r.seed}, ${v.total}, ${v.verified}, ${r.dataVersion},
              ${new Date(r.startedAt)}, ${new Date(r.finishedAt ?? r.startedAt)})
      on conflict (id) do nothing
      returning id`;
    if (inserted.length === 0) return false;
    const rows = v.rounds.map((round, idx) => ({
      run_id: r.id,
      idx,
      station_code: round.code,
      outcome: round.outcome,
      attempts: round.guesses.length,
      score: round.score,
      first_distance_m: round.guesses[0]?.[2] ?? null,
      duration_ms: round.durationMs,
      guesses: JSON.stringify(round.guesses),
    }));
    await tx`insert into ovg_rounds ${tx(rows)}`;
    return true;
  });
}

export const HISTOGRAM_BUCKETS = 10;
const BUCKET = MAX_RUN_SCORE / HISTOGRAM_BUCKETS;

export interface DailyStats {
  dateKey: string;
  players: number;
  average: number;
  best: number;
  /** Players per 2,500-point bucket, lowest first. */
  histogram: number[];
  /** Share of other players who scored lower, when a score was given. */
  percentile?: number;
}

export async function dailyStats(sql: Sql, dateKey: string, score?: number): Promise<DailyStats> {
  const [agg] = await sql<{ players: number; average: number | null; best: number | null }[]>`
    select count(*)::int as players, round(avg(total))::int as average, max(total)::int as best
    from ovg_runs where mode = 'daily' and verified and date_key = ${dateKey}`;
  const buckets = await sql<{ b: number; n: number }[]>`
    select least(${HISTOGRAM_BUCKETS - 1}, floor(total / ${BUCKET}))::int as b, count(*)::int as n
    from ovg_runs where mode = 'daily' and verified and date_key = ${dateKey} group by 1`;
  const histogram = Array.from({ length: HISTOGRAM_BUCKETS }, () => 0);
  for (const { b, n } of buckets) histogram[b] = n;
  const stats: DailyStats = {
    dateKey,
    players: agg.players,
    average: agg.average ?? 0,
    best: agg.best ?? 0,
    histogram,
  };
  if (score !== undefined && agg.players > 0) {
    const [{ lower, others }] = await sql<{ lower: number; others: number }[]>`
      select count(*) filter (where total < ${score})::int as lower, count(*)::int as others
      from ovg_runs where mode = 'daily' and verified and date_key = ${dateKey}`;
    stats.percentile = others > 1 ? Math.round((100 * lower) / (others - 1)) : 100;
  }
  return stats;
}

export interface StationStat {
  plays: number;
  /** Percentage of plays found with the first guess. */
  firstTry: number;
  averageScore: number;
}

export async function stationStats(sql: Sql, minPlays = 3): Promise<Record<string, StationStat>> {
  const rows = await sql<{ code: string; plays: number; first: number; avg: number }[]>`
    select r.station_code as code, count(*)::int as plays,
           count(*) filter (where r.outcome = 'found' and r.attempts = 1)::int as first,
           round(avg(r.score))::int as avg
    from ovg_rounds r join ovg_runs u on u.id = r.run_id
    where u.verified
    group by r.station_code having count(*) >= ${minPlays}`;
  return Object.fromEntries(
    rows.map((r) => [r.code, { plays: r.plays, firstTry: Math.round((100 * r.first) / r.plays), averageScore: r.avg }]),
  );
}

export async function overview(sql: Sql, todayKey: string) {
  const [row] = await sql<{ runs: number; today: number }[]>`
    select count(*)::int as runs,
           count(*) filter (where mode = 'daily' and verified and date_key = ${todayKey})::int as today
    from ovg_runs`;
  return { runs: row.runs, dailyPlayersToday: row.today };
}
