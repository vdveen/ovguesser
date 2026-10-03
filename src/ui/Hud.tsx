import { formatDistance } from "../game/distance";
import { currentRound } from "../game/run";
import { missPenalty, roundScore, runTotal } from "../game/scoring";
import type { Run } from "../game/types";
import { useI18n } from "../i18n/i18n";
import type { StringKey } from "../i18n/strings";
import { isTouch } from "./device";
import { Rich } from "./rich";

interface Props {
  run: Run;
  modeLabel: string;
  hasPin: boolean;
  canGiveUp: boolean;
  onHome: () => void;
  onGiveUp: () => void;
}

/** The station sign across the top: the question in the blue band, score and feedback in the black strip. */
export function Hud({ run, modeLabel, hasPin, canGiveUp, onHome, onGiveUp }: Props) {
  const { t, num, locale } = useI18n();
  const touch = isTouch();
  const round = currentRound(run);
  const done = !!round.outcome;
  const gs = round.guesses;
  const last = gs.at(-1);
  const prev = gs.at(-2);

  let hint = "";
  let cost = 0;
  if (!done) {
    if (hasPin) hint = t(touch ? "hintPinTap" : "hintPinClick");
    else if (last) {
      const key: StringKey = !prev ? "hintMiss" : last[2] < prev[2] ? "hintMissCloser" : "hintMissFurther";
      hint = t(key, { distance: formatDistance(last[2], locale) });
      if (last[2] < 5000) hint += ` ${t("hintZoom")}`;
      cost = missPenalty(last[2]);
    } else hint = t(touch ? "hintStartTap" : "hintStartClick");
  }

  return (
    <header className="top play" data-inset="top">
      <div className="band">
        <div className="brand desk-only">
          <b>{t("appName")}</b>
          <span>{modeLabel}</span>
        </div>
        <div className="question">
          <span className="label">{t("whereIs")}</span>
          <h1 data-testid="station-name">{round.name}</h1>
        </div>
        <div className="progress">
          <span>{t("progress", { n: run.current + 1 })}</span>
          <span className="squares" aria-hidden="true">
            {run.rounds.map((r, i) => (
              <i key={r.code} className={r.outcome ? "done" : i === run.current ? "now" : ""} />
            ))}
          </span>
        </div>
        <button type="button" className="link phone-only menu" onClick={onHome}>
          {t("menu")}
        </button>
      </div>
      <div className="strip">
        <div className="links">
          <button type="button" className="link desk-only" onClick={onHome}>
            {t("menu")}
          </button>
          {!done && (
            <button type="button" className="link" onClick={onGiveUp} disabled={!canGiveUp} title={t("giveUpTitle")}>
              {t("giveUp")}
            </button>
          )}
        </div>
        <p className="hint" aria-live="polite">
          {hint && <Rich text={hint} />}
          {cost > 0 && <span className="cost">{t("missCost", { points: cost })}</span>}
        </p>
        <div className="nums">
          <span>
            <span className="soft">{t(done ? "earned" : "left")}</span>
            <b data-testid="round-score">{num(roundScore(round))}</b>
          </span>
          <span>
            <span className="soft">{t("total")}</span>
            <b data-testid="total-score">{num(runTotal(run))}</b>
          </span>
        </div>
      </div>
    </header>
  );
}
