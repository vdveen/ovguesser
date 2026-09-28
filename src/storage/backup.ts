import type { Run } from "../game/types";

export const EXPORT_FORMAT = 1;

export function exportPayload(runs: Run[], now = new Date()) {
  return { app: "ovguesser", format: EXPORT_FORMAT, exportedAt: now.toISOString(), runs };
}

/** Reads an export file. Throws with a short reason if it isn't one of ours. */
export function parseExport(text: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("not-json");
  }
  if (!data || typeof data !== "object" || (data as { app?: unknown }).app !== "ovguesser")
    throw new Error("not-ovguesser");
  const runs = (data as { runs?: unknown }).runs;
  if (!Array.isArray(runs)) throw new Error("no-runs");
  return runs;
}
