import { dateKeyFor, shiftDateKey } from "../src/game/dates";
import { haversine } from "../src/game/distance";
import { stationsForRun } from "../src/game/run";
import { runSchema } from "../src/game/schema";
import { isHit, roundScore } from "../src/game/scoring";
import { STATION_BY_CODE } from "../src/game/stations";
import type { Guess, Run } from "../src/game/types";

export interface VerifiedRound {
  code: string;
  outcome: "found" | "revealed";
  guesses: Guess[];
  score: number;
  durationMs: number | null;
}

export type Verification =
  | { ok: false; reason: string }
  | { ok: true; run: Run; rounds: VerifiedRound[]; total: number; verified: boolean };

/**
 * Checks a finished run sent by a browser and recomputes everything that matters.
 * Distances and scores come from the server's own station data, never from the client.
 * `verified` is false when the stations don't match the seed (edited run, or older station data);
 * such runs are stored but left out of the shared statistics.
 */
export function verifyRun(input: unknown, now = Date.now()): Verification {
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const run = parsed.data as Run;
  if (run.status !== "finished" || !run.finishedAt) return { ok: false, reason: "not-finished" };

  const rounds: VerifiedRound[] = [];
  for (const round of run.rounds) {
    const station = STATION_BY_CODE.get(round.code);
    if (!station) return { ok: false, reason: "unknown-station" };
    if (!round.outcome) return { ok: false, reason: "unfinished-round" };
    const guesses: Guess[] = round.guesses.map(([lat, lng, , ms]) => [
      lat,
      lng,
      Math.round(haversine(lat, lng, station.lat, station.lng)),
      ms,
    ]);
    const hits = guesses.map((g) => isHit(g[2]));
    // Only the last guess may be a hit, and a found round must end with one.
    if (hits.slice(0, -1).some(Boolean)) return { ok: false, reason: "guess-after-hit" };
    if (round.outcome === "found" && !hits.at(-1)) return { ok: false, reason: "found-without-hit" };
    if (round.outcome === "revealed" && hits.at(-1)) return { ok: false, reason: "revealed-with-hit" };
    const score = roundScore({ guesses, outcome: round.outcome });
    const durationMs = round.startedAt && round.endedAt ? Math.max(0, round.endedAt - round.startedAt) : null;
    rounds.push({ code: round.code, outcome: round.outcome, guesses, score, durationMs });
  }

  const expected = stationsForRun(run.mode, run.pool, run.seed).map((s) => s.code);
  const today = dateKeyFor(now);
  const plausibleDate = [shiftDateKey(today, -1), today, shiftDateKey(today, 1)].includes(run.dateKey);
  const verified =
    expected.every((code, i) => code === run.rounds[i].code) && (run.mode === "classic" || plausibleDate);
  const total = rounds.reduce((sum, r) => sum + r.score, 0);
  return { ok: true, run, rounds, total, verified };
}
