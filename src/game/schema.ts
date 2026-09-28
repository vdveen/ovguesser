import { z } from "zod";
import { ROUNDS_PER_RUN } from "./scoring";

const guess = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
  z.number().int().min(0).max(40_000_000),
  z.number().int().min(0),
]);

export const roundSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  startedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  guesses: z.array(guess).max(200),
  outcome: z.enum(["found", "revealed"]).nullable(),
});

export const runSchema = z.object({
  id: z.string().uuid(),
  v: z.literal(1),
  dataVersion: z.string().max(40),
  mode: z.enum(["classic", "daily"]),
  pool: z.enum(["all", "intercity"]),
  seed: z.number().int().min(0).max(0xffffffff),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "finished", "abandoned"]),
  current: z
    .number()
    .int()
    .min(0)
    .max(ROUNDS_PER_RUN - 1),
  rounds: z.array(roundSchema).length(ROUNDS_PER_RUN),
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  total: z.number().int().optional(),
  syncedAt: z.number().nullable().optional(),
  updatedAt: z.number().optional(),
});

/** Upgrades a stored record to the current shape. Add a step here whenever `v` changes. */
export function migrateRun(record: unknown): unknown {
  return record;
}
