// Builds the two data files the game ships with:
//   src/data/stations.json  playable NS stations (Rijden de Treinen open data, CC0)
//   src/data/rails.json     railway lines (OpenStreetMap, ODbL), filtered and rounded
// Run with `npm run data`. The build fails if the station list looks wrong.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const root = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p);

// Station types from the source, mapped to our difficulty tiers.
// Tier 1 and 2 form the "intercity" pool. Occasional stations are left out.
const TIERS: Record<string, number | null> = {
  megastation: 1,
  knooppuntIntercitystation: 1,
  intercitystation: 2,
  knooppuntSneltreinstation: 2,
  sneltreinstation: 2,
  knooppuntStoptreinstation: 3,
  stoptreinstation: 3,
  facultatiefStation: null,
};
// Generous bounding box around the Netherlands.
const NL = { minLat: 50.7, maxLat: 53.6, minLng: 3.3, maxLng: 7.3 };

type Station = { code: string; name: string; tier: number; lat: number; lng: number };

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const overrides = JSON.parse(read("data/overrides.json").toString()) as {
  exclude: string[];
  rename: Record<string, string>;
  add: Station[];
};

let stations: Station[] = [];
for (const row of parseCsv(read("data/raw/stations-2023-09-nl.csv").toString())) {
  if (!(row.type in TIERS)) throw new Error(`Unknown station type ${row.type} for ${row.code}`);
  const tier = TIERS[row.type];
  if (tier === null || row.country !== "NL") continue;
  stations.push({
    code: row.code,
    name: row.name_long,
    tier,
    lat: Math.round(Number(row.geo_lat) * 1e5) / 1e5,
    lng: Math.round(Number(row.geo_lng) * 1e5) / 1e5,
  });
}
stations = stations
  .filter((s) => !overrides.exclude.includes(s.code))
  .map((s) => ({ ...s, name: overrides.rename[s.code] ?? s.name }))
  .concat(overrides.add)
  .sort((a, b) => a.name.localeCompare(b.name, "nl"));

const problems: string[] = [];
const seen = new Set<string>();
for (const s of stations) {
  if (!s.code || !s.name) problems.push(`missing code or name: ${JSON.stringify(s)}`);
  if (!(s.lat >= NL.minLat && s.lat <= NL.maxLat && s.lng >= NL.minLng && s.lng <= NL.maxLng))
    problems.push(`${s.name} (${s.code}) lies outside the Netherlands: ${s.lat}, ${s.lng}`);
  for (const key of [`code:${s.code}`, `name:${s.name}`]) {
    if (seen.has(key)) problems.push(`duplicate ${key}`);
    seen.add(key);
  }
}
if (problems.length) throw new Error(`Station data problems:\n  ${problems.join("\n  ")}`);

const stationsJson = JSON.stringify(stations);
const dataVersion = createHash("sha256").update(stationsJson).digest("hex").slice(0, 10);
writeFileSync(`${root}src/data/stations.json`, stationsJson);
writeFileSync(
  `${root}src/data/meta.json`,
  JSON.stringify({
    dataVersion,
    stationCount: stations.length,
    intercityCount: stations.filter((s) => s.tier <= 2).length,
  }),
);

// Railway lines: drop crossovers and non-passenger track, round to ~1 m, keep one usage letter.
const DROP_USAGE = new Set(["industrial", "military", "test"]);
const USAGE: Record<string, string> = { main: "m", branch: "b", tourism: "t" };
type Feature = { properties: Record<string, string | null>; geometry: { type: string; coordinates: number[][] } };
const osm = JSON.parse(gunzipSync(read("data/raw/spoorlijnen.geojson.gz")).toString()) as { features: Feature[] };
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const features = osm.features
  .filter((f) => f.geometry.type === "LineString")
  .filter((f) => f.properties.service !== "crossover" && !DROP_USAGE.has(f.properties.usage ?? ""))
  .map((f) => ({
    type: "Feature",
    properties: { u: USAGE[f.properties.usage ?? ""] ?? "b" },
    geometry: { type: "LineString", coordinates: f.geometry.coordinates.map(([x, y]) => [round5(x), round5(y)]) },
  }));
writeFileSync(`${root}src/data/rails.json`, JSON.stringify({ type: "FeatureCollection", features }));

console.log(`${stations.length} stations (data version ${dataVersion}), ${features.length} railway segments`);
