import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { connect, migrate, type Sql } from "./db";

const port = Number(process.env.PORT ?? 8080);
const clientDir = resolve(process.env.CLIENT_DIR ?? "dist/client");

async function database(): Promise<Sql | null> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL not set: the game works, shared statistics are off");
    return null;
  }
  const sql = connect(url);
  // Keep retrying in the background; the game itself doesn't need the database to start.
  for (let attempt = 1; ; attempt++) {
    try {
      const applied = await migrate(sql);
      console.log(`database ready${applied ? `, applied ${applied} migration(s)` : ""}`);
      return sql;
    } catch (err) {
      console.error(`database not ready (attempt ${attempt}):`, (err as Error).message);
      if (attempt >= 5) {
        console.error("continuing without shared statistics");
        return sql;
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const sql = await database();
const redirectHosts = (process.env.REDIRECT_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const app = createApp({ sql, clientDir, redirectHosts, canonicalHost: process.env.CANONICAL_HOST });
const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) =>
  console.log(`OVGuesser listening on :${info.port}`),
);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
    void sql?.end({ timeout: 5 });
    setTimeout(() => process.exit(0), 6000).unref();
  });
}
