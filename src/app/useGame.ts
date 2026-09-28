import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { dateKeyFor } from "../game/dates";
import { randomSeed } from "../game/rng";
import { advance, applyGuess, createRun, currentRound, resumeRound, revealRound } from "../game/run";
import type { Pool, Run } from "../game/types";
import { activeBackup, openRepo, type RunRepo } from "../storage/repo";

export type Phase = "loading" | "start" | "guessing" | "roundEnd" | "runEnd";

export interface GameState {
  phase: Phase;
  run: Run | null;
  /** [lng, lat] of a pin that hasn't been confirmed yet */
  pending: [number, number] | null;
}

type Action =
  | { type: "ready" }
  | { type: "home" }
  | { type: "show"; run: Run }
  | { type: "pin"; lngLat: [number, number] | null }
  | { type: "update"; run: Run };

function phaseFor(run: Run): Phase {
  if (run.status === "finished") return "runEnd";
  return currentRound(run).outcome ? "roundEnd" : "guessing";
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "ready":
      return { ...state, phase: "start" };
    case "home":
      return { phase: "start", run: state.run, pending: null };
    case "show":
    case "update":
      return { phase: phaseFor(action.run), run: action.run, pending: null };
    case "pin":
      return state.phase === "guessing" ? { ...state, pending: action.lngLat } : state;
  }
}

export interface GameEvents {
  onSaveError?: () => void;
  onRunFinished?: (run: Run) => void;
  onChange?: () => void;
}

const uuid = () => crypto.randomUUID();

export function useGame(events: GameEvents = {}) {
  const [state, dispatch] = useReducer(reducer, { phase: "loading", run: null, pending: null });
  const repoRef = useRef<RunRepo | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  // Writes go through one queue so an older version of a run can never overwrite a newer one.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback((input: Run) => {
    const repo = repoRef.current;
    if (!repo) return;
    const run = { ...input, updatedAt: Date.now() };
    activeBackup.write(run);
    saveQueue.current = saveQueue.current
      .then(() => repo.put(run))
      .then(() => eventsRef.current.onChange?.())
      .catch((err) => {
        console.error("save failed", err);
        eventsRef.current.onSaveError?.();
      });
  }, []);

  const commit = useCallback(
    (next: Run) => {
      const prev = stateRef.current.run;
      if (next === prev) return;
      dispatch({ type: "update", run: next });
      save(next);
      if (next.status === "finished" && prev?.status !== "finished") eventsRef.current.onRunFinished?.(next);
    },
    [save],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const repo = await openRepo();
      await activeBackup.recover(repo).catch(() => false);
      if (cancelled) return;
      repoRef.current = repo;
      dispatch({ type: "ready" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(
    async (mode: "classic" | "daily", pool: Pool) => {
      const repo = repoRef.current;
      if (!repo) return;
      await saveQueue.current;
      const old = await repo.active().catch(() => undefined);
      if (old) save({ ...old, status: "abandoned" });
      const run = createRun({ id: uuid(), mode, pool, seed: randomSeed(), dateKey: dateKeyFor(), now: Date.now() });
      dispatch({ type: "show", run });
      save(run);
    },
    [save],
  );

  const resume = useCallback(
    (run: Run) => {
      const next = resumeRound(run, Date.now());
      dispatch({ type: "show", run: next });
      if (next !== run) save(next);
    },
    [save],
  );

  const show = useCallback((run: Run) => dispatch({ type: "show", run }), []);
  const home = useCallback(() => dispatch({ type: "home" }), []);
  const setPin = useCallback((lngLat: [number, number] | null) => dispatch({ type: "pin", lngLat }), []);

  const confirmGuess = useCallback(() => {
    const { run, pending, phase } = stateRef.current;
    if (!run || !pending || phase !== "guessing") return;
    commit(applyGuess(run, pending[1], pending[0], Date.now()));
  }, [commit]);

  const giveUp = useCallback(() => {
    const { run, phase } = stateRef.current;
    if (run && phase === "guessing") commit(revealRound(run, Date.now()));
  }, [commit]);

  const next = useCallback(() => {
    const { run, phase } = stateRef.current;
    if (run && phase === "roundEnd") commit(advance(run, Date.now()));
  }, [commit]);

  const markSynced = useCallback(
    (run: Run) => {
      const synced = { ...run, syncedAt: Date.now() };
      save(synced);
      if (stateRef.current.run?.id === run.id)
        dispatch({ type: "update", run: { ...stateRef.current.run, syncedAt: synced.syncedAt } });
    },
    [save],
  );

  const getRepo = useCallback(() => repoRef.current, []);
  const flush = useCallback(() => saveQueue.current, []);

  return useMemo(
    () => ({ state, repo: getRepo, flush, start, resume, show, home, setPin, confirmGuess, giveUp, next, markSynced }),
    [state, getRepo, flush, start, resume, show, home, setPin, confirmGuess, giveUp, next, markSynced],
  );
}

export type Game = ReturnType<typeof useGame>;
