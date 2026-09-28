import { describe, expect, it } from "vitest";
import { dateKeyFor, shiftDateKey } from "./dates";
import { formatDistance, haversine } from "./distance";
import { hashString, pickDistinct } from "./rng";
import { advance, applyGuess, createRun, currentRound, dailySeed, revealRound, stationsForRun } from "./run";
import { runSchema } from "./schema";
import { HIT_RADIUS_M, MAX_ROUND_SCORE, missPenalty, roundScore, runTotal } from "./scoring";
import { STATION_BY_CODE, STATIONS, stationPool } from "./stations";

const T0 = 1_750_000_000_000;
const newRun = (mode: "classic" | "daily" = "classic", seed = 42) =>
  createRun({ id: "00000000-0000-4000-8000-000000000001", mode, pool: "all", seed, dateKey: "2026-09-28", now: T0 });
const stationOf = (run: ReturnType<typeof newRun>) => STATION_BY_CODE.get(currentRound(run).code)!;

describe("distance", () => {
  it("matches known distances", () => {
    // Amsterdam Centraal to Utrecht Centraal is about 35 km as the crow flies.
    const asd = STATION_BY_CODE.get("ASD")!;
    const ut = STATION_BY_CODE.get("UT")!;
    expect(haversine(asd.lat, asd.lng, ut.lat, ut.lng)).toBeGreaterThan(33_000);
    expect(haversine(asd.lat, asd.lng, ut.lat, ut.lng)).toBeLessThan(37_000);
    expect(haversine(52, 5, 52, 5)).toBe(0);
  });
  it("formats per locale", () => {
    expect(formatDistance(320, "nl-NL")).toBe("320 m");
    expect(formatDistance(9500, "nl-NL")).toBe("9,5 km");
    expect(formatDistance(9500, "en-GB")).toBe("9.5 km");
    expect(formatDistance(123_456, "en-GB")).toBe("123 km");
  });
});

describe("scoring", () => {
  it("charges 250 plus 7.5 per km, capped at 1000", () => {
    expect(missPenalty(2000)).toBe(265);
    expect(missPenalty(10_000)).toBe(325);
    expect(missPenalty(100_000)).toBe(1000);
    expect(missPenalty(300_000)).toBe(1000);
  });
  it("gives 5000 for a first-try hit and 0 for giving up", () => {
    expect(roundScore({ guesses: [[0, 0, 100, 0]], outcome: "found" })).toBe(MAX_ROUND_SCORE);
    expect(roundScore({ guesses: [[0, 0, 5000, 0]], outcome: "revealed" })).toBe(0);
  });
  it("never goes up within a round", () => {
    const dists = [69_000, 9_500, 2_000, 300];
    let prev = MAX_ROUND_SCORE;
    const guesses: [number, number, number, number][] = [];
    for (const d of dists) {
      guesses.push([0, 0, d, 0]);
      const s = roundScore({ guesses, outcome: null });
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
    expect(prev).toBe(5000 - 768 - 321 - 265);
  });
  it("does not go below zero", () => {
    const guesses = Array.from({ length: 8 }, () => [0, 0, 500_000, 0] as [number, number, number, number]);
    expect(roundScore({ guesses, outcome: null })).toBe(0);
  });
});

describe("station data", () => {
  it("has the 395 NS stations with unique codes", () => {
    expect(STATIONS.length).toBe(395);
    expect(new Set(STATIONS.map((s) => s.code)).size).toBe(395);
    expect(stationPool("intercity").length).toBe(70);
    expect(STATION_BY_CODE.get("BP")?.name).toBe("Buitenpost");
  });
});

describe("station picks", () => {
  it("never repeats a station within a run", () => {
    for (let seed = 0; seed < 500; seed++) {
      const codes = stationsForRun("classic", "all", seed).map((s) => s.code);
      expect(new Set(codes).size).toBe(5);
    }
  });
  it("respects the intercity pool", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(stationsForRun("classic", "intercity", seed).every((s) => s.tier <= 2)).toBe(true);
    }
  });
  it("gives everyone the same daily ride, and a different one tomorrow", () => {
    const a = createRun({ id: "a", mode: "daily", pool: "intercity", seed: 1, dateKey: "2026-09-28", now: 0 });
    const b = createRun({ id: "b", mode: "daily", pool: "all", seed: 999, dateKey: "2026-09-28", now: 5 });
    const c = createRun({ id: "c", mode: "daily", pool: "all", seed: 1, dateKey: "2026-09-29", now: 0 });
    expect(a.rounds.map((r) => r.code)).toEqual(b.rounds.map((r) => r.code));
    expect(a.pool).toBe("all");
    expect(a.seed).toBe(dailySeed("2026-09-28"));
    expect(c.rounds.map((r) => r.code)).not.toEqual(a.rounds.map((r) => r.code));
  });
  it("is stable across versions for a given seed", () => {
    // If this changes, old daily rides and shared seeds would point at different stations.
    expect(hashString("daily:2026-09-28")).toBe(hashString("daily:2026-09-28"));
    expect(pickDistinct([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 12345)).toEqual(
      pickDistinct([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 12345),
    );
  });
});

describe("run flow", () => {
  it("plays a full run", () => {
    let run = newRun();
    for (let i = 0; i < 5; i++) {
      const st = stationOf(run);
      run = applyGuess(run, st.lat + 0.2, st.lng, T0 + 1000);
      expect(currentRound(run).outcome).toBeNull();
      if (i === 2) run = revealRound(run, T0 + 2000);
      else run = applyGuess(run, st.lat + 0.001, st.lng, T0 + 3000);
      expect(currentRound(run).outcome).toBe(i === 2 ? "revealed" : "found");
      run = advance(run, T0 + 4000);
    }
    expect(run.status).toBe("finished");
    expect(run.total).toBe(runTotal(run));
    expect(run.rounds[2].guesses.length).toBe(1);
    expect(roundScore(run.rounds[2])).toBe(0);
    expect(runSchema.safeParse(run).success).toBe(true);
  });
  it("ignores actions that do not fit the state", () => {
    let run = newRun();
    expect(advance(run, T0)).toBe(run); // cannot skip an unfinished round
    const st = stationOf(run);
    run = applyGuess(run, st.lat, st.lng, T0 + 10);
    const ended = run;
    expect(applyGuess(ended, st.lat, st.lng, T0 + 20)).toBe(ended); // no guesses after the round ended
    expect(revealRound(ended, T0 + 20)).toBe(ended);
    const next = advance(ended, T0 + 30);
    expect(advance(next, T0 + 40)).toBe(next); // double "next" does nothing
    expect(next.current).toBe(1);
  });
  it("ends the round by itself when the score runs out", () => {
    let run = newRun();
    const st = stationOf(run);
    for (let i = 0; i < 5; i++) run = applyGuess(run, st.lat + 2, st.lng + 2, T0 + i);
    expect(currentRound(run).outcome).toBe("revealed");
    expect(roundScore(currentRound(run))).toBe(0);
  });
  it("counts a guess exactly on the radius as a hit", () => {
    expect(HIT_RADIUS_M).toBe(500);
    const run = newRun();
    const st = stationOf(run);
    // 0.0044 degrees latitude is about 489 m
    expect(currentRound(applyGuess(run, st.lat + 0.0044, st.lng, T0)).outcome).toBe("found");
  });
});

describe("dates", () => {
  it("uses Dutch calendar days", () => {
    expect(dateKeyFor(Date.UTC(2026, 8, 27, 22, 30))).toBe("2026-09-28"); // 00:30 in Amsterdam
    expect(dateKeyFor(Date.UTC(2026, 8, 27, 21, 30))).toBe("2026-09-27");
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});
