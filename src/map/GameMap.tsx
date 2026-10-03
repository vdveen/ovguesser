import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, Marker, PaddingOptions } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { type CSSProperties, useEffect, useRef } from "react";
import railsUrl from "../data/rails.json?url";
import { formatDistance } from "../game/distance";
import { isHit } from "../game/scoring";
import type { Guess } from "../game/types";
import { loadBasemap } from "./basemap";

type MapLib = typeof import("maplibre-gl");

export const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.72],
  [7.25, 53.56],
];

/** How far the game's panels reach into the map from each edge, in CSS pixels. */
export interface Insets {
  t: number;
  r: number;
  b: number;
  l: number;
}

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
  /** The stations of a finished run, shown as numbered stops on the results screen. */
  stops: { lat: number; lng: number; name: string }[];
  view: MapView;
  padding: PaddingOptions;
  insets: Insets;
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
  const stationNode = useRef<HTMLElement | null>(null);
  const stopNodes = useRef<{ node: HTMLElement; lngLat: [number, number] }[]>([]);
  // Which view the camera last framed, and whether the player has moved the map since.
  const framed = useRef({ key: "", userMoved: false });
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
        // Loose enough that the country can sit beside or between the start and results panels.
        maxBounds: [
          [-12, 40],
          [18, 62],
        ],
        minZoom: 4,
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
      map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new lib.ScaleControl({ unit: "metric" }), "bottom-left");
      mapRef.current = map;
      // Handle for end-to-end tests, which need to turn coordinates into click positions.
      (container.current as HTMLDivElement & { __map?: MapLibreMap }).__map = map;
      map.on("click", (e) => {
        if (propsRef.current.interactive) propsRef.current.onPin([e.lngLat.lng, e.lngLat.lat]);
      });
      map.on("movestart", (e) => {
        if (e.originalEvent) framed.current.userMoved = true;
      });
      map.on("moveend", placeLabels);
      await map.once("load");
      if (cancelled) return;
      container.current.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      map.addSource("reveal", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "reveal-line",
        type: "line",
        source: "reveal",
        paint: { "line-color": "#0b2e6f", "line-width": 2, "line-dasharray": [2, 1.5] },
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
            paint: { "line-color": "#9a9a9a", "line-width": 1.2, "line-dasharray": [2, 2] },
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
              "line-color": "#1f1f1f",
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
    const { guesses, pending, station, stops, locale } = propsRef.current;
    for (const m of markers.current) m.remove();
    markers.current = [];
    stationNode.current = null;
    stopNodes.current = [];
    const add = (node: HTMLElement, lngLat: [number, number]) =>
      markers.current.push(new lib.Marker({ element: node, anchor: "center" }).setLngLat(lngLat).addTo(map));
    guesses.forEach((g, i) => {
      const latest = i === guesses.length - 1;
      // Once the station is shown, guesses keep only their number; the hit sits under the station itself.
      const label = !station ? `${i + 1} · ${formatDistance(g[2], locale)}` : isHit(g[2]) ? "" : String(i + 1);
      add(el(`pin guess${latest ? " latest" : ""}`, label && `<span class="pin-label">${label}</span>`), [g[1], g[0]]);
    });
    if (pending) add(el("pin pending"), pending);
    stops.forEach((s, i) => {
      const node = el("stop-pin", `<i>${i + 1}</i><span>${escapeHtml(s.name)}</span>`);
      add(node, [s.lng, s.lat]);
      stopNodes.current.push({ node, lngLat: [s.lng, s.lat] });
    });
    const reveal = map.getSource<GeoJSONSource>("reveal");
    if (station) {
      const node = el("station-pin", `<span class="station-sign">${escapeHtml(station.name)}</span>`);
      add(node, [station.lng, station.lat]);
      stationNode.current = node;
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
    placeLabels();
  }

  /**
   * Hang the station's name to the left of it when there's room, so it doesn't cover the guesses east of it.
   * Stop labels go right unless they would run past the right edge.
   */
  function placeLabels() {
    const map = mapRef.current;
    const { station, insets } = propsRef.current;
    if (!map) return;
    const node = stationNode.current;
    if (node && station) {
      const sign = node.querySelector<HTMLElement>(".station-sign");
      const x = map.project([station.lng, station.lat]).x;
      node.classList.toggle("left", x - (sign?.offsetWidth ?? 0) - 12 > insets.l);
    }
    const right = map.getContainer().clientWidth - insets.r;
    for (const stop of stopNodes.current) {
      const label = stop.node.querySelector<HTMLElement>("span");
      const x = map.project(stop.lngLat).x;
      stop.node.classList.toggle("left", x + 18 + (label?.offsetWidth ?? 0) > right);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw whenever what's on the map changes
  useEffect(drawOverlays, [props.guesses, props.pending, props.station, props.stops, props.locale]);

  // Move the camera when the view changes. When only the padding changes (a panel opened, the window
  // resized), frame the same view again, unless the player has already moved the map themselves.
  const { top = 0, right = 0, bottom = 0, left = 0 } = props.padding;
  const paddingKey = [top, right, bottom, left].map(Math.round).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the view key and the padding trigger a camera move
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const { view, padding } = propsRef.current;
    const newView = framed.current.key !== view.key;
    if (!newView && framed.current.userMoved) return;
    framed.current = { key: view.key, userMoved: false };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : newView ? (view.kind === "round" ? 900 : 600) : 300;
    if (view.kind === "round" && view.points?.length) {
      const bounds = view.points.reduce((b, p) => b.extend(p), new lib.LngLatBounds(view.points[0], view.points[0]));
      map.fitBounds(bounds, { padding, maxZoom: 12, duration });
    } else {
      map.fitBounds(NL_BOUNDS, { padding, duration });
    }
  }, [props.view.key, paddingKey]);

  const vars = {
    "--in-t": `${props.insets.t}px`,
    "--in-r": `${props.insets.r}px`,
    "--in-b": `${props.insets.b}px`,
    "--in-l": `${props.insets.l}px`,
  } as CSSProperties;

  return <div ref={container} className="map" style={vars} role="application" aria-label={props.label} />;
}
