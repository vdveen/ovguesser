import type { Round, Run } from "./types";

export const ROUNDS_PER_RUN = 5;
export const MAX_ROUND_SCORE = 5000;
export const MAX_RUN_SCORE = ROUNDS_PER_RUN * MAX_ROUND_SCORE;
/** A guess this close to the station finds it. */
export const HIT_RADIUS_M = 500;
const MISS_BASE = 250;
const MISS_PER_KM = 7.5;
const MISS_CAP = 1000;

/** Points a missed guess costs: 250 plus 7.5 per km, at most 1000. */
export function missPenalty(distanceM: number): number {
  return Math.min(MISS_CAP, MISS_BASE + Math.round((MISS_PER_KM * distanceM) / 1000));
}

export const isHit = (distanceM: number) => distanceM <= HIT_RADIUS_M;

/** Current score of a round, from its guesses. Never goes up within a round. */
export function roundScore(round: Pick<Round, "guesses" | "outcome">): number {
  if (round.outcome === "revealed") return 0;
  let score = MAX_ROUND_SCORE;
  for (const [, , distanceM] of round.guesses) if (!isHit(distanceM)) score -= missPenalty(distanceM);
  return Math.max(0, score);
}

export function runTotal(run: Pick<Run, "rounds">): number {
  return run.rounds.reduce((sum, r) => sum + (r.outcome ? roundScore(r) : 0), 0);
}

/** Share-grid square for a finished round. */
export function roundSquare(round: Pick<Round, "guesses" | "outcome">): string {
  const s = roundScore(round);
  if (s >= 4000) return "🟩";
  if (s >= 2500) return "🟨";
  if (s > 0) return "🟧";
  return "🟥";
}
