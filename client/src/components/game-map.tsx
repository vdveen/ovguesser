import { useEffect, useRef, useCallback, useMemo } from "react";
import { MapPin, Loader2 } from "lucide-react";

// Import Leaflet dynamically to avoid SSR issues
let L: any = null;

interface PreviousGuess {
  lat: number;
  lng: number;
  distance: number;
  attempt: number;
}

interface GameMapProps {
  onMapClick: (lat: number, lng: number) => void;
  userMarker?: { lat: number; lng: number } | null;
  stationMarker?: { lat: number; lng: number } | null;
  previousGuesses?: PreviousGuess[];
  isLoading?: boolean;
}

// Cache the GeoJSON data to avoid re-fetching
let cachedRailwayData: any = null;
let railwayDataPromise: Promise<any> | null = null;

const loadRailwayData = async () => {
  if (cachedRailwayData) {
    return cachedRailwayData;
  }

  if (railwayDataPromise) {
    return railwayDataPromise;
  }

  railwayDataPromise = fetch("/spoorlijnen2.geojson")
    .then((response) => response.json())
    .then((data) => {
      cachedRailwayData = data;
      railwayDataPromise = null;
      return data;
    })
    .catch((error) => {
      railwayDataPromise = null;
      console.log("Railway lines data not available:", error);
      return null;
    });

  return railwayDataPromise;
};

export default function GameMap({
  onMapClick,
  userMarker,
  stationMarker,
  previousGuesses = [],
  isLoading,
}: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const stationMarkerRef = useRef<any>(null);
  const previousGuessMarkersRef = useRef<any[]>([]);
  const railwayLayerRef = useRef<any>(null);
  const onMapClickRef = useRef(onMapClick);
  const isLoadingRef = useRef(isLoading);

  // Keep refs updated without triggering re-renders
  onMapClickRef.current = onMapClick;
  isLoadingRef.current = isLoading;

  // Memoize marker creation functions
  const createUserMarker = useCallback((lat: number, lng: number) => {
    if (!L) return null;
    return L.marker([lat, lng], {
      icon: L.divIcon({
        className: "custom-marker",
        html: '<div style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    });
  }, []);

  const createStationMarker = useCallback((lat: number, lng: number) => {
    if (!L) return null;
    return L.marker([lat, lng], {
      icon: L.divIcon({
        className: "station-marker",
        html: '<div style="background: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    });
  }, []);

  const createPreviousGuessMarker = useCallback((guess: PreviousGuess) => {
    if (!L) return null;
    const distanceKm =
      guess.distance > 1000
        ? `${(guess.distance / 1000).toFixed(1)}km`
        : `${Math.round(guess.distance)}m`;

    return L.marker([guess.lat, guess.lng], {
      icon: L.divIcon({
        className: "previous-guess-marker",
        html: `
          <div style="background: #f59e0b; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.2);"></div>
          <div style="position: absolute; top: 22px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap; pointer-events: none;">${distanceKm}</div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    });
  }, []);

  // Initialize map (only once)
  useEffect(() => {
    const initMap = async () => {
      if (
        typeof window === "undefined" ||
        !mapRef.current ||
        mapInstanceRef.current
      )
        return;

      // Dynamically import Leaflet
      if (!L) {
        L = (await import("leaflet")).default;

        // Fix for default markers in Leaflet
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      }

      // Initialize map centered on Netherlands
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true, // Use canvas for better performance
      }).setView([52.1326, 5.2913], 9);

      // Add base layer without labels (CartoDB Positron without labels)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 18,
          subdomains: "abcd",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(mapInstanceRef.current);

      // Add custom zoom controls
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(mapInstanceRef.current);

      // Add scale bar in a subtle way
      L.control
        .scale({
          position: "bottomright",
          metric: true,
          imperial: false,
          maxWidth: 100,
        })
        .addTo(mapInstanceRef.current);

      // Load and add railway lines layer (cached)
      try {
        const railwayData = await loadRailwayData();
        if (railwayData && mapInstanceRef.current) {
          railwayLayerRef.current = L.geoJSON(railwayData, {
            style: {
              color: "#6b7280", // Darker grey color
              weight: 2, // Thin line width
              opacity: 1.0, // Fully opaque
            },
          }).addTo(mapInstanceRef.current);
        }
      } catch (error) {
        console.log("Failed to load railway data:", error);
      }

      // Handle map clicks
      mapInstanceRef.current.on("click", (e: any) => {
        if (!isLoadingRef.current) {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });
    };

    initMap();

    // Only cleanup when component unmounts, not on every re-render
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        railwayLayerRef.current = null;
        userMarkerRef.current = null;
        stationMarkerRef.current = null;
        previousGuessMarkersRef.current = [];
      }
    };
  }, []); // Empty dependency array - only run once

  // Update user marker efficiently
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      mapInstanceRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    // Add new user marker
    if (userMarker) {
      userMarkerRef.current = createUserMarker(userMarker.lat, userMarker.lng);
      if (userMarkerRef.current) {
        userMarkerRef.current.addTo(mapInstanceRef.current);
      }
    }
  }, [userMarker, createUserMarker]);

  // Update station marker efficiently
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Remove existing station marker
    if (stationMarkerRef.current) {
      mapInstanceRef.current.removeLayer(stationMarkerRef.current);
      stationMarkerRef.current = null;
    }

    // Add new station marker
    if (stationMarker) {
      stationMarkerRef.current = createStationMarker(
        stationMarker.lat,
        stationMarker.lng,
      );
      if (stationMarkerRef.current) {
        stationMarkerRef.current.addTo(mapInstanceRef.current);
      }
    }
  }, [stationMarker, createStationMarker]);

  // Update previous guess markers efficiently
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Remove existing previous guess markers
    previousGuessMarkersRef.current.forEach((marker) => {
      if (marker) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    previousGuessMarkersRef.current = [];

    // Add new previous guess markers
    previousGuesses.forEach((guess) => {
      const marker = createPreviousGuessMarker(guess);
      if (marker) {
        marker.addTo(mapInstanceRef.current);
        previousGuessMarkersRef.current.push(marker);
      }
    });
  }, [previousGuesses, createPreviousGuessMarker]);

  // Memoize the legend component to prevent unnecessary re-renders
  const legend = useMemo(
    () => (
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs z-[999]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm"></div>
            <span className="text-slate-600">Huidige gok</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full border border-white shadow-sm"></div>
            <span className="text-slate-600">Vorige gokken</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full border border-white shadow-sm"></div>
            <span className="text-slate-600">Werkelijke locatie</span>
          </div>
        </div>
      </div>
    ),
    [],
  );

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-slate-700">
              Afstand berekenen...
            </span>
          </div>
        </div>
      )}

      {/* Memoized Legend */}
      {legend}
    </div>
  );
}
