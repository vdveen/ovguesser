# OVGuesser

Guess where Dutch train stations are. Five stations per challenge, a daily challenge that's the same for everyone, and your own history kept in your browser. Live at [ovguesser.nl](https://ovguesser.nl).

## How it works

- The game runs in the browser. Station data ships with the app, and distances and scores are computed locally, so nothing waits on the server between clicks.
- Runs are stored in the browser's IndexedDB: one record of about 1 kB per run, written after every guess. A reload resumes the run. "Mijn uitdagingen" shows history and stats, and can export and import a JSON backup.
- When a run finishes, the browser sends it to the server anonymously. The server recomputes every distance and score from its own station data and stores the run in Postgres. That powers the daily ranking and the per-station "x% found it on the first try" line. No accounts, cookies or IP addresses.
- The game keeps working if the server or database is down; only the shared statistics disappear.

## Scoring

Each station starts at 5,000 points. Every miss costs 250 points plus 7.5 per km, at most 1,000 per miss. A guess within 500 m finds the station. Giving up scores 0, and a round that reaches 0 ends by itself. See `src/game/scoring.ts`.

## Layout

```
src/game/        rules: distance, scoring, seeded station picks, run state (shared with the server)
src/storage/     IndexedDB repository, crash backup, export/import, player stats
src/map/         MapLibre map: OpenFreeMap basemap without labels, railway layer, markers
src/ui/, app/    React screens and the game hook
src/i18n/        Dutch and English strings
server/          Hono server: static files, /healthz, /api (runs, daily and station stats), migrations
scripts/         data build, server bundle, precompression
data/            source data: Rijden de Treinen station list (CC0), OSM railway lines (ODbL), overrides.json
e2e/             Playwright tests (desktop and phone)
old_version/     the original Replit version, kept for reference
docs/plan/       the rebuild plan and the first prototype
docs/design/     the four design directions considered; the app follows option A (Perron)
```

## Development

Needs Node 22+ and, for the API tests, a Postgres database.

```sh
npm install
npm run data          # builds src/data/*.json from data/
npm run dev:server    # API on :8080 (set DATABASE_URL for stats)
npm run dev           # Vite on :5173, proxies /api to :8080
npm test              # unit tests; set TEST_DATABASE_URL to include the Postgres tests
npm run build && E2E_DATABASE_URL=postgres://… npm run test:e2e
npm run lint
```

## Data

`npm run data` reads `data/raw/stations-2023-09-nl.csv` and `data/raw/spoorlijnen.geojson.gz`, applies `data/overrides.json`, checks the result and writes `src/data/`. To add or rename a station, edit `overrides.json`. The build fails on duplicate codes or names, or on stations outside the Netherlands.

## Deployment

Railway deploys every push to `main` once the GitHub checks pass. The service settings (Dockerfile build, start command, `/healthz` health check, restart retries, domains, GitHub source) live in `.railway/railway.ts`. Railway doesn't read that file during deploys; change it, then run `railway config plan` to preview and `railway config apply` to apply. It's a named partial that manages only the app service, so the Postgres database is left alone.

Environment variables:

- `DATABASE_URL`: Postgres. The server applies its own migrations on start; its tables are prefixed `ovg_`. Without it the game still works, minus shared statistics.
- `PORT`: defaults to 8080.
- `CANONICAL_HOST` and `REDIRECT_HOSTS`: e.g. `ovguesser.nl` and `ovguesser.com,www.ovguesser.com`. Requests for a redirect host get a 301 to the canonical host.
