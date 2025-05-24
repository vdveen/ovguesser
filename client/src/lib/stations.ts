import type { TrainStation, StationFeature } from "@shared/schema";

/**
 * Convert TrainStation to GeoJSON Feature format
 */
export function stationToFeature(station: TrainStation): StationFeature {
  return {
    type: "Feature",
    properties: {
      name: station.name,
      ...(station.properties as any),
    },
    geometry: {
      type: "Point",
      coordinates: station.coordinates as [number, number],
    },
    id: station.id.toString(),
  };
}

/**
 * Get bounds for Netherlands to constrain map view
 */
export function getNetherlandsBounds() {
  return {
    north: 53.7,
    south: 50.7,
    east: 7.3,
    west: 3.2,
  };
}

/**
 * Check if coordinates are within Netherlands bounds
 */
export function isInNetherlands(lat: number, lng: number): boolean {
  const bounds = getNetherlandsBounds();
  return lat >= bounds.south && lat <= bounds.north && 
         lng >= bounds.west && lng <= bounds.east;
}

/**
 * Get center point of Netherlands
 */
export function getNetherlandsCenter(): [number, number] {
  return [52.1326, 5.2913]; // [latitude, longitude]
}

/**
 * Get appropriate zoom level based on distance
 */
export function getZoomForDistance(distance: number): number {
  if (distance <= 1000) return 15;
  if (distance <= 5000) return 13;
  if (distance <= 25000) return 11;
  if (distance <= 100000) return 9;
  return 7;
}
