import { useLayoutEffect, useState } from "react";
import type { Insets } from "../map/GameMap";

const ZERO: Insets = { t: 0, r: 0, b: 0, l: 0 };
const same = (a: Insets, b: Insets) => a.t === b.t && a.r === b.r && a.b === b.b && a.l === b.l;

/**
 * How far the elements marked data-inset="top|right|bottom|left" reach into the window, so the map can
 * frame its view in the part that's still visible. Change `layoutKey` whenever those elements may have changed.
 */
export function useInsets(layoutKey: string): Insets {
  const [insets, setInsets] = useState<Insets>(ZERO);
  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutKey is the caller's signal that the marked elements changed
  useLayoutEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-inset]")];
    const measure = () => {
      const next = { ...ZERO };
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const side = node.dataset.inset;
        if (side === "top") next.t = Math.max(next.t, r.bottom);
        else if (side === "bottom") next.b = Math.max(next.b, innerHeight - r.top);
        else if (side === "left") next.l = Math.max(next.l, r.right);
        else if (side === "right") next.r = Math.max(next.r, innerWidth - r.left);
      }
      const rounded = { t: Math.round(next.t), r: Math.round(next.r), b: Math.round(next.b), l: Math.round(next.l) };
      setInsets((prev) => (same(prev, rounded) ? prev : rounded));
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const node of nodes) observer.observe(node);
    addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      removeEventListener("resize", measure);
    };
  }, [layoutKey]);
  return insets;
}
