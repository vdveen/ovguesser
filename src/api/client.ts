import type { Run } from "../game/types";

export interface DailyStats {
  dateKey: string;
  players: number;
  average: number;
  best: number;
  histogram: number[];
  percentile?: number;
}
export interface StationStat {
  plays: number;
  firstTry: number;
  averageScore: number;
}
export interface SubmitResult {
  stored: boolean;
  verified: boolean;
  total: number;
  daily?: DailyStats;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.json()) as T;
}

/** The game never waits on these. Every caller treats a failure as "no stats right now". */
export const api = {
  submitRun: (run: Run) =>
    request<SubmitResult>("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(run),
    }),
  dailyStats: (dateKey: string, score?: number) =>
    request<DailyStats>(`/api/stats/daily/${dateKey}${score === undefined ? "" : `?score=${score}`}`),
  stationStats: () => request<Record<string, StationStat>>("/api/stats/stations"),
  overview: () => request<{ runs: number; dailyPlayersToday: number }>("/api/stats/overview"),
};
