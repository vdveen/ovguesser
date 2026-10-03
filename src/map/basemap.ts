import type { StyleSpecification } from "maplibre-gl";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/**
 * OpenFreeMap's positron style without any text or icons (they would give away place names)
 * and without its own railways (we draw ours). Falls back to a plain background if it can't load.
 */
export async function loadBasemap(): Promise<{ style: StyleSpecification; ok: boolean }> {
  try {
    const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(String(res.status));
    const style = (await res.json()) as StyleSpecification;
    style.layers = style.layers.filter((l) => l.type !== "symbol" && !l.id.startsWith("railway"));
    for (const layer of style.layers) {
      // A little more contrast on water so coastlines and lakes read as landmarks.
      if (layer.id === "water" && layer.type === "fill") layer.paint = { ...layer.paint, "fill-color": "#c7d2de" };
    }
    delete style.sprite;
    delete style.glyphs;
    return { style, ok: true };
  } catch (err) {
    console.warn("basemap unavailable", err);
    return {
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": "#eef0f2" } }],
      },
      ok: false,
    };
  }
}
