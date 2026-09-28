import meta from "../data/meta.json";
import stationList from "../data/stations.json";
import type { Pool, Station } from "./types";

export const STATIONS: readonly Station[] = stationList;
export const DATA_VERSION: string = meta.dataVersion;
export const STATION_BY_CODE: ReadonlyMap<string, Station> = new Map(STATIONS.map((s) => [s.code, s]));

export function stationPool(pool: Pool): readonly Station[] {
  return pool === "intercity" ? STATIONS.filter((s) => s.tier <= 2) : STATIONS;
}
