# OvGuesser

A guessing game for Dutch train stations: the player is shown a station name and clicks on a map where they think it is. The current version lives at the repo root (see README.md). The original Replit version lives in `old_version/` as a reference.

## Current version

- Game rules live in `src/game/` as pure functions and are shared with the server. Change scoring only in `src/game/scoring.ts`.
- Player runs are stored in the browser (IndexedDB, `src/storage/`). Keep one record per run; don't add per-guess keys.
- The server (`server/`) stores finished runs anonymously in Postgres and recomputes scores itself. Migrations are an append-only list in `server/db.ts`; never edit a shipped one.
- Tests: `npm test` (set `TEST_DATABASE_URL` for the Postgres tests) and `npm run test:e2e` after `npm run build`.
- UI copy is Dutch first, with English in `src/i18n/strings.ts`.
- Deployed on Railway (project `ovguesser`, service `ovguesser`, with a `Postgres` service). The old version's tables (`train_stations`, `game_results`, `game_sessions`, `game_stats`) are still in that database and untouched.

## old_version/

The first OvGuesser, built with the Replit agent between May and June 2025. Don't edit it; read it to see how things were done, then build the new version at the root.

Stack: React 18 + Vite + Tailwind/shadcn on the client, Express + Drizzle ORM on Postgres (Neon) on the server, Leaflet for the map.

- `client/src/pages/game.tsx`: main game loop (guesses, attempts, sessions)
- `client/src/components/game-map.tsx`: Leaflet map
- `client/src/assets/spoorlijnen2.geojson`: Dutch railway lines drawn on the map
- `client/src/lib/distance.ts`: distance between guess and station
- `server/routes.ts`: API (`/api/stations`, `/api/guess`, `/api/game-result`, `/api/session`, ...)
- `server/cleanup.ts`, `cleanup-*.js`: deleting old game results to stay under the storage limit
- `shared/schema.ts`: DB tables (`train_stations`, `game_results`, `game_sessions`, `game_stats`)
- `migrate-stations.js`: loads station data into the DB
- `attached_assets/`: files the user uploaded to the Replit agent (screenshots, prompts, data)

## History

The repo's git history starts with the old project's 135 commits. Commit `47f3420` moved them into `old_version/`, so trace old files with `--follow`:

```sh
git log --follow old_version/server/routes.ts
git blame -C old_version/server/routes.ts
```

Most old commit messages are Replit auto-checkpoints ("Assistant checkpoint: ..."), so read the diffs instead of trusting the messages.

The branch `old/replit-agent` is the old repo's side branch. It split off before the database cleanup work was added and was never merged.
