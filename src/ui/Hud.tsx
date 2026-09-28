import { useEffect, useRef, useState } from "react";
import { formatDistance } from "../game/distance";
import { currentRound } from "../game/run";
import { MAX_ROUND_SCORE, roundScore, runTotal } from "../game/scoring";
import type { Run } from "../game/types";
import { useI18n } from "../i18n/i18n";
import type { StringKey } from "../i18n/strings";
import { Rich } from "./rich";

interface Props {
  run: Run;
  hasPin: boolean;
  canGiveUp: boolean;
  onHome: () => void;
  onGiveUp: () => void;
  onHistory: () => void;
}

export function Hud({ run, hasPin, canGiveUp, onHome, onGiveUp, onHistory }: Props) {
  const { t, num, locale } = useI18n();
  const round = currentRound(run);
  const score = roundScore(round);
  const gs = round.guesses;
  const last = gs.at(-1);
  const prev = gs.at(-2);

  // Flash the score when it changes: red when points are lost, green when a new round starts.
  const [flash, setFlash] = useState<{ kind: "down" | "up"; delta: number; id: number } | null>(null);
  const shown = useRef({ id: `${run.id}:${run.current}`, score });
  useEffect(() => {
    const key = `${run.id}:${run.current}`;
    const before = shown.current;
    shown.current = { id: key, score };
    if (before.id !== key) {
      if (score === MAX_ROUND_SCORE) setFlash({ kind: "up", delta: 0, id: Date.now() });
      return;
    }
    if (score < before.score) setFlash({ kind: "down", delta: before.score - score, id: Date.now() });
  }, [run.id, run.current, score]);

  let hint: string;
  if (round.outcome === "found")
    hint = t("hintFound", { n: gs.length, attempts: t(gs.length === 1 ? "attempt" : "attempts") });
  else if (round.outcome === "revealed") hint = t("hintRevealed");
  else if (hasPin) hint = t("hintPin");
  else if (last) {
    const key: StringKey = !prev ? "hintMiss" : last[2] < prev[2] ? "hintMissWarmer" : "hintMissColder";
    hint = t(key, { distance: formatDistance(last[2], locale) });
    if (last[2] < 5000) hint += ` ${t("hintZoom")}`;
  } else hint = t("hintStart");

  return (
    <section className="hud" aria-label={t("appName")}>
      <div className="hud-top">
        <button type="button" className="brand" onClick={onHome} aria-label={t("menu")}>
          <span className="brand-mark" aria-hidden="true">
            ▶
          </span>
          {t("appName")}
        </button>
        <div className="progress" role="img" aria-label={t("progress", { n: run.current + 1 })}>
          {run.rounds.map((r, i) => (
            <i key={r.code} className={r.outcome ? "done" : i === run.current ? "now" : ""} />
          ))}
        </div>
      </div>
      <div className="ns-sign">
        <small>{t("whereIs")}</small>
        <span data-testid="station-name">{round.name}</span>
      </div>
      <div className="scores">
        <div key={flash?.id} className={`score${flash ? ` flash-${flash.kind}` : ""}`}>
          <span>{t("roundScore")}</span>
          <b data-testid="round-score">{num(score)}</b>
          {flash?.kind === "down" && <em className="delta">−{num(flash.delta)}</em>}
        </div>
        <div className="score">
          <span>{t("total")}</span>
          <b data-testid="total-score">{num(runTotal(run))}</b>
        </div>
      </div>
      <p className="hint" aria-live="polite">
        <Rich text={hint} />
      </p>
      {gs.length > 0 && (
        <div className="guesses">
          {gs.map((g, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: guesses are append-only
            <span key={i} className={`chip${i > 0 && g[2] < gs[i - 1][2] ? " warmer" : ""}`}>
              {formatDistance(g[2], locale)}
            </span>
          ))}
        </div>
      )}
      <div className="hud-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onGiveUp}
          disabled={!canGiveUp}
          title={t("giveUpTitle")}
        >
          {t("giveUp")}
        </button>
        <button type="button" className="btn btn-ghost hide-mobile" onClick={onHistory}>
          {t("myRuns")}
        </button>
      </div>
    </section>
  );
}
