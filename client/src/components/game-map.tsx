import { useEffect, useRef } from "react";
import { MapPin, Loader2 } from "lucide-react";

// Import Leaflet dynamically to avoid SSR issues
let L: any = null;

interface GameMapProps {
  onMapClick: (lat: number, lng: number) => void;
  userMarker?: { lat: number; lng: number } | null;
  stationMarker?: { lat: number; lng: number } | null;
  isLoading?: boolean;
}

export default function GameMap({ onMapClick, userMarker, stationMarker, isLoading }: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const stationMarkerRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (typeof window === "undefined" || !mapRef.current) return;
      
      // Dynamically import Leaflet
      if (!L) {
        L = (await import("leaflet")).default;
        
        // Fix for default markers in Leaflet
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      }

      // Initialize map centered on Netherlands
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([52.1326, 5.2913], 7);

      // Add base layer without labels (CartoDB Positron without labels)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(mapInstanceRef.current);

      // Add custom zoom controls
      L.control.zoom({
        position: 'bottomright'
      }).addTo(mapInstanceRef.current);

      // Handle map clicks
      mapInstanceRef.current.on('click', (e: any) => {
        if (!isLoading) {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update user marker
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      mapInstanceRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    // Add new user marker
    if (userMarker) {
      userMarkerRef.current = L.marker([userMarker.lat, userMarker.lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
      }).addTo(mapInstanceRef.current);
    }
  }, [userMarker]);

  // Update station marker
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Remove existing station marker
    if (stationMarkerRef.current) {
      mapInstanceRef.current.removeLayer(stationMarkerRef.current);
      stationMarkerRef.current = null;
    }

    // Add new station marker
    if (stationMarker) {
      stationMarkerRef.current = L.marker([stationMarker.lat, stationMarker.lng], {
        icon: L.divIcon({
          className: 'station-marker',
          html: '<div style="background: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      }).addTo(mapInstanceRef.current);
    }
  }, [stationMarker]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-slate-700">Calculating distance...</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm"></div>
            <span className="text-slate-600">Your guess</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full border border-white shadow-sm"></div>
            <span className="text-slate-600">Actual location</span>
          </div>
        </div>
      </div>
    </div>
  );
}
