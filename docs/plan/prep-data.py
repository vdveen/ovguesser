# Prototype of the data build step: turns the raw exports into the two small
# files the game loads. The real version becomes scripts/build-data.ts.
# Run from the repo root: python3 docs/plan/prep-data.py docs/plan/data/stations-2023-09-nl.csv
import csv, json, sys

OUT = "docs/plan/data"

# Stations: Rijden de Treinen open data (CC0), stations-2023-09-nl.csv
TYPES = {
    "megastation": 1, "knooppuntIntercitystation": 1, "intercitystation": 2,
    "knooppuntSneltreinstation": 2, "sneltreinstation": 2,
    "knooppuntStoptreinstation": 3, "stoptreinstation": 3, "facultatiefStation": 0,
}
stations = []
for row in csv.DictReader(open(sys.argv[1])):
    tier = TYPES[row["type"]]
    if tier == 0:
        continue  # occasional stations (Heerenveen IJsstadion, Rotterdam Stadion)
    stations.append({
        "code": row["code"], "name": row["name_long"], "tier": tier,
        "lat": round(float(row["geo_lat"]), 5), "lng": round(float(row["geo_lng"]), 5),
    })
stations.sort(key=lambda s: s["name"])
json.dump(stations, open(f"{OUT}/stations.json", "w"), ensure_ascii=False, separators=(",", ":"))

# Railway lines: spoorlijnen.geojson (OSM ways with tags, simplified geometry)
DROP_USAGE = {"industrial", "military", "test"}
USAGE = {"main": "m", "branch": "b", "tourism": "t"}
feats = []
for f in json.load(open("spoorlijnen.geojson"))["features"]:
    p = f["properties"]
    if p.get("service") == "crossover" or p.get("usage") in DROP_USAGE:
        continue
    coords = [[round(x, 5), round(y, 5)] for x, y in f["geometry"]["coordinates"]]
    feats.append({"type": "Feature", "properties": {"u": USAGE.get(p.get("usage"), "b")},
                  "geometry": {"type": "LineString", "coordinates": coords}})
json.dump({"type": "FeatureCollection", "features": feats}, open(f"{OUT}/rails.json", "w"), separators=(",", ":"))
print(len(stations), "stations,", len(feats), "rail segments")
