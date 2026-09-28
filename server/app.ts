import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { dateKeyFor } from "../src/game/dates";
import type { Sql } from "./db";
import { dailyStats, overview, type StationStat, stationStats, storeRun } from "./store";
import { verifyRun } from "./verify";

export interface AppOptions {
  sql: Sql | null;
  /** Directory with the built client. Omit in tests to serve the API only. */
  clientDir?: string;
  now?: () => number;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "connect-src 'self' https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "child-src blob:",
  "font-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** Tiny per-IP rate limit for writes. Kept in memory only; nothing about the client is stored. */
function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string, now: number) => {
    if (hits.size > 10_000) hits.clear();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return true;
    }
    h.n++;
    return h.n <= limit;
  };
}

export function createApp({ sql, clientDir, now = Date.now }: AppOptions) {
  const app = new Hono();
  const allowWrite = rateLimiter(30, 60_000);
  let stationCache: { at: number; data: Record<string, StationStat> } | null = null;

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    if (c.res.headers.get("content-type")?.includes("text/html")) c.header("Content-Security-Policy", CSP);
  });

  app.get("/healthz", async (c) => {
    let db: "up" | "down" | "off" = "off";
    if (sql) {
      try {
        await sql`select 1`;
        db = "up";
      } catch {
        db = "down";
      }
    }
    // The app can serve players without the database, so a database outage doesn't fail the health check.
    return c.json({ ok: true, db }, 200, { "Cache-Control": "no-store" });
  });

  const api = new Hono();
  api.use("*", async (c, next) => {
    if (!sql) return c.json({ error: "database-unavailable" }, 503);
    await next();
    c.header("Cache-Control", c.req.method === "GET" ? "public, max-age=30" : "no-store");
  });

  api.post("/runs", bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!allowWrite(ip, now())) return c.json({ error: "too-many-requests" }, 429);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid-json" }, 400);
    }
    const result = verifyRun(body, now());
    if (!result.ok) return c.json({ error: result.reason }, 422);
    const stored = await storeRun(sql as Sql, result);
    const daily =
      result.run.mode === "daily" && result.verified
        ? await dailyStats(sql as Sql, result.run.dateKey, result.total)
        : undefined;
    return c.json({ stored, verified: result.verified, total: result.total, daily });
  });

  api.get("/stats/daily/:dateKey{\\d{4}-\\d{2}-\\d{2}}", async (c) => {
    const score = Number(c.req.query("score"));
    return c.json(await dailyStats(sql as Sql, c.req.param("dateKey"), Number.isFinite(score) ? score : undefined));
  });

  api.get("/stats/stations", async (c) => {
    if (!stationCache || now() - stationCache.at > 5 * 60_000) {
      stationCache = { at: now(), data: await stationStats(sql as Sql) };
    }
    return c.json(stationCache.data);
  });

  api.get("/stats/overview", async (c) => c.json(await overview(sql as Sql, dateKeyFor(now()))));

  api.onError((err, c) => {
    console.error("api error", err);
    return c.json({ error: "server-error" }, 500);
  });
  api.notFound((c) => c.json({ error: "not-found" }, 404));
  app.route("/api", api);

  if (clientDir) {
    // Hashed build output never changes, so it can be cached forever.
    app.use(
      "/assets/*",
      serveStatic({ root: clientDir, precompressed: true, onFound: (_p, c) => immutable(c.header.bind(c)) }),
    );
    app.use(
      "*",
      serveStatic({
        root: clientDir,
        precompressed: true,
        onFound: (path, c) =>
          c.header(
            "Cache-Control",
            path.endsWith(".html") || path.endsWith("sw.js") ? "no-cache" : "public, max-age=3600",
          ),
      }),
    );
    // Page navigations get the app shell. A missing file gets a real 404, never HTML.
    app.get("*", async (c, next) => {
      const lastSegment = c.req.path.split("/").pop() ?? "";
      if (lastSegment.includes(".") || !c.req.header("accept")?.includes("text/html")) return next();
      c.header("Cache-Control", "no-cache");
      return serveStatic({ root: clientDir, path: "index.html" })(c, next);
    });
  }

  app.notFound((c) => c.text("Not found", 404));
  app.onError((err, c) => {
    console.error("server error", err);
    return c.text("Server error", 500);
  });
  return app;
}

function immutable(setHeader: (name: string, value: string) => void) {
  setHeader("Cache-Control", "public, max-age=31536000, immutable");
}
