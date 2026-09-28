import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, Marker, PaddingOptions } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef } from "react";
import railsUrl from "../data/rails.json?url";
import { formatDistance } from "../game/distance";
import type { Guess } from "../game/types";
import { loadBasemap } from "./basemap";

type MapLib = typeof import("maplibre-gl");

export const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.72],
  [7.25, 53.56],
];

export interface MapView {
  /** Changing the key moves the camera. */
  key: string;
  kind: "country" | "round";
  points?: [number, number][];
}

interface Props {
  guesses: Guess[];
  pending: [number, number] | null;
  station: { lat: number; lng: number; name: string } | null;
  view: MapView;
  padding: PaddingOptions;
  locale: string;
  label: string;
  interactive: boolean;
  onPin: (lngLat: [number, number]) => void;
  onReady: () => void;
  onNotice: (what: "rails" | "basemap") => void;
}

function el(className: string, html = ""): HTMLElement {
  const div = document.createElement("div");
  div.className = className;
  div.innerHTML = html;
  return div;
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function GameMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const markers = useRef<Marker[]>([]);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Create the map once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the map is created once; later props are read from propsRef
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    (async () => {
      const [lib, basemap] = await Promise.all([import("maplibre-gl"), loadBasemap()]);
      if (cancelled || !container.current) return;
      libRef.current = lib;
      // MapLibre looks for its worker next to its own file; point it at the one Vite bundled.
      lib.setWorkerUrl(workerUrl);
      if (!basemap.ok) propsRef.current.onNotice("basemap");
      map = new lib.Map({
        container: container.current,
        style: basemap.style,
        bounds: NL_BOUNDS,
        fitBoundsOptions: { padding: propsRef.current.padding },
        maxBounds: [
          [-1.0, 48.0],
          [11.5, 56.0],
        ],
        minZoom: 5,
        maxZoom: 16,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: {
          compact: true,
          customAttribution: "Spoorlijnen © OpenStreetMap · Stations: Rijden de Treinen",
        },
      });
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      map.addControl(new lib.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new lib.ScaleControl({ unit: "metric" }), "bottom-left");
      mapRef.current = map;
      // Handle for end-to-end tests, which need to turn coordinates into click positions.
      (container.current as HTMLDivElement & { __map?: MapLibreMap }).__map = map;
      map.on("click", (e) => {
        if (propsRef.current.interactive) propsRef.current.onPin([e.lngLat.lng, e.lngLat.lat]);
      });
      await map.once("load");
      if (cancelled) return;
      container.current.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      map.addSource("reveal", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "reveal-line",
        type: "line",
        source: "reveal",
        paint: { "line-color": "#002d72", "line-width": 2, "line-dasharray": [1.5, 1.5] },
      });
      try {
        const res = await fetch(railsUrl);
        if (!res.ok) throw new Error(String(res.status));
        map.addSource("rails", { type: "geojson", data: await res.json() });
        map.addLayer(
          {
            id: "rails-heritage",
            type: "line",
            source: "rails",
            filter: ["==", ["get", "u"], "t"],
            paint: { "line-color": "#9ca3af", "line-width": 1.2, "line-dasharray": [2, 2] },
          },
          "reveal-line",
        );
        map.addLayer(
          {
            id: "rails",
            type: "line",
            source: "rails",
            filter: ["!=", ["get", "u"], "t"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#4b5563",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                ["match", ["get", "u"], "m", 1.4, 0.9],
                12,
                ["match", ["get", "u"], "m", 3, 2],
              ],
            },
          },
          "reveal-line",
        );
      } catch (err) {
        console.warn("rails unavailable", err);
        propsRef.current.onNotice("rails");
      }
      propsRef.current.onReady();
      drawOverlays();
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  function drawOverlays() {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const { guesses, pending, station, locale } = propsRef.current;
    for (const m of markers.current) m.remove();
    markers.current = [];
    guesses.forEach((g, i) => {
      const latest = i === guesses.length - 1;
      const node = el(
        `pin guess${latest ? " latest" : ""}`,
        `<span class="pin-label">${i + 1} · ${formatDistance(g[2], locale)}</span>`,
      );
      markers.current.push(new lib.Marker({ element: node }).setLngLat([g[1], g[0]]).addTo(map));
    });
    if (pending) markers.current.push(new lib.Marker({ element: el("pin pending") }).setLngLat(pending).addTo(map));
    const reveal = map.getSource<GeoJSONSource>("reveal");
    if (station) {
      const node = el("station-pin", `<div class="mini-sign">${escapeHtml(station.name)}</div><div class="dot"></div>`);
      markers.current.push(
        new lib.Marker({ element: node, anchor: "bottom", offset: [0, 7] })
          .setLngLat([station.lng, station.lat])
          .addTo(map),
      );
      const last = guesses.at(-1);
      reveal?.setData({
        type: "FeatureCollection",
        features: last
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [last[1], last[0]],
                    [station.lng, station.lat],
                  ],
                },
              },
            ]
          : [],
      });
    } else reveal?.setData({ type: "FeatureCollection", features: [] });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw whenever what's on the map changes
  useEffect(drawOverlays, [props.guesses, props.pending, props.station, props.locale]);

  // Move the camera when the view key changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the key triggers a camera move
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const { view, padding } = propsRef.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (view.kind === "round" && view.points?.length) {
      const bounds = view.points.reduce((b, p) => b.extend(p), new lib.LngLatBounds(view.points[0], view.points[0]));
      map.fitBounds(bounds, { padding, maxZoom: 12, duration: reduced ? 0 : 900 });
    } else {
      map.fitBounds(NL_BOUNDS, { padding, duration: reduced ? 0 : 600 });
    }
  }, [props.view.key]);

  return <div ref={container} className="map" role="application" aria-label={props.label} />;
}
