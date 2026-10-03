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

/** Result of a round, across the bottom of the screen so the revealed station stays visible above it. */
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
  const note = found
    ? stat && stat.plays >= 5
      ? stat.firstTry > 0
        ? t("stationStat", { pct: stat.firstTry })
        : t("stationStatNone")
      : ""
    : t("revealedMeta", { station: round.name });
  return (
    <section className="result" data-inset="bottom" role="dialog" aria-live="assertive" aria-labelledby="round-title">
      <h2 id="round-title">{found ? (n === 1 ? t("foundFirst") : t("foundIn", { n })) : t("revealed")}</h2>
      <p className="note">{note}</p>
      <p className="pts">{found ? `+${num(roundScore(round))}` : "0"}</p>
      <button ref={button} type="button" className="btn" onClick={onNext}>
        {t(last ? "toResult" : "nextStation")} <kbd className="kbd-hint">Enter</kbd>
      </button>
    </section>
  );
}
