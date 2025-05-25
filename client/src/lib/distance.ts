/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 * @param distance Distance in meters
 * @returns Formatted string
 */
export function formatDistance(distance: number): string {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distance)}m`;
}

/**
 * Get accuracy rating based on distance
 * @param distance Distance in meters
 * @returns Rating object with color and description
 */
export function getAccuracyRating(distance: number) {
  if (distance <= 500) {
    return {
      rating: "Excellent",
      color: "emerald",
      description: "Perfect!",
    };
  } else if (distance <= 2000) {
    return {
      rating: "Very Good",
      color: "yellow",
      description: "Very close!",
    };
  } else if (distance <= 15000) {
    return {
      rating: "Good",
      color: "amber",
      description: "Getting close",
    };
  } else {
    return {
      rating: "Keep Trying",
      color: "red",
      description: "Not very close...",
    };
  }
}
