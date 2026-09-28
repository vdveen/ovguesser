import { haversine } from "./distance";
import { hashString, pickDistinct } from "./rng";
import { isHit, ROUNDS_PER_RUN, roundScore, runTotal } from "./scoring";
import { DATA_VERSION, STATION_BY_CODE, STATIONS, stationPool } from "./stations";
import type { Mode, Pool, Round, Run, Station } from "./types";

export const dailySeed = (dateKey: string) => hashString(`daily:${dateKey}`);

/** The five stations of a run. The daily ride always uses every station, so it is the same for everyone. */
export function stationsForRun(
  mode: Mode,
  pool: Pool,
  seed: number,
  stations: readonly Station[] = STATIONS,
): Station[] {
  const source = mode === "daily" ? stations : pool === "all" ? stations : stationPool(pool);
  return pickDistinct(source, ROUNDS_PER_RUN, seed);
}

export function createRun(opts: {
  id: string;
  mode: Mode;
  pool: Pool;
  seed: number;
  dateKey: string;
  now: number;
}): Run {
  const pool: Pool = opts.mode === "daily" ? "all" : opts.pool;
  const seed = opts.mode === "daily" ? dailySeed(opts.dateKey) : opts.seed;
  const rounds: Round[] = stationsForRun(opts.mode, pool, seed).map((s, i) => ({
    code: s.code,
    name: s.name,
    startedAt: i === 0 ? opts.now : null,
    endedAt: null,
    guesses: [],
    outcome: null,
  }));
  return {
    id: opts.id,
    v: 1,
    dataVersion: DATA_VERSION,
    mode: opts.mode,
    pool,
    seed,
    dateKey: opts.dateKey,
    status: "active",
    current: 0,
    rounds,
    startedAt: opts.now,
    finishedAt: null,
    syncedAt: null,
  };
}

export const currentRound = (run: Run) => run.rounds[run.current];

function updateRound(run: Run, patch: (r: Round) => Round): Run {
  return { ...run, rounds: run.rounds.map((r, i) => (i === run.current ? patch(r) : r)) };
}

/** Adds a guess to the current round. Ends the round on a hit, or when the score runs out. */
export function applyGuess(run: Run, lat: number, lng: number, now: number): Run {
  const round = currentRound(run);
  if (run.status !== "active" || round.outcome) return run;
  const station = STATION_BY_CODE.get(round.code);
  if (!station) throw new Error(`Unknown station ${round.code}`);
  const distance = Math.round(haversine(lat, lng, station.lat, station.lng));
  const started = round.startedAt ?? now;
  const guesses = [
    ...round.guesses,
    [round5(lat), round5(lng), distance, Math.max(0, now - started)] as Round["guesses"][number],
  ];
  let outcome: Round["outcome"] = null;
  if (isHit(distance)) outcome = "found";
  else if (roundScore({ guesses, outcome: null }) === 0) outcome = "revealed";
  return updateRound(run, (r) => ({ ...r, startedAt: started, guesses, outcome, endedAt: outcome ? now : null }));
}

/** Gives up the current round for 0 points. */
export function revealRound(run: Run, now: number): Run {
  const round = currentRound(run);
  if (run.status !== "active" || round.outcome) return run;
  return updateRound(run, (r) => ({ ...r, outcome: "revealed", endedAt: now }));
}

/** Moves to the next round, or finishes the run after the last one. */
export function advance(run: Run, now: number): Run {
  if (run.status !== "active" || !currentRound(run).outcome) return run;
  if (run.current >= run.rounds.length - 1)
    return { ...run, status: "finished", finishedAt: now, total: runTotal(run) };
  const next = run.current + 1;
  return { ...run, current: next, rounds: run.rounds.map((r, i) => (i === next ? { ...r, startedAt: now } : r)) };
}

/** Makes sure the current round has a start time, e.g. after resuming. */
export function resumeRound(run: Run, now: number): Run {
  const round = currentRound(run);
  return round.startedAt ? run : updateRound(run, (r) => ({ ...r, startedAt: now }));
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
