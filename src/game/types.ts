export type Mode = "classic" | "daily";
export type Pool = "all" | "intercity";
export type Outcome = "found" | "revealed";

/** [lat, lng, distance in metres, ms since the round started] */
export type Guess = [number, number, number, number];

export interface Round {
  code: string;
  /** Station name when the run was played, so history survives data updates. */
  name: string;
  startedAt: number | null;
  endedAt: number | null;
  guesses: Guess[];
  outcome: Outcome | null;
}

export interface Run {
  id: string;
  v: 1;
  dataVersion: string;
  mode: Mode;
  pool: Pool;
  seed: number;
  /** Europe/Amsterdam calendar date, YYYY-MM-DD */
  dateKey: string;
  status: "active" | "finished" | "abandoned";
  current: number;
  rounds: Round[];
  startedAt: number;
  finishedAt: number | null;
  /** Cached on finish. Always recomputable with runTotal(). */
  total?: number;
  /** Set once the server has stored the run. */
  syncedAt?: number | null;
  /** Last local change; decides which copy wins when recovering after a crash. */
  updatedAt?: number;
}

export interface Station {
  code: string;
  name: string;
  tier: number;
  lat: number;
  lng: number;
}
