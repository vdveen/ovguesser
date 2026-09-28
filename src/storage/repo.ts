import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { migrateRun, runSchema } from "../game/schema";
import type { Run } from "../game/types";

const DB_NAME = "ovguesser";
const DB_VERSION = 1;

interface OvgDb extends DBSchema {
  runs: { key: string; value: Run; indexes: { startedAt: number; status: string } };
  meta: { key: string; value: unknown };
}

export interface RunRepo {
  readonly kind: "indexeddb" | "memory";
  put(run: Run): Promise<void>;
  get(id: string): Promise<Run | undefined>;
  /** All readable runs, newest first. Records that fail validation are skipped and counted. */
  list(): Promise<{ runs: Run[]; skipped: number }>;
  active(): Promise<Run | undefined>;
  importRuns(records: unknown[]): Promise<{ imported: number; skipped: number }>;
  clear(): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}

/** Validates a stored or imported record. Returns undefined for anything we cannot read. */
export function readRun(record: unknown): Run | undefined {
  const parsed = runSchema.safeParse(migrateRun(record));
  return parsed.success ? (parsed.data as Run) : undefined;
}

const newestFirst = (a: Run, b: Run) => b.startedAt - a.startedAt;

class IdbRepo implements RunRepo {
  readonly kind = "indexeddb" as const;
  constructor(private db: IDBPDatabase<OvgDb>) {}

  async put(run: Run) {
    await this.db.put("runs", run);
  }
  async get(id: string) {
    return readRun(await this.db.get("runs", id));
  }
  async list() {
    const raw = await this.db.getAll("runs");
    const runs = raw.map(readRun).filter((r): r is Run => !!r);
    return { runs: runs.sort(newestFirst), skipped: raw.length - runs.length };
  }
  async active() {
    const raw = await this.db.getAllFromIndex("runs", "status", "active");
    return raw
      .map(readRun)
      .filter((r): r is Run => !!r)
      .sort(newestFirst)[0];
  }
  async importRuns(records: unknown[]) {
    const valid = records.map(readRun).filter((r): r is Run => !!r);
    const tx = this.db.transaction("runs", "readwrite");
    // An imported active run would compete with the one on this device, so it comes in as abandoned.
    await Promise.all(valid.map((r) => tx.store.put(r.status === "active" ? { ...r, status: "abandoned" } : r)));
    await tx.done;
    return { imported: valid.length, skipped: records.length - valid.length };
  }
  async clear() {
    await this.db.clear("runs");
  }
  async getMeta<T>(key: string) {
    return (await this.db.get("meta", key)) as T | undefined;
  }
  async setMeta(key: string, value: unknown) {
    await this.db.put("meta", value, key);
  }
}

/** Used when IndexedDB is unavailable (some private windows, blocked storage). Nothing survives a reload. */
export class MemoryRepo implements RunRepo {
  readonly kind = "memory" as const;
  private runs = new Map<string, Run>();
  private meta = new Map<string, unknown>();
  async put(run: Run) {
    this.runs.set(run.id, structuredClone(run));
  }
  async get(id: string) {
    return this.runs.get(id);
  }
  async list() {
    return { runs: [...this.runs.values()].sort(newestFirst), skipped: 0 };
  }
  async active() {
    return [...this.runs.values()].filter((r) => r.status === "active").sort(newestFirst)[0];
  }
  async importRuns(records: unknown[]) {
    const valid = records.map(readRun).filter((r): r is Run => !!r);
    for (const r of valid) this.runs.set(r.id, r.status === "active" ? { ...r, status: "abandoned" } : r);
    return { imported: valid.length, skipped: records.length - valid.length };
  }
  async clear() {
    this.runs.clear();
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta(key: string, value: unknown) {
    this.meta.set(key, value);
  }
}

export async function openRepo(useIndexedDb = typeof indexedDB !== "undefined"): Promise<RunRepo> {
  if (!useIndexedDb) return new MemoryRepo();
  try {
    const db = await openDB<OvgDb>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const runs = db.createObjectStore("runs", { keyPath: "id" });
          runs.createIndex("startedAt", "startedAt");
          runs.createIndex("status", "status");
          db.createObjectStore("meta");
        }
      },
    });
    // Firefox private windows used to open fine and then fail on the first write.
    await db.put("meta", Date.now(), "openedAt");
    return new IdbRepo(db);
  } catch (err) {
    console.warn("IndexedDB unavailable, runs will not be kept", err);
    return new MemoryRepo();
  }
}

const BACKUP_KEY = "ovg-active-run";

/**
 * IndexedDB writes are asynchronous, so a tab that is closed or killed right after a guess can lose it.
 * The active run is also written synchronously to localStorage (about 1 kB) and recovered on the next start.
 */
export const activeBackup = {
  write(run: Run) {
    try {
      if (run.status === "active") localStorage.setItem(BACKUP_KEY, JSON.stringify(run));
      else if (activeBackup.read()?.id === run.id) localStorage.removeItem(BACKUP_KEY);
    } catch {}
  },
  read(): Run | undefined {
    try {
      const text = localStorage.getItem(BACKUP_KEY);
      return text ? readRun(JSON.parse(text)) : undefined;
    } catch {
      return undefined;
    }
  },
  /** Puts the backup into the repository if it is newer than the stored copy. */
  async recover(repo: RunRepo): Promise<boolean> {
    const backup = activeBackup.read();
    if (!backup) return false;
    const stored = await repo.get(backup.id);
    if (stored && (stored.updatedAt ?? 0) >= (backup.updatedAt ?? 0)) return false;
    await repo.put(backup);
    return true;
  },
};
