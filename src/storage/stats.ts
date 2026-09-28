import { shiftDateKey } from "../game/dates";
import { roundScore, runTotal } from "../game/scoring";
import type { Run } from "../game/types";

export interface PlayerStats {
  finished: number;
  average: number;
  best: number;
  dailyStreak: number;
  playedDailyToday: Run | undefined;
  hardest: { code: string; name: string; plays: number; average: number }[];
}

/** Everything the history screen shows, derived from the stored runs. */
export function playerStats(runs: Run[], todayKey: string): PlayerStats {
  const finished = runs.filter((r) => r.status === "finished");
  const totals = finished.map((r) => r.total ?? runTotal(r));
  const dailyDays = new Set(finished.filter((r) => r.mode === "daily").map((r) => r.dateKey));
  let day = dailyDays.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let dailyStreak = 0;
  while (dailyDays.has(day)) {
    dailyStreak++;
    day = shiftDateKey(day, -1);
  }
  const perStation = new Map<string, { name: string; plays: number; sum: number }>();
  for (const run of finished) {
    for (const round of run.rounds) {
      const s = perStation.get(round.code) ?? { name: round.name, plays: 0, sum: 0 };
      s.plays++;
      s.sum += roundScore(round);
      perStation.set(round.code, s);
    }
  }
  const hardest = [...perStation.entries()]
    .map(([code, s]) => ({ code, name: s.name, plays: s.plays, average: Math.round(s.sum / s.plays) }))
    .filter((s) => s.average < 4000)
    .sort((a, b) => a.average - b.average || b.plays - a.plays)
    .slice(0, 5);
  return {
    finished: finished.length,
    average: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
    best: totals.length ? Math.max(...totals) : 0,
    dailyStreak,
    playedDailyToday: finished.find((r) => r.mode === "daily" && r.dateKey === todayKey),
    hardest,
  };
}
