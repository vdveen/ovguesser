import { useEffect, useRef } from "react";
import type { StationStat } from "../api/client";
import { currentRound } from "../game/run";
import { roundScore } from "../game/scoring";
import type { Run } from "../game/types";
import { useI18n } from "../i18n/i18n";

interface Props {
  run: Run;
  stat: StationStat | undefined;
  onNext: () => void;
}

export function RoundCard({ run, stat, onNext }: Props) {
  const { t, num } = useI18n();
  const round = currentRound(run);
  const n = round.guesses.length;
  const found = round.outcome === "found";
  const last = run.current === run.rounds.length - 1;
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
  }, []);
  const attempts = t(n === 1 ? "attempt" : "attempts");
  return (
    <div className="round-card" role="dialog" aria-live="assertive" aria-labelledby="round-title">
      <span className="pts">+{num(roundScore(round))}</span>
      <div className="title" id="round-title">
        {found ? t(n === 1 ? "foundFirst" : "found") : t("revealed")}
      </div>
      <div className="meta">
        {found ? t("foundMeta", { station: round.name, n, attempts }) : t("revealedMeta", { station: round.name })}
      </div>
      {stat && stat.plays >= 5 && (
        <div className="stat">{t("stationStat", { pct: stat.firstTry, station: round.name })}</div>
      )}
      <button ref={button} type="button" className="btn btn-primary wide" onClick={onNext}>
        {t(last ? "seeRun" : "nextStation")} <kbd className="kbd-hint">Enter</kbd>
      </button>
    </div>
  );
}
