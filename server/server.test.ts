import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dateKeyFor } from "../src/game/dates";
import { advance, applyGuess, createRun, currentRound, revealRound } from "../src/game/run";
import { STATION_BY_CODE } from "../src/game/stations";
import type { Run } from "../src/game/types";
import { createApp } from "./app";
import { connect, migrate, type Sql } from "./db";
import { verifyRun } from "./verify";

const url = process.env.TEST_DATABASE_URL;
const NOW = Date.UTC(2026, 8, 28, 10);
const TODAY = dateKeyFor(NOW);
let counter = 0;

/** Plays a run: `misses[i]` wrong guesses in round i, then a hit (or giving up when giveUp includes i). */
function play(mode: "classic" | "daily", misses: number[], giveUp: number[] = []): Run {
  counter++;
  let run = createRun({
    id: crypto.randomUUID(),
    mode,
    pool: "all",
    seed: counter * 7919,
    dateKey: TODAY,
    now: NOW - 60_000,
  });
  for (let i = 0; i < 5; i++) {
    const st = STATION_BY_CODE.get(currentRound(run).code)!;
    for (let m = 0; m < misses[i]; m++) run = applyGuess(run, st.lat + 0.3 + m * 0.1, st.lng, NOW - 50_000);
    run = giveUp.includes(i) ? revealRound(run, NOW - 40_000) : applyGuess(run, st.lat + 0.001, st.lng, NOW - 40_000);
    run = advance(run, NOW - 30_000);
  }
  return run;
}

describe("verifyRun", () => {
  it("accepts an honest run and recomputes the same total", () => {
    const run = play("classic", [1, 0, 2, 0, 3], [4]);
    const v = verifyRun(run, NOW);
    expect(v.ok && v.verified).toBe(true);
    expect(v.ok && v.total).toBe(run.total);
  });
  it("ignores distances claimed by the client", () => {
    const run = play("classic", [1, 1, 1, 1, 1]);
    const forged = structuredClone(run);
    for (const r of forged.rounds) for (const g of r.guesses) g[2] = 10; // claim every guess was a near hit
    forged.total = 25000;
    const v = verifyRun(forged, NOW);
    // Distances come from the coordinates, so the forged numbers change nothing.
    expect(v.ok && v.total).toBe(run.total);
    expect(run.total).toBeLessThan(25000);
  });
  it("rejects a found round without a hit", () => {
    const run = play("classic", [0, 0, 0, 0, 0]);
    const forged = structuredClone(run);
    forged.rounds[0].guesses[0][0] += 1;
    expect(verifyRun(forged, NOW)).toEqual({ ok: false, reason: "found-without-hit" });
  });
  it("marks runs with swapped stations as unverified", () => {
    const run = play("classic", [0, 0, 0, 0, 0]);
    const forged = structuredClone(run);
    const ut = STATION_BY_CODE.get("UT")!;
    forged.rounds[0] = { ...forged.rounds[0], code: "UT", name: ut.name, guesses: [[ut.lat, ut.lng, 0, 1000]] };
    const v = verifyRun(forged, NOW);
    expect(v.ok && !v.verified).toBe(true);
  });
  it("rejects unfinished and malformed runs", () => {
    const run = play("classic", [0, 0, 0, 0, 0]);
    expect(verifyRun({ ...run, status: "active" }, NOW)).toEqual({ ok: false, reason: "not-finished" });
    expect(verifyRun({ hello: 1 }, NOW)).toEqual({ ok: false, reason: "invalid" });
  });
  it("only verifies daily rides for around today", () => {
    const run = play("daily", [0, 0, 0, 0, 0]);
    expect(verifyRun(run, NOW + 5 * 86_400_000).ok && verifyRun(run, NOW + 5 * 86_400_000)).toMatchObject({
      verified: false,
    });
  });
});

describe.skipIf(!url)("API with Postgres", () => {
  let sql: Sql;
  let app: ReturnType<typeof createApp>;
  const post = (body: unknown) =>
    app.request("/api/runs", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

  beforeAll(async () => {
    sql = connect(url as string);
    await sql`drop table if exists ovg_rounds, ovg_runs, ovg_migrations`;
    expect(await migrate(sql)).toBe(1);
    expect(await migrate(sql)).toBe(0);
    app = createApp({ sql, now: () => NOW });
  });
  afterAll(async () => {
    await sql.end();
  });

  it("stores a run once", async () => {
    const run = play("classic", [2, 1, 0, 0, 1]);
    const first = await (await post(run)).json();
    expect(first).toMatchObject({ stored: true, verified: true, total: run.total });
    const again = await (await post(run)).json();
    expect(again.stored).toBe(false);
    const rows = await sql`select attempts, score from ovg_rounds where run_id = ${run.id} order by idx`;
    expect(rows.map((r) => r.attempts)).toEqual([3, 2, 1, 1, 2]);
  });

  it("rejects bad input", async () => {
    expect((await post({ nope: true })).status).toBe(422);
    const res = await app.request("/api/runs", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("ranks daily rides", async () => {
    const good = play("daily", [0, 0, 0, 0, 0]);
    const bad = play("daily", [3, 3, 3, 3, 3], [0]);
    const mid = play("daily", [1, 1, 1, 1, 1]);
    await post(bad);
    await post(good);
    const res = await (await post(mid)).json();
    expect(res.daily.players).toBe(3);
    expect(res.daily.percentile).toBe(50);
    const stats = await (await app.request(`/api/stats/daily/${TODAY}?score=25000`)).json();
    expect(stats.players).toBe(3);
    expect(stats.best).toBe(25000);
    expect(stats.histogram.reduce((a: number, b: number) => a + b, 0)).toBe(3);
    const overview = await (await app.request("/api/stats/overview")).json();
    expect(overview.dailyPlayersToday).toBe(3);
  });

  it("reports station difficulty", async () => {
    const stats = await (await app.request("/api/stats/stations")).json();
    const daily = play("daily", [0, 0, 0, 0, 0]);
    const code = daily.rounds[0].code;
    expect(stats[code].plays).toBeGreaterThanOrEqual(3);
    expect(stats[code].firstTry).toBeGreaterThan(0);
  });

  it("answers health checks", async () => {
    expect(await (await app.request("/healthz")).json()).toEqual({ ok: true, db: "up" });
  });
});

describe("canonical host", () => {
  it("redirects other domains to ovguesser.nl, keeping the path", async () => {
    const app = createApp({
      sql: null,
      redirectHosts: ["ovguesser.com", "www.ovguesser.com"],
      canonicalHost: "ovguesser.nl",
    });
    const res = await app.request("https://ovguesser.com/some/path?x=1", { headers: { host: "ovguesser.com" } });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://ovguesser.nl/some/path?x=1");
    const same = await app.request("https://ovguesser.nl/healthz", { headers: { host: "ovguesser.nl" } });
    expect(same.status).toBe(200);
    const health = await app.request("https://ovguesser.com/healthz", { headers: { host: "ovguesser.com" } });
    expect(health.status).toBe(200);
  });
});

describe("API without a database", () => {
  it("keeps the game playable and says why stats are missing", async () => {
    const app = createApp({ sql: null });
    expect((await app.request("/api/stats/overview")).status).toBe(503);
    expect(await (await app.request("/healthz")).json()).toEqual({ ok: true, db: "off" });
  });
});
