import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type DailyStats, type StationStat } from "../api/client";
import { dateKeyFor } from "../game/dates";
import { currentRound } from "../game/run";
import { MAX_RUN_SCORE, roundSquare, runTotal } from "../game/scoring";
import { STATION_BY_CODE } from "../game/stations";
import type { Pool, Run } from "../game/types";
import { useI18n } from "../i18n/i18n";
import { GameMap, type MapView } from "../map/GameMap";
import { ConfirmBar } from "../ui/ConfirmBar";
import { EndSheet, formatDateKey } from "../ui/EndSheet";
import { HistoryDrawer } from "../ui/HistoryDrawer";
import { Hud } from "../ui/Hud";
import { RoundCard } from "../ui/RoundCard";
import { StartSheet } from "../ui/StartSheet";
import { useGame } from "./useGame";

const POOL_KEY = "ovg-pool";
const loadPool = (): Pool => {
  try {
    return localStorage.getItem(POOL_KEY) === "intercity" ? "intercity" : "all";
  } catch {
    return "all";
  }
};

function useViewport() {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: innerWidth, h: innerHeight });
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  return size;
}

export function App() {
  const { t, num, locale } = useI18n();
  const [toast, setToast] = useState<{ text: string; id: number; long?: boolean } | null>(null);
  const showToast = useCallback((text: string, long = false) => setToast({ text, id: Date.now(), long }), []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [pool, setPool] = useState<Pool>(loadPool);
  const [active, setActive] = useState<Run | undefined>();
  const [dailyDone, setDailyDone] = useState<Run | undefined>();
  const [daily, setDaily] = useState<DailyStats | null>(null);
  const [previousBest, setPreviousBest] = useState(0);
  const [stationStats, setStationStats] = useState<Record<string, StationStat>>({});
  const [playersToday, setPlayersToday] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const channel = useMemo(() => ("BroadcastChannel" in window ? new BroadcastChannel("ovguesser") : null), []);
  const { w, h } = useViewport();
  const mobile = w <= 640;

  const game = useGame({
    onSaveError: () => showToast(t("saveFailed")),
    onChange: () => {
      setVersion((v) => v + 1);
      channel?.postMessage("runs-changed");
    },
    onRunFinished: (run) => void afterFinish(run),
  });
  const { state } = game;
  const { run, phase } = state;
  const repo = game.repo();

  useEffect(() => {
    if (!channel) return;
    channel.onmessage = () => setVersion((v) => v + 1);
    return () => channel.close();
  }, [channel]);

  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), toast.long ? 7000 : 2600);
    return () => clearTimeout(id);
  }, [toast]);

  async function loadDaily(r: Run) {
    setDaily(null);
    try {
      setDaily(await api.dailyStats(r.dateKey, r.total ?? runTotal(r)));
    } catch {}
  }

  async function afterFinish(finished: Run) {
    const r = game.repo();
    if (!r) return;
    await game.flush();
    const { runs } = await r.list();
    const others = runs.filter((x) => x.status === "finished" && x.id !== finished.id && x.mode === finished.mode);
    setPreviousBest(Math.max(0, ...others.map((x) => x.total ?? runTotal(x))));
    setDaily(null);
    api
      .submitRun(finished)
      .then((res) => {
        if (res.daily) setDaily(res.daily);
        game.markSynced(finished);
      })
      .catch(() => {});
    const finishedCount = others.length + 1;
    if (finishedCount === 1) navigator.storage?.persist?.().catch(() => {});
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches;
    if (ios && finishedCount >= 2 && !(await r.getMeta("iosTipShown"))) {
      await r.setMeta("iosTipShown", true);
      showToast(t("iosTip"), true);
    }
  }

  // Start screen data: a run to resume and today's daily ride.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version signals stored runs changed
  useEffect(() => {
    if (!repo || phase !== "start") return;
    let cancelled = false;
    repo.list().then(({ runs }) => {
      if (cancelled) return;
      const today = dateKeyFor();
      setActive(runs.find((r) => r.status === "active"));
      setDailyDone(runs.find((r) => r.mode === "daily" && r.dateKey === today && r.status === "finished"));
    });
    return () => {
      cancelled = true;
    };
  }, [repo, phase, version]);

  // Once at startup: shared statistics, and resend finished runs the server hasn't stored yet.
  useEffect(() => {
    if (!repo) return;
    api.stationStats().then(setStationStats, () => {});
    api.overview().then(
      (o) => setPlayersToday(o.dailyPlayersToday),
      () => {},
    );
    (async () => {
      const { runs } = await repo.list();
      const cutoff = Date.now() - 14 * 86_400_000;
      for (const r of runs.filter((x) => x.status === "finished" && !x.syncedAt && x.startedAt > cutoff)) {
        try {
          await api.submitRun(r);
          game.markSynced(r);
        } catch {
          break;
        }
      }
    })();
  }, [repo, game.markSynced]);

  // Screen reader announcement at the start of each round.
  useEffect(() => {
    if (run && phase === "guessing" && currentRound(run).guesses.length === 0)
      setAnnouncement(t("announceRound", { n: run.current + 1, station: currentRound(run).name }));
  }, [run, phase, t]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadDaily only sets state
  const playDaily = useCallback(async () => {
    const r = game.repo();
    if (!r) return;
    const today = dateKeyFor();
    const { runs } = await r.list();
    const done = runs.find((x) => x.mode === "daily" && x.dateKey === today && x.status === "finished");
    if (done) {
      setPreviousBest(0);
      game.show(done);
      void loadDaily(done);
      showToast(t("dailyAlready"), true);
      return;
    }
    const ongoing = runs.find((x) => x.mode === "daily" && x.dateKey === today && x.status === "active");
    if (ongoing) game.resume(ongoing);
    else await game.start("daily", "all");
  }, [game, showToast, t]);

  const playFree = useCallback(() => game.start("classic", pool), [game, pool]);

  const choosePool = (p: Pool) => {
    setPool(p);
    try {
      localStorage.setItem(POOL_KEY, p);
    } catch {}
  };

  const share = async () => {
    if (!run) return;
    const head =
      run.mode === "daily" ? t("shareHeaderDaily", { date: formatDateKey(run.dateKey, locale) }) : "OVGuesser";
    const squares = run.rounds.map(roundSquare).join("");
    const tries = run.rounds.map((r) => (r.outcome === "found" ? r.guesses.length : "✗")).join(" ");
    const text = `${head}\n${squares}  ${num(run.total ?? runTotal(run))} / ${num(MAX_RUN_SCORE)}\n${t("shareAttempts")}: ${tries}\nhttps://ovguesser.nl`;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("copied"));
    } catch {
      prompt(t("copyPrompt"), text);
    }
  };

  // Keyboard: Enter confirms a pin or moves on, Escape removes the pin or closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if (e.key === "Enter") {
        if (target?.tagName === "BUTTON") return; // let the focused button act
        if (phase === "guessing" && state.pending) {
          e.preventDefault();
          game.confirmGuess();
        } else if (phase === "roundEnd") {
          e.preventDefault();
          game.next();
        }
      } else if (e.key === "Escape") {
        if (historyOpen) setHistoryOpen(false);
        else if (state.pending) game.setPin(null);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [phase, state.pending, historyOpen, game]);

  const round = run && phase !== "start" && phase !== "loading" ? currentRound(run) : null;
  const station = useMemo(() => {
    if (!round?.outcome) return null;
    const s = STATION_BY_CODE.get(round.code);
    return s ? { lat: s.lat, lng: s.lng, name: round.name } : null;
  }, [round?.code, round?.outcome, round?.name]);

  const hudHeight = mobile ? 205 : 0;
  const padding =
    phase === "start" || phase === "loading"
      ? mobile
        ? { top: 16, bottom: Math.round(h * 0.55), left: 8, right: 8 }
        : { top: 40, bottom: 40, left: 40, right: 40 }
      : mobile
        ? { top: hudHeight + 10, bottom: phase === "guessing" ? 70 : 190, left: 24, right: 24 }
        : { top: 60, bottom: phase === "guessing" ? 60 : 170, left: 400, right: 60 };

  const view: MapView = useMemo(() => {
    if (run && round?.outcome && (phase === "roundEnd" || phase === "runEnd") && station) {
      return {
        key: `round:${run.id}:${run.current}`,
        kind: "round",
        points: [...round.guesses.map((g) => [g[1], g[0]] as [number, number]), [station.lng, station.lat]],
      };
    }
    return { key: `country:${phase === "start" ? "start" : `${run?.id}:${run?.current}`}`, kind: "country" };
  }, [run, round, phase, station]);

  const emptyGuesses = useMemo(() => [], []);

  if (phase === "loading" || !repo) return <div className="loading">{t("loadingMap")}</div>;

  return (
    <>
      <GameMap
        guesses={round?.guesses ?? emptyGuesses}
        pending={state.pending}
        station={station}
        view={view}
        padding={padding}
        locale={locale}
        label={t("mapLabel")}
        interactive={phase === "guessing"}
        onPin={game.setPin}
        onReady={() => {}}
        onNotice={(what) => showToast(t(what === "rails" ? "railsFailed" : "basemapFailed"))}
      />
      {run && round && (
        <Hud
          run={run}
          hasPin={!!state.pending}
          canGiveUp={phase === "guessing"}
          onHome={game.home}
          onGiveUp={game.giveUp}
          onHistory={() => setHistoryOpen(true)}
        />
      )}
      <ConfirmBar
        show={phase === "guessing" && !!state.pending}
        onConfirm={game.confirmGuess}
        onCancel={() => game.setPin(null)}
      />
      {phase === "roundEnd" && run && (
        <RoundCard
          key={`${run.id}:${run.current}`}
          run={run}
          stat={stationStats[currentRound(run).code]}
          onNext={game.next}
        />
      )}
      {phase === "start" && (
        <StartSheet
          active={active}
          dailyDone={dailyDone}
          pool={pool}
          playersToday={playersToday}
          memoryOnly={repo.kind === "memory"}
          onPool={choosePool}
          onDaily={playDaily}
          onFree={playFree}
          onResume={game.resume}
          onHistory={() => setHistoryOpen(true)}
        />
      )}
      {phase === "runEnd" && run && (
        <EndSheet
          run={run}
          previousBest={previousBest}
          daily={daily}
          onShare={share}
          onAgain={playFree}
          onHistory={() => setHistoryOpen(true)}
          onHome={game.home}
        />
      )}
      {historyOpen && (
        <HistoryDrawer repo={repo} version={version} onClose={() => setHistoryOpen(false)} onToast={showToast} />
      )}
      <div className={`toast${toast ? " show" : ""}`} role="status">
        {toast?.text}
      </div>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
