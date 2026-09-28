import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { advance, applyGuess, createRun, currentRound } from "../game/run";
import { STATION_BY_CODE } from "../game/stations";
import type { Run } from "../game/types";
import { exportPayload, parseExport } from "./backup";
import { activeBackup, MemoryRepo, openRepo } from "./repo";
import { playerStats } from "./stats";

let n = 0;
function playedRun(opts: { mode?: "classic" | "daily"; dateKey?: string; finish?: boolean } = {}): Run {
  n++;
  let run = createRun({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    mode: opts.mode ?? "classic",
    pool: "all",
    seed: n,
    dateKey: opts.dateKey ?? "2026-09-28",
    now: n * 1000,
  });
  const rounds = opts.finish === false ? 1 : 5;
  for (let i = 0; i < rounds; i++) {
    const st = STATION_BY_CODE.get(currentRound(run).code)!;
    run = applyGuess(run, st.lat + 0.1, st.lng, n * 1000 + 1);
    if (opts.finish === false) break;
    run = applyGuess(run, st.lat, st.lng, n * 1000 + 2);
    run = advance(run, n * 1000 + 3);
  }
  return run;
}

describe("IndexedDB repository", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("stores, resumes and lists runs newest first", async () => {
    const repo = await openRepo();
    expect(repo.kind).toBe("indexeddb");
    const a = playedRun();
    const b = playedRun({ finish: false });
    await repo.put(a);
    await repo.put(b);
    expect((await repo.active())?.id).toBe(b.id);
    const { runs, skipped } = await repo.list();
    expect(runs.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(skipped).toBe(0);
    expect(await repo.get(a.id)).toEqual(a);
  });

  it("survives reopening the database", async () => {
    const run = playedRun({ finish: false });
    await (await openRepo()).put(run);
    const reopened = await openRepo();
    expect((await reopened.active())?.rounds[0].guesses.length).toBe(1);
  });

  it("skips corrupt records instead of failing", async () => {
    const repo = await openRepo();
    await repo.put(playedRun());
    await repo.put({ id: "broken", nonsense: true } as unknown as Run);
    const { runs, skipped } = await repo.list();
    expect(runs.length).toBe(1);
    expect(skipped).toBe(1);
  });

  it("round-trips an export, and importing twice changes nothing", async () => {
    const runs = [playedRun(), playedRun(), playedRun({ finish: false })];
    const file = JSON.stringify(exportPayload(runs));
    globalThis.indexedDB = new IDBFactory();
    const target = await openRepo();
    expect(await target.importRuns(parseExport(file))).toEqual({ imported: 3, skipped: 0 });
    expect(await target.importRuns(parseExport(file))).toEqual({ imported: 3, skipped: 0 });
    const listed = await target.list();
    expect(listed.runs.length).toBe(3);
    // an active run from another device is not resumable here
    expect(await target.active()).toBeUndefined();
    await target.clear();
    expect((await target.list()).runs.length).toBe(0);
  });

  it("rejects files that are not exports", () => {
    expect(() => parseExport("{")).toThrow("not-json");
    expect(() => parseExport('{"app":"other"}')).toThrow("not-ovguesser");
  });

  it("falls back to memory when IndexedDB is missing", async () => {
    const repo = await openRepo(false);
    expect(repo).toBeInstanceOf(MemoryRepo);
    await repo.put(playedRun());
    expect((await repo.list()).runs.length).toBe(1);
  });

  it("stays small: a finished run is about 1 kB", () => {
    const size = JSON.stringify(playedRun()).length;
    expect(size).toBeLessThan(1500);
  });
});

describe("active run backup", () => {
  it("recovers a guess that never reached IndexedDB", async () => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    globalThis.indexedDB = new IDBFactory();
    const repo = await openRepo();
    const started = { ...playedRun({ finish: false }), updatedAt: 1 };
    const guessed = {
      ...started,
      rounds: started.rounds.map((r, i) => (i === 0 ? { ...r, guesses: [...r.guesses, r.guesses[0]] } : r)),
      updatedAt: 2,
    };
    await repo.put({ ...started, rounds: started.rounds.map((r) => ({ ...r, guesses: [] })) });
    activeBackup.write(guessed);
    expect(await activeBackup.recover(repo)).toBe(true);
    expect((await repo.get(started.id))?.rounds[0].guesses.length).toBe(2);
    // an older backup never overwrites newer stored data
    expect(await activeBackup.recover(repo)).toBe(false);
    activeBackup.write({ ...guessed, status: "finished" });
    expect(activeBackup.read()).toBeUndefined();
  });
});

describe("player stats", () => {
  it("computes totals and the daily streak", () => {
    const runs = [
      playedRun({ mode: "daily", dateKey: "2026-09-28" }),
      playedRun({ mode: "daily", dateKey: "2026-09-27" }),
      playedRun({ mode: "daily", dateKey: "2026-09-25" }),
      playedRun(),
      playedRun({ finish: false }),
    ];
    const s = playerStats(runs, "2026-09-28");
    expect(s.finished).toBe(4);
    expect(s.dailyStreak).toBe(2);
    expect(s.playedDailyToday?.dateKey).toBe("2026-09-28");
    expect(s.best).toBeGreaterThan(0);
    // yesterday's streak still counts before today's ride is played
    expect(playerStats(runs.slice(1), "2026-09-28").dailyStreak).toBe(1);
  });
});
